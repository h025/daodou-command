const axios = require('axios');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const os = require('os');
const packageJson = require('../../package.json');

const STATE_DIR = path.join(os.homedir(), '.daodou');
const STATE_FILE = path.join(STATE_DIR, 'update-state.json');

/**
 * 获取npm上的最新版本号
 */
async function getLatestVersion() {
  try {
    const response = await axios.get(`https://registry.npmjs.org/${packageJson.name}/latest`, {
      timeout: 5000
    });
    return response.data.version;
  } catch (error) {
    return null;
  }
}

/**
 * 比较版本号
 */
function hasUpdate(current, latest) {
  if (!latest) return false;

  const currentParts = current.split('.').map(Number);
  const latestParts = latest.split('.').map(Number);

  for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
    const currentPart = currentParts[i] || 0;
    const latestPart = latestParts[i] || 0;

    if (latestPart > currentPart) return true;
    if (latestPart < currentPart) return false;
  }

  return false;
}

function readState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
  } catch (error) {
    // 忽略读取错误
  }
  return { lastCheck: 0, hasUpdate: false, latestVersion: null };
}

function writeState(state) {
  try {
    if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (error) {
    // 忽略写入错误
  }
}

function shouldCheckUpdate() {
  const state = readState();
  const oneHour = 60 * 60 * 1000;
  return !state.lastCheck || (Date.now() - state.lastCheck) > oneHour;
}

async function checkUpdateInBackground() {
  try {
    const currentVersion = packageJson.version;
    const latestVersion = await getLatestVersion();
    const state = readState();
    state.lastCheck = Date.now();
    state.hasUpdate = !!(latestVersion && hasUpdate(currentVersion, latestVersion));
    state.latestVersion = latestVersion;
    writeState(state);
  } catch (error) {
    // 静默失败
  }
}

/**
 * 获取更新提醒消息（同步读取上次后台检查的结果）
 */
function getUpdateReminder() {
  const state = readState();
  if (!state.hasUpdate) return null;

  const currentVersion = packageJson.version;
  if (!hasUpdate(currentVersion, state.latestVersion)) return null;

  return chalk.yellow(`  ⚠ 新版本 v${state.latestVersion} 可用`) + chalk.dim('  运行 ') + chalk.cyan('dao upgrade') + chalk.dim(' 更新');
}

/**
 * 启动后台更新检查（不阻塞主程序）
 */
function startBackgroundCheck() {
  if (!shouldCheckUpdate()) return;
  checkUpdateInBackground().catch(() => {});
}

module.exports = {
  startBackgroundCheck,
  getUpdateReminder,
  checkUpdateInBackground
};
