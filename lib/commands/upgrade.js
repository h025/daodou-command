const axios = require('axios');
const chalk = require('chalk');
const ora = require('ora');
const { execSync } = require('child_process');
const packageJson = require('../../package.json');

/**
 * 获取npm上的最新版本号
 * @returns {Promise<string>} 最新版本号
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
 * @returns {string} 当前版本号
 */
function getCurrentVersion() {
  return packageJson.version;
}

/**
 * 比较版本号
 * @param {string} current 当前版本
 * @param {string} latest 最新版本
 * @returns {boolean} 是否有更新
 */
function hasUpdate(current, latest) {
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
 * 执行npm更新
 * @param {string} version 要更新的版本
 */
function updatePackage(version) {
  try {
    console.log(chalk.blue(`正在更新到版本 ${version}...`));
    execSync(`npm install -g ${packageJson.name}@${version} --force`, { 
      stdio: 'inherit',
      timeout: 300000 // 5分钟超时
    });
    console.log(chalk.green(`✅ 成功更新到版本 ${version}`));
  } catch (error) {
    throw new Error(`更新失败: ${error.message}`);
  }
}

/**
 * 显示更新信息
 * @param {string} current 当前版本
 * @param {string} latest 最新版本
 * @param {boolean} hasUpdateAvailable 是否有更新
 */
function displayUpdateInfo(current, latest, hasUpdateAvailable) {
  console.log(chalk.cyan('📦 daodou-command 版本信息:'));
  console.log(`   当前版本: ${chalk.yellow(current)}`);
  console.log(`   最新版本: ${chalk.yellow(latest)}`);
  
  if (hasUpdateAvailable) {
    console.log(chalk.red('   ⚠️  有新版本可用！'));
    console.log(chalk.gray('   使用 "dao update" 命令进行更新'));
  } else {
    console.log(chalk.green('   ✅ 已是最新版本'));
  }
}

/**
 * 执行更新命令
 * @param {Object} options 命令选项
 */
async function execute(options) {
  const spinner = ora('检查更新中...').start();
  
  try {
    // 获取版本信息
    const currentVersion = getCurrentVersion();
    const latestVersion = await getLatestVersion();
    const hasUpdateAvailable = hasUpdate(currentVersion, latestVersion);
    
    spinner.stop();
    
    // 显示版本信息
    displayUpdateInfo(currentVersion, latestVersion, hasUpdateAvailable);
    
    // 如果只是检查版本，直接返回
    if (options.check) {
      return;
    }
    
    // 如果没有更新且不是强制更新，提示用户
    if (!hasUpdateAvailable && !options.force) {
      console.log(chalk.gray('   无需更新'));
      return;
    }
    
    // 如果有更新或强制更新，执行更新
    if (hasUpdateAvailable || options.force) {
      console.log(); // 空行
      
      if (options.force && !hasUpdateAvailable) {
        console.log(chalk.yellow('⚠️  强制更新到当前版本'));
      }
      
      updatePackage(latestVersion);
      
      // 验证更新结果
      console.log(chalk.blue('验证更新结果...'));
      try {
        const { execSync } = require('child_process');
        const newVersion = execSync('dao --version', { encoding: 'utf8' }).trim();
        console.log(chalk.green(`✅ 更新完成！当前版本: ${newVersion}`));
      } catch (error) {
        console.log(chalk.yellow('⚠️  更新完成，但无法验证版本号'));
      }
    }
    
  } catch (error) {
    spinner.stop();
    throw error;
  }
}

module.exports = {
  execute,
  getLatestVersion,
  getCurrentVersion,
  hasUpdate
};
