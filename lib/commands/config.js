const chalk = require('chalk');
const ora = require('ora');
const inquirer = require('inquirer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { ConfigManager } = require('../utils/config');

class ConfigCommand {
  constructor() {
    this.configManager = new ConfigManager();
  }

  /**
   * 执行config命令
   * @param {string} action - 操作类型 (init, show, edit, clear)
   * @param {Object} options - 命令选项
   */
  async execute(action, options = {}) {
    switch (action) {
      case 'init':
        await this.initGlobalConfig();
        break;
      case 'show':
        await this.showConfig();
        break;
      case 'edit':
        await this.editConfig();
        break;
      case 'clear':
        await this.clearConfig();
        break;
      default:
        await this.interactiveConfig();
        break;
    }
  }

  /**
   * 初始化全局配置
   */
  async initGlobalConfig() {
    console.log(chalk.blue('🔧 初始化全局配置...\n'));

    // 检查是否已存在全局配置
    if (fs.existsSync(this.configManager.configFile)) {
      const { overwrite } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'overwrite',
          message: '全局配置文件已存在，是否覆盖？',
          default: false
        }
      ]);

      if (!overwrite) {
        console.log(chalk.yellow('❌ 操作已取消'));
        return;
      }
    }

    const spinner = ora('创建全局配置...').start();

    try {
      // 创建全局配置目录
      if (!fs.existsSync(this.configManager.configDir)) {
        fs.mkdirSync(this.configManager.configDir, { recursive: true });
      }

      // 创建默认全局配置
      await this.createDefaultGlobalConfig();
      
      spinner.succeed('全局配置创建成功');
      console.log(chalk.green(`📁 配置文件位置: ${this.configManager.configFile}`));
      console.log(chalk.yellow('💡 请编辑配置文件，填写你的实际配置信息'));
      console.log(chalk.blue('📖 使用 "dao config show" 查看当前配置'));
      console.log(chalk.blue('📝 使用 "dao config edit" 编辑配置'));

    } catch (error) {
      spinner.fail('创建失败');
      throw new Error(`创建全局配置失败: ${error.message}`);
    }
  }

  /**
   * 显示当前配置
   */
  async showConfig() {
    console.log(chalk.blue('📋 当前配置信息:\n'));

    // 显示全局配置
    console.log(chalk.cyan('🌍 全局配置:'));
    if (fs.existsSync(this.configManager.configFile)) {
      const globalConfig = this.configManager.loadConfigFile(this.configManager.configFile);
      console.log(chalk.gray(`   文件位置: ${this.configManager.configFile}`));
      console.log(chalk.gray(`   配置内容:`));
      console.log(JSON.stringify(globalConfig, null, 4));
    } else {
      console.log(chalk.yellow('   ❌ 全局配置文件不存在'));
      console.log(chalk.blue('   💡 使用 "dao config init" 创建全局配置'));
    }

    console.log();

    // 显示项目配置
    console.log(chalk.cyan('📁 项目配置:'));
    if (fs.existsSync(this.configManager.projectConfigFile)) {
      const projectConfig = this.configManager.loadConfigFile(this.configManager.projectConfigFile);
      console.log(chalk.gray(`   文件位置: ${this.configManager.projectConfigFile}`));
      console.log(chalk.gray(`   配置内容:`));
      console.log(JSON.stringify(projectConfig, null, 4));
    } else {
      console.log(chalk.yellow('   ❌ 项目配置文件不存在'));
      console.log(chalk.blue('   💡 运行 build 命令时会自动创建'));
    }

    console.log();

    // 显示合并后的配置
    console.log(chalk.cyan('🔀 合并后配置 (项目配置优先):'));
    const mergedConfig = this.configManager.getAll();
    console.log(JSON.stringify(mergedConfig, null, 4));
  }

  /**
   * 编辑配置
   */
  async editConfig() {
    console.log(chalk.blue('📝 编辑配置...\n'));

    const { configType } = await inquirer.prompt([
      {
        type: 'list',
        name: 'configType',
        message: '选择要编辑的配置文件:',
        choices: [
          {
            name: '全局配置 (推荐)',
            value: 'global',
            disabled: !fs.existsSync(this.configManager.configFile) ? '文件不存在' : false
          },
          {
            name: '项目配置',
            value: 'project',
            disabled: !fs.existsSync(this.configManager.projectConfigFile) ? '文件不存在' : false
          }
        ]
      }
    ]);

    const configFile = configType === 'global' 
      ? this.configManager.configFile 
      : this.configManager.projectConfigFile;

    console.log(chalk.blue(`📁 配置文件位置: ${configFile}`));
    console.log(chalk.yellow('💡 请使用你喜欢的编辑器打开该文件进行编辑'));

    // 尝试打开默认编辑器
    const { openEditor } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'openEditor',
        message: '是否使用默认编辑器打开文件？',
        default: true
      }
    ]);

    if (openEditor) {
      const editor = process.env.EDITOR || process.env.VISUAL || 'vim';
      const { spawn } = require('child_process');
      
      try {
        const child = spawn(editor, [configFile], { stdio: 'inherit' });
        child.on('exit', (code) => {
          if (code === 0) {
            console.log(chalk.green('✅ 配置编辑完成'));
          } else {
            console.log(chalk.yellow('⚠️ 编辑器退出，请手动检查配置'));
          }
        });
      } catch (error) {
        console.log(chalk.red(`❌ 无法打开编辑器: ${error.message}`));
        console.log(chalk.yellow('请手动编辑配置文件'));
      }
    }
  }

  /**
   * 清除配置
   */
  async clearConfig() {
    console.log(chalk.blue('🗑️ 清除配置...\n'));

    const { configType } = await inquirer.prompt([
      {
        type: 'list',
        name: 'configType',
        message: '选择要清除的配置:',
        choices: [
          {
            name: '全局配置',
            value: 'global',
            disabled: !fs.existsSync(this.configManager.configFile) ? '文件不存在' : false
          },
          {
            name: '项目配置',
            value: 'project',
            disabled: !fs.existsSync(this.configManager.projectConfigFile) ? '文件不存在' : false
          },
          {
            name: '所有配置',
            value: 'all'
          }
        ]
      }
    ]);

    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: '确定要删除配置吗？此操作不可恢复！',
        default: false
      }
    ]);

    if (!confirm) {
      console.log(chalk.yellow('❌ 操作已取消'));
      return;
    }

    const spinner = ora('清除配置...').start();

    try {
      if (configType === 'global' || configType === 'all') {
        if (fs.existsSync(this.configManager.configFile)) {
          fs.unlinkSync(this.configManager.configFile);
          console.log(chalk.green('✅ 全局配置已删除'));
        }
      }

      if (configType === 'project' || configType === 'all') {
        if (fs.existsSync(this.configManager.projectConfigFile)) {
          fs.unlinkSync(this.configManager.projectConfigFile);
          console.log(chalk.green('✅ 项目配置已删除'));
        }
      }

      spinner.succeed('配置清除完成');

    } catch (error) {
      spinner.fail('清除失败');
      throw new Error(`清除配置失败: ${error.message}`);
    }
  }

  /**
   * 交互式配置向导
   */
  async interactiveConfig() {
    console.log(chalk.blue('🎯 配置向导\n'));

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: '请选择操作:',
        choices: [
          { name: '初始化全局配置', value: 'init' },
          { name: '查看当前配置', value: 'show' },
          { name: '编辑配置文件', value: 'edit' },
          { name: '清除配置', value: 'clear' },
          { name: '退出', value: 'exit' }
        ]
      }
    ]);

    if (action === 'exit') {
      console.log(chalk.yellow('👋 再见！'));
      return;
    }

    await this.execute(action);
  }

  /**
   * 创建默认全局配置
   */
  async createDefaultGlobalConfig() {
    const configContent = `{
  // build 命令全局配置
  build: {
    // Jenkins 基础配置 (可选，项目配置优先)
    // jenkinsUrl: "https://your-company-jenkins.com/",
    // jenkinsBase: "https://your-company-jenkins.com/job",
    // jenkinsToken: "your-global-token",
    // jenkinsUsername: "your-global-username",
    // jenkinsPassword: "your-global-password"
  },
  
  // lang 命令全局配置
  lang: {
    defaultLang: "en",
    defaultDir: "./public/locales",
    fileName: "common.json",
    // 代理相关配置（全局默认）
    proxyListUrl: "https://free-proxy-list.net/",
    proxyTestUrl: "https://httpbin.org/ip"
  }
}`;

    fs.writeFileSync(this.configManager.configFile, configContent);
  }
}

module.exports = {
  ConfigCommand
};
