const axios = require('axios');
const chalk = require('chalk');
const ora = require('ora');
const { execSync } = require('child_process');
const packageJson = require('../../package.json');

/**
 * 获取npm上的最新版本号
 */
async function getLatestVersion() {
  try {
    const response = await axios.get(`https://registry.npmjs.org/${packageJson.name}/latest`, {
      timeout: 10000
    });
    return response.data.version;
  } catch (error) {
    throw new Error(`获取最新版本失败: ${error.message}`);
  }
}

/**
 * 获取当前安装的版本号
 */
function getCurrentVersion() {
  return packageJson.version;
}

/**
 * 比较版本号
 */
function hasUpdate(current, latest) {
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

/**
 * 执行更新命令
 */
async function execute(options) {
  console.log('');
  console.log(chalk.bold('  🔄 版本更新'));
  console.log(chalk.dim('  ─────────────────────────'));

  const spinner = ora({ text: '检查最新版本...', indent: 2 }).start();

  try {
    const currentVersion = getCurrentVersion();
    const latestVersion = await getLatestVersion();
    const updateAvailable = hasUpdate(currentVersion, latestVersion);

    spinner.succeed('版本检查完成');

    console.log('');
    console.log('  ' + chalk.dim('当前') + '  v' + currentVersion);
    console.log('  ' + chalk.dim('最新') + '  v' + latestVersion);
    console.log(chalk.dim('  ─────────────────────────'));

    if (options.check) {
      if (updateAvailable) {
        console.log('');
        console.log(chalk.yellow('  ⚠ 有新版本可用，运行 ') + chalk.cyan('dao upgrade') + chalk.yellow(' 更新'));
      } else {
        console.log(chalk.green('  ✔ 已是最新版本'));
      }
      console.log('');
      return;
    }

    if (!updateAvailable && !options.force) {
      console.log(chalk.green('  ✔ 已是最新版本'));
      console.log('');
      return;
    }

    if (options.force && !updateAvailable) {
      console.log(chalk.yellow('  ⚠ 强制重新安装'));
    }

    console.log('');
    const installSpinner = ora({ text: `安装 v${latestVersion}...`, indent: 2 }).start();
    try {
      execSync(`npm install -g ${packageJson.name}@${latestVersion} --force`, {
        stdio: 'pipe',
        timeout: 300000
      });
      installSpinner.succeed(`已更新到 v${latestVersion}`);
    } catch (error) {
      installSpinner.fail('安装失败 ' + chalk.dim(error.message));
    }
    console.log('');
  } catch (error) {
    spinner.fail('检查失败 ' + chalk.dim(error.message));
  }
}

module.exports = {
  execute,
  getLatestVersion,
  getCurrentVersion,
  hasUpdate
};
