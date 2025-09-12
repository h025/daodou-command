const simpleGit = require('simple-git');
const path = require('path');

/**
 * 获取当前Git分支名称
 * @returns {Promise<string>} 分支名称
 */
async function getCurrentBranch() {
  try {
    const git = simpleGit(process.cwd());
    
    // 检查是否为Git仓库
    const isRepo = await git.checkIsRepo();
    if (!isRepo) {
      throw new Error('当前目录不是Git仓库');
    }

    // 获取当前分支
    const branch = await git.branch();
    return branch.current;
  } catch (error) {
    throw new Error(`获取分支失败: ${error.message}`);
  }
}

/**
 * 检查是否有未提交的更改
 * @returns {Promise<boolean>} 是否有未提交的更改
 */
async function hasUncommittedChanges() {
  try {
    const git = simpleGit(process.cwd());
    const status = await git.status();
    
    return !status.isClean();
  } catch (error) {
    throw new Error(`检查未提交更改失败: ${error.message}`);
  }
}

module.exports = {
  getCurrentBranch,
  hasUncommittedChanges
}; 