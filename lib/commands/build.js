const chalk = require('chalk');
const ora = require('ora');
const inquirer = require('inquirer');
const path = require('path');
const fs = require('fs');
const { getCurrentBranch } = require('../utils/git');
const { BrowserAuth } = require('../utils/browser');
const { ConfigManager } = require('../utils/config');
const axios = require('axios');
const os = require('os');

// 配置管理类，负责加载、校验、创建配置文件
class BuildConfigManager {
  constructor() {
    this.configManager = new ConfigManager();
    this.localConfig = {};
  }

  checkAndCreateConfig() {
    try {
      // 检查是否有配置文件
      if (!fs.existsSync(this.configManager.projectConfigFile) && !fs.existsSync(this.configManager.configFile)) {
        this.configManager.createDefaultConfig();
        console.log('📝 已为你创建配置文件');
        console.log('💡 请编辑该文件，将 your-xxx 替换为你的实际配置信息');
        console.log('📍 文件位置：' + this.configManager.projectConfigFile);
        console.log('🔄 填写完成后请重新运行命令');
        process.exit(0);
      }
      
      this.loadConfig();
      this.checkTemplateValues();
    } catch (e) {
      console.error('❌ 读取配置文件失败，请检查文件格式或内容是否正确。');
      process.exit(1);
    }
  }

  loadConfig() {
    this.localConfig = this.configManager.getBuildConfigWithDefault();
  }

  checkTemplateValues() {
    const templateValues = [
      'your-jenkins-url',
      'your-jenkins-base',
      'your-jenkins-token',
      'your-jenkins-username',
      'your-jenkins-password'
    ];
    const hasTemplateValues = Object.values(this.localConfig).some(value => templateValues.includes(value));
    if (hasTemplateValues) {
      console.log(chalk.yellow('⚠️ 检测到配置文件包含模板值，请修改以下变量：'));
      Object.entries(this.localConfig).forEach(([key, value]) => {
        if (templateValues.includes(value)) {
          console.log(chalk.cyan(`   ${key}=${value}`));
        }
      });
      console.log(chalk.green('📍 文件位置：' + this.configManager.projectConfigFile));
      console.log(chalk.cyan('🔄 修改完成后请重新运行命令'));
      process.exit(0);
    }
  }

  validateConfig() {
    const requiredKeys = ['jenkinsBase', 'jenkinsToken', 'jenkinsUrl', 'jobName'];
    const missingKeys = [];
    
    for (const key of requiredKeys) {
      if (!this.localConfig[key]) {
        missingKeys.push(key);
      }
    }
    
    if (missingKeys.length > 0) {
      console.error('❌ 配置信息缺失，请检查以下配置：');
      missingKeys.forEach(key => {
        console.error(`   - ${key}`);
      });
      console.error('\n💡 提示：');
      console.error('   1. 请在项目配置文件 (.daodourc) 中取消注释并填写上述配置');
      if (missingKeys.includes('jobName')) {
        console.error('   2. jobName 参数必须从本地配置文件设置，不能使用全局配置');
      } else {
        console.error('   2. 或者确保全局配置文件 (~/.daodou/config.json) 中包含这些配置');
      }
      console.error('   3. 项目配置优先于全局配置');
      process.exit(1);
    }
    
    // 验证构建参数配置
    if (this.localConfig.buildParams) {
      const buildParams = this.localConfig.buildParams;
      if (typeof buildParams !== 'object') {
        console.error('❌ buildParams 必须是对象格式');
        process.exit(1);
      }
    }
  }
}

