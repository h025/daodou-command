const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');
const packageJson = require('../../package.json');

// 全局状态文件路径
const STATE_FILE = path.join(os.homedir(), '.daodou-update-state.json');

/**
 * 获取npm上的最新版本号
 * @returns {Promise<string>} 最新版本号
 */
async function getLatestVersion() {
  try {
    const response = await axios.get(`https://registry.npmjs.org/${packageJson.name}/latest`, {
      timeout: 5000 // 5秒超时，避免阻塞
    });
    return response.data.version;
  } catch (error) {
    // 静默失败，不影响主命令执行
    return null;
  }
}

/**
 * 比较版本号
 * @param {string} current 当前版本
 * @param {string} latest 最新版本
 * @returns {boolean} 是否有更新
 */
function hasUpdate(current, latest) {
  if (!latest) return false;
  
  const currentParts = current.split('.').map(Number);
  const latestParts = latest.split('.').map(Number);
  
  for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
    const currentPart = currentParts[i] || 0;
    const latestPart = latestParts[i] || 0;
    
    if (latestPart > currentPart) {
      return true;
    } else if (latestPart < currentPart) {
      return false;
    }
  }
  
  return false;
}

/**
 * 读取全局状态
 * @returns {Object} 状态对象
 */
function readState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const content = fs.readFileSync(STATE_FILE, 'utf8');
      return JSON.parse(content);
    }
  } catch (error) {
    // 忽略读取错误
  }
  
  return {
    lastCheck: 0,
    hasUpdate: false,
    latestVersion: null,
    reminded: false
  };
}

/**
 * 写入全局状态
 * @param {Object} state 状态对象
 */
function writeState(state) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (error) {
    // 忽略写入错误
  }
}

/**
 * 检查是否需要提醒更新
 * @returns {boolean} 是否需要提醒
 */
function shouldRemindUpdate() {
  const state = readState();
  return state.hasUpdate && !state.reminded;
}

/**
 * 标记已提醒
 */
function markAsReminded() {
  const state = readState();
  state.reminded = true;
  writeState(state);
}

/**
 * 后台检查更新（完全异步，不阻塞主命令）
 */
async function checkUpdateInBackground() {
  // 使用setTimeout确保完全异步执行
  setTimeout(async () => {
    try {
      const currentVersion = packageJson.version;
      const latestVersion = await getLatestVersion();
      
      if (latestVersion && hasUpdate(currentVersion, latestVersion)) {
        const state = readState();
        state.lastCheck = Date.now();
        state.hasUpdate = true;
        state.latestVersion = latestVersion;
        state.reminded = false; // 重置提醒状态
        writeState(state);
      } else {
        // 更新状态，标记没有更新
        const state = readState();
        state.lastCheck = Date.now();
        state.hasUpdate = false;
        state.latestVersion = latestVersion;
        writeState(state);
      }
    } catch (error) {
      // 静默失败，不影响主程序
    }
  }, 0);
}

/**
 * 获取更新提醒消息
 * @returns {string|null} 提醒消息
 */
function getUpdateReminder() {
  const state = readState();

  if (!state.hasUpdate || state.reminded) {
    return null;
  }

  // 再次检查当前版本是否已经是最新版本
  const currentVersion = packageJson.version;
  if (currentVersion === state.latestVersion || !hasUpdate(currentVersion, state.latestVersion)) {
    return null;
  }

  return `🔄 发现新版本 ${state.latestVersion}！使用 "dao upgrade" 更新到最新版本。`;
}

/**
 * 检查是否需要执行后台更新检查
 * @returns {boolean} 是否需要检查
 */
function shouldCheckUpdate() {
  const state = readState();
  const now = Date.now();
  const oneHour = 60 * 60 * 1000; // 1小时
  
  // 如果从未检查过，或者距离上次检查超过1小时，则检查
  return !state.lastCheck || (now - state.lastCheck) > oneHour;
}

/**
 * 启动后台更新检查（完全异步）
 */
function startBackgroundCheck() {
  // 使用setImmediate确保在下一个事件循环中执行
  setImmediate(() => {
    if (shouldCheckUpdate()) {
      // 异步执行，不等待结果
      checkUpdateInBackground().catch(() => {
        // 静默失败，不影响主程序
      });
    }
  });
}

module.exports = {
  startBackgroundCheck,
  shouldRemindUpdate,
  getUpdateReminder,
  markAsReminded,
  checkUpdateInBackground
};
