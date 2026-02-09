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

  async initGlobalConfig() {
    console.log('');
    console.log(chalk.bold('  ⚙ 初始化全局配置'));
    console.log(chalk.dim('  ─────────────────────────'));

    if (fs.existsSync(this.configManager.configFile)) {
      const { overwrite } = await inquirer.prompt([{
        type: 'confirm',
        name: 'overwrite',
        message: '全局配置已存在，是否覆盖？',
        default: false
      }]);
      if (!overwrite) {
        console.log(chalk.yellow('  ⚠ 已取消'));
        console.log('');
        return;
      }
    }

    const spinner = ora({ text: '创建全局配置...', indent: 2 }).start();
    try {
      if (!fs.existsSync(this.configManager.configDir)) {
        fs.mkdirSync(this.configManager.configDir, { recursive: true });
      }
      await this.createDefaultGlobalConfig();
      spinner.succeed('全局配置已创建');
      console.log('');
      console.log('  ' + chalk.dim('文件') + '  ' + this.configManager.configFile);
      console.log(chalk.dim('  ─────────────────────────'));
      console.log(chalk.dim('  请编辑配置文件填写实际信息'));
      console.log('');
    } catch (error) {
      spinner.fail('创建失败 ' + chalk.dim(error.message));
    }
  }

  async showConfig() {
    console.log('');
    console.log(chalk.bold('  ⚙ 配置信息'));
    console.log(chalk.dim('  ─────────────────────────'));

    // 全局配置
    console.log('');
    console.log(chalk.dim('  [全局配置]'));
    if (fs.existsSync(this.configManager.configFile)) {
      console.log('  ' + chalk.dim('文件') + '  ' + this.configManager.configFile);
      const globalConfig = this.configManager.loadConfigFile(this.configManager.configFile);
      this._printConfig(globalConfig);
    } else {
      console.log(chalk.yellow('  ⚠ 不存在') + chalk.dim('  运行 dao config init 创建'));
    }

    // 项目配置
    console.log('');
    console.log(chalk.dim('  [项目配置]'));
    if (fs.existsSync(this.configManager.projectConfigFile)) {
      console.log('  ' + chalk.dim('文件') + '  ' + this.configManager.projectConfigFile);
      const projectConfig = this.configManager.loadConfigFile(this.configManager.projectConfigFile);
      this._printConfig(projectConfig);
    } else {
      console.log(chalk.yellow('  ⚠ 不存在') + chalk.dim('  运行 build 命令时自动创建'));
    }

    // 合并配置
    console.log('');
    console.log(chalk.dim('  [合并结果] (项目优先)'));
    const mergedConfig = this.configManager.getAll();
    this._printConfig(mergedConfig);
    console.log('');
  }

  _printConfig(config, prefix = '    ') {
    for (const [key, value] of Object.entries(config)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        console.log(chalk.dim(`${prefix}${key}:`));
        this._printConfig(value, prefix + '  ');
      } else {
        const display = Array.isArray(value) ? value.join(', ') : String(value);
        console.log(`${prefix}${chalk.dim(key)}  ${display}`);
      }
    }
  }

  async editConfig() {
    console.log('');
    console.log(chalk.bold('  ⚙ 编辑配置'));
    console.log(chalk.dim('  ─────────────────────────'));

    const { configType } = await inquirer.prompt([{
      type: 'list',
      name: 'configType',
      message: '选择配置文件:',
      choices: [
        {
          name: '全局配置',
          value: 'global',
          disabled: !fs.existsSync(this.configManager.configFile) ? '不存在' : false
        },
        {
          name: '项目配置',
          value: 'project',
          disabled: !fs.existsSync(this.configManager.projectConfigFile) ? '不存在' : false
        }
      ]
    }]);

    const configFile = configType === 'global'
      ? this.configManager.configFile
      : this.configManager.projectConfigFile;

    console.log('  ' + chalk.dim('文件') + '  ' + configFile);

    const { openEditor } = await inquirer.prompt([{
      type: 'confirm',
      name: 'openEditor',
      message: '使用默认编辑器打开？',
      default: true
    }]);

    if (openEditor) {
      const editor = process.env.EDITOR || process.env.VISUAL || 'vim';
      const { spawn } = require('child_process');
      try {
        const child = spawn(editor, [configFile], { stdio: 'inherit' });
        child.on('exit', (code) => {
          if (code === 0) {
            console.log(chalk.green('  ✔ 编辑完成'));
          } else {
            console.log(chalk.yellow('  ⚠ 编辑器已退出'));
          }
          console.log('');
        });
      } catch (error) {
        console.log(chalk.red('  ✖ 无法打开编辑器 ') + chalk.dim(error.message));
        console.log('');
      }
    }
  }

  async clearConfig() {
    console.log('');
    console.log(chalk.bold('  ⚙ 清除配置'));
    console.log(chalk.dim('  ─────────────────────────'));

    const { configType } = await inquirer.prompt([{
      type: 'list',
      name: 'configType',
      message: '选择要清除的配置:',
      choices: [
        {
          name: '全局配置',
          value: 'global',
          disabled: !fs.existsSync(this.configManager.configFile) ? '不存在' : false
        },
        {
          name: '项目配置',
          value: 'project',
          disabled: !fs.existsSync(this.configManager.projectConfigFile) ? '不存在' : false
        },
        { name: '所有配置', value: 'all' }
      ]
    }]);

    const { confirm } = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirm',
      message: '确定删除？此操作不可恢复',
      default: false
    }]);

    if (!confirm) {
      console.log(chalk.yellow('  ⚠ 已取消'));
      console.log('');
      return;
    }

    try {
      if (configType === 'global' || configType === 'all') {
        if (fs.existsSync(this.configManager.configFile)) {
          fs.unlinkSync(this.configManager.configFile);
          console.log(chalk.green('  ✔ 全局配置已删除'));
        }
      }
      if (configType === 'project' || configType === 'all') {
        if (fs.existsSync(this.configManager.projectConfigFile)) {
          fs.unlinkSync(this.configManager.projectConfigFile);
          console.log(chalk.green('  ✔ 项目配置已删除'));
        }
      }
      console.log('');
    } catch (error) {
      console.log(chalk.red('  ✖ 清除失败 ') + chalk.dim(error.message));
      console.log('');
    }
  }

  async interactiveConfig() {
    console.log('');
    console.log(chalk.bold('  ⚙ 配置向导'));
    console.log(chalk.dim('  ─────────────────────────'));

    const { action } = await inquirer.prompt([{
      type: 'list',
      name: 'action',
      message: '选择操作:',
      choices: [
        { name: '初始化全局配置', value: 'init' },
        { name: '查看当前配置', value: 'show' },
        { name: '编辑配置文件', value: 'edit' },
        { name: '清除配置', value: 'clear' },
        { name: '退出', value: 'exit' }
      ]
    }]);

    if (action === 'exit') return;
    await this.execute(action);
  }

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

    // 翻译引擎配置
    translation: {
      defaultEngine: "microsoft",
      enginePriority: ["microsoft", "google", "baidu", "ali", "youdao", "deepl", "openai"],
      engines: {
        microsoft: { enabled: true },
        google: { enabled: true },
        baidu: { enabled: false, appId: "", appKey: "" },
        ali: { enabled: false, accessKeyId: "", accessKeySecret: "" },
        youdao: { enabled: false, appId: "", appKey: "" },
        deepl: { enabled: false, apiKey: "" },
        openai: { enabled: false, apiKey: "", model: "gpt-3.5-turbo", baseUrl: "https://api.openai.com/v1" }
      }
    }
  }
}`;
    fs.writeFileSync(this.configManager.configFile, configContent);
  }
}

module.exports = { ConfigCommand };