class BuildCommand {
  constructor() {
    this.configManager = new BuildConfigManager();
    this.browserAuth = new BrowserAuth();
    this.jenkinsConfig = {
      baseUrl: null,
      auth: null
    };

    // 创建 axios 实例
    this.axios = axios.create({
      maxRedirects: 0,
      validateStatus: s => s < 400 || s === 401 || s === 403 || s === 302
    });

    // 请求拦截器：自动添加 Cookie
    this.axios.interceptors.request.use(config => {
      const cookieString = this.browserAuth.getCookieString();
      if (cookieString) {
        config.headers.Cookie = cookieString;
      }
      // 确保有 User-Agent
      if (!config.headers['User-Agent']) {
        config.headers['User-Agent'] = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';
      }
      return config;
    });

    // 响应拦截器：自动更新 Cookie
    this.axios.interceptors.response.use(async response => {
      const setCookie = response.headers['set-cookie'];
      if (setCookie) {
        await this.browserAuth.updateCookiesFromSetCookie(setCookie);
      }
      return response;
    }, async error => {
      // 即使是错误响应，也可能包含 set-cookie
      if (error.response && error.response.headers && error.response.headers['set-cookie']) {
        await this.browserAuth.updateCookiesFromSetCookie(error.response.headers['set-cookie']);
      }
      return Promise.reject(error);
    });
  }

  async execute(options = {}) {
    // 配置检查与加载
    this.configManager.checkAndCreateConfig();
    this.configManager.validateConfig();
    const config = this.configManager.localConfig;
    this.jenkinsConfig.baseUrl = config.jenkinsUrl;
    this.jenkinsBase = config.jenkinsBase;
    this.jenkinsToken = config.jenkinsToken;
    console.log(chalk.blue('🔧 刀豆构建工具启动中...\n'));

    // 1. 获取分支名称（强制从Git获取，不依赖配置）
    const branch = await this.getBranch(options);
    console.log(chalk.green(`✅ 当前分支: ${chalk.cyan(branch)}\n`));

    // 2. 浏览器登录Jenkins
    await this.browserAuth.ensureLogin();

    // 3. 设置Jenkins认证
    this.setupJenkinsAuth();

    // 4. 检查 Jenkins 会话有效性
    await this.ensureJenkinsSession();

    // 5. 构建任务名称和URL
    const jobName = this.buildJobName(config);
    const jenkinsUrl = this.buildJobUrl(config, jobName);
    const params = this.buildParams(config, branch);

    // 7. 确认参数
    console.log(chalk.yellow('📋 构建参数:'));
    console.log(`  jobName: ${jobName}`);
    Object.entries(params).forEach(([key, value]) => {
      if (key === 'token') return; // 不显示 token
      console.log(`  ${chalk.cyan(key)}: ${chalk.magenta(value)}`);
    });

    await inquirer.prompt([
      {
        type: 'input',
        name: 'confirm',
        message: chalk.yellow('按回车确认开始构建，Ctrl+C 取消...'),
        default: undefined,
        transformer: () => ''
      }
    ]);
    // 只要不是 Ctrl+C 终止就继续

    // 8. 记录本地计时起点
    const buildStartTime = Date.now();
    // 9. 触发Jenkins构建并监听进度
    await this.triggerAndMonitorBuild(jobName, params, buildStartTime);
  }

  /**
   * 构建任务名称
   */
  buildJobName(config) {
    return config.jobName;
  }

  /**
   * 构建任务URL
   */
  buildJobUrl(config, jobName) {
    // 使用默认拼接方式
    return `${this.jenkinsBase}/${encodeURIComponent(jobName)}/buildWithParameters`;
  }

  /**
   * 构建参数
   */
  buildParams(config, branch) {
    const buildParams = config.buildParams || {
      token: this.jenkinsToken,
      GIT_BRANCH: branch
    };

    // 确保 GIT_BRANCH 参数使用当前分支
    const finalParams = { ...buildParams };
    finalParams.GIT_BRANCH = branch;
    
    return finalParams;
  }

  /**
   * 获取分支名称（强制从Git获取）
   * @param {Object} options 命令行选项
   * @returns {Promise<string>} 分支名称
   */
  async getBranch(options) {
    // 如果命令行指定了分支，优先使用命令行参数
    if (options.branch) {
      console.log(chalk.yellow(`⚠️ 使用命令行指定的分支: ${options.branch}`));
      return options.branch;
    }

    // 否则强制从Git获取当前分支
    const spinner = ora('检测当前Git分支...').start();
    try {
      const branch = await getCurrentBranch();
      spinner.succeed('分支检测完成');
      return branch;
    } catch (error) {
      spinner.fail('分支检测失败');
      throw new Error(`无法检测当前Git分支: ${error.message}\n💡 请确保当前目录是Git仓库，或使用 --branch 参数指定分支`);
    }
  }

  async detectBranch() {
    const spinner = ora('检测当前分支...').start();
    try {
      const branch = await getCurrentBranch();
      spinner.succeed('分支检测完成');
      return branch;
    } catch (error) {
      spinner.fail('分支检测失败');
      throw new Error(`无法检测当前分支: ${error.message}`);
    }
  }

  setupJenkinsAuth() {
    // 使用浏览器获取的cookies进行认证
    const cookies = this.browserAuth.cookies;
    const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    this.jenkinsConfig.auth = {
      headers: {
        Cookie: cookieString,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    };
  }

  async ensureJenkinsSession() {
    try {
      // 使用拦截器自动带上 Cookie
      const resp = await this.axios.get(this.jenkinsConfig.baseUrl);
      
      // 302 跳转到登录页、401/403 都视为未登录
      if (resp.status === 401 || resp.status === 403) throw new Error('未登录');
      if (resp.status === 302 && resp.headers.location && resp.headers.location.includes('casdoor')) throw new Error('未登录');
      // 其它情况视为已登录
      return true;
    } catch (e) {
      // 自动重新登录
      console.log(chalk.yellow('⚠️ Cookie 已失效，自动重新登录...'));
      await this.browserAuth.login();
      this.setupJenkinsAuth();
      return true;
    }
  }

  async triggerAndMonitorBuild(jobName, params, buildStartTime) {
    // 1. 触发构建
    const spinner = ora('正在触发Jenkins构建...').start();
    try {
      const queueId = await this.triggerBuild(jobName, params);
      spinner.succeed(chalk.green(`✅ Jenkins构建已触发，队列号: ${queueId}`));
      // 2. 监听队列，获取build number
      await this.monitorQueueAndBuild(jobName, queueId, buildStartTime);
    } catch (error) {
      spinner.fail('❌ Jenkins构建触发失败');
      console.error(chalk.red('构建失败:'), error.message);
    }
  }

  async triggerBuild(jobName, params) {
    try {
      const url = `${this.jenkinsConfig.baseUrl}job/${encodeURIComponent(jobName)}/buildWithParameters`;
      let headers = {};
      // 1. 获取 crumb（防止 403）
      try {
        const crumbResp = await this.axios.get(`${this.jenkinsConfig.baseUrl}crumbIssuer/api/json`, {
          timeout: 10000
        });
        const { crumb, crumbRequestField } = crumbResp.data;
        headers[crumbRequestField] = crumb;
      } catch (e) {
        // 如果 crumb 获取失败，继续尝试（部分 Jenkins 关闭了 CSRF 防护）
      }
      // 2. 触发构建
      const response = await this.axios.post(url, null, {
        headers,
        params: params,
        timeout: 30000
      });
      if (response.status === 201) {
        // 从响应头中获取队列ID
        const location = response.headers.location;
        const queueId = location ? location.replace(/\/$/, '').split('/').pop() : null;
        if (!queueId) {
          console.log(chalk.yellow('⚠️ 未能正确获取队列号，可能是Jenkins配置问题。'));
        }
        return queueId;
      } else {
        throw new Error('触发构建失败');
      }
    } catch (error) {
      console.log(chalk.red('❌ Jenkins构建触发失败: ' + error.message));
      console.log(chalk.yellow('💡 请检查Jenkins权限、Token、参数设置，或联系管理员。'));
      throw new Error(`触发构建失败: ${error.message}`);
    }
  }

  async monitorQueueAndBuild(jobName, queueId, buildStartTime) {
    const spinner = ora('等待Jenkins分配构建号...').start();
    let buildNumber = null;
    let count = 0;
    while (!buildNumber && count < 60) { // 最多等2分钟
      try {
        const response = await this.axios.get(`${this.jenkinsConfig.baseUrl}queue/item/${queueId}/api/json`, {
          timeout: 10000
        });
        const item = response.data;
        if (item.executable && item.executable.number) {
          buildNumber = item.executable.number;
          spinner.succeed(chalk.green(`✅ 已分配构建号: ${buildNumber}`));
          break;
        }
        spinner.text = '等待Jenkins分配构建号...';
      } catch (e) {
        spinner.text = '队列查询中...';
      }
      await new Promise(r => setTimeout(r, 2000));
      count++;
    }
    if (!buildNumber) {
      spinner.fail('❌ 超时未分配构建号');
      return;
    }
    // 监听构建进度
    await this.monitorBuild(jobName, buildNumber, buildStartTime);
  }

  async monitorBuild(jobName, buildNumber, buildStartTime) {
    const spinner = ora({
      text: 'Jenkins构建中... [BUILDING] 0s',
      spinner: 'dots'
    }).start();
    let building = true;
    let lastLog = '';
    let lastLogTime = 0;
    while (building) {
      try {
        const response = await this.axios.get(`${this.jenkinsConfig.baseUrl}job/${encodeURIComponent(jobName)}/${buildNumber}/api/json`, {
          timeout: 10000
        });
        const buildInfo = response.data;
        building = buildInfo.building;
        // 计时
        const duration = building
          ? Math.floor((Date.now() - buildStartTime) / 1000)
          : Math.floor((Date.now() - buildStartTime) / 1000);
        spinner.text = `Jenkins构建中... [${buildInfo.result || 'BUILDING'}] ${duration}s`;
        // 实时输出日志片段（每3秒刷新一次）
        const now = Date.now();
        if (now - lastLogTime > 2900) {
          try {
            const logResponse = await this.axios.get(`${this.jenkinsConfig.baseUrl}job/${encodeURIComponent(jobName)}/${buildNumber}/consoleText`, {
              timeout: 10000
            });
            const log = logResponse.data;
            const lines = log.split('\n');
            const lastLines = lines.slice(-5).join('\n');
            if (lastLines !== lastLog) {
              spinner.stop();
              process.stdout.write(chalk.gray(lastLines) + '\n');
              spinner.start();
              spinner.text = `Jenkins构建中... [${buildInfo.result || 'BUILDING'}] ${duration}s`;
              lastLog = lastLines;
            }
            lastLogTime = now;
          } catch (logError) {
            // 日志获取失败不影响主流程
          }
        }
        if (!building) {
          spinner.stop();
          const totalSeconds = Math.floor((Date.now() - buildStartTime) / 1000);
          const min = Math.floor(totalSeconds / 60);
          const sec = totalSeconds % 60;
          const timeStr = min > 0 ? `${min}分${sec}秒` : `${sec}秒`;
          if (buildInfo.result === 'SUCCESS') {
            console.log(chalk.green('🎉 Jenkins构建成功!'));
            console.log(chalk.green(`⏱️ 总用时: ${timeStr}`));
          } else {
            console.log(chalk.red(`❌ Jenkins构建失败: ${buildInfo.result}`));
            console.log(chalk.red(`⏱️ 总用时: ${timeStr}`));
          }
          break;
        }
      } catch (e) {
        spinner.text = 'Jenkins构建中...';
      }
      await new Promise(r => setTimeout(r, 500)); // 500ms刷新一次
    }
  }
}

module.exports = new BuildCommand();