const chalk = require('chalk');
const ora = require('ora');
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
      if (!fs.existsSync(this.configManager.projectConfigFile) && !fs.existsSync(this.configManager.configFile)) {
        this.configManager.createDefaultConfig();
        console.log('');
        console.log(chalk.yellow('  ⚠ 已创建默认配置文件'));
        console.log(chalk.dim('    请编辑后重新运行:'));
        console.log('    ' + this.configManager.projectConfigFile);
        process.exit(0);
      }

      this.loadConfig();
      this.checkTemplateValues();
    } catch (e) {
      console.error(chalk.red('  ✖ 读取配置文件失败，请检查文件格式'));
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
      console.log('');
      console.log(chalk.yellow('  ⚠ 配置文件包含模板值，请修改:'));
      Object.entries(this.localConfig).forEach(([key, value]) => {
        if (templateValues.includes(value)) {
          console.log(chalk.dim(`    ${key}`) + ' = ' + chalk.cyan(value));
        }
      });
      console.log(chalk.dim('    文件: ') + this.configManager.projectConfigFile);
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
      console.log('');
      console.log(chalk.red('  ✖ 缺少必要配置:'));
      missingKeys.forEach(key => {
        console.log(chalk.dim(`    - ${key}`));
      });
      console.log('');
      console.log(chalk.dim('  请在 .daodourc 或 ~/.daodou/config.json 中补充'));
      if (missingKeys.includes('jobName')) {
        console.log(chalk.dim('  jobName 必须在项目配置 (.daodourc) 中设置'));
      }
      process.exit(1);
    }

    if (this.localConfig.buildParams) {
      if (typeof this.localConfig.buildParams !== 'object') {
        console.log(chalk.red('  ✖ buildParams 必须是对象格式'));
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

    console.log('');
    console.log(chalk.bold('  🔧 刀豆构建工具'));
    console.log(chalk.dim('  ─────────────────────────'));

    // 1. 获取分支名称
    const branch = await this.getBranch(options);

    // 2. 登录 & 认证
    await this.browserAuth.ensureLogin();
    this.setupJenkinsAuth();
    await this.ensureJenkinsSession();

    // 3. 构建参数
    const jobName = this.buildJobName(config);
    const jenkinsUrl = this.buildJobUrl(config, jobName);
    const params = this.buildParams(config, branch);

    console.log('');
    console.log(chalk.dim('  ─────────────────────────'));
    console.log('  ' + chalk.dim('任务') + '  ' + chalk.cyan(jobName));
    console.log('  ' + chalk.dim('分支') + '  ' + chalk.cyan(branch));
    Object.entries(params).forEach(([key, value]) => {
      if (key === 'token' || key === 'GIT_BRANCH') return;
      console.log('  ' + chalk.dim(key) + '  ' + value);
    });
    console.log(chalk.dim('  ─────────────────────────'));
    console.log('');

    // 4. 触发构建
    const buildStartTime = Date.now();
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
    if (options.branch) {
      console.log(chalk.yellow('  ⚠ 使用指定分支 ') + chalk.cyan(options.branch));
      return options.branch;
    }

    const spinner = ora({ text: '检测 Git 分支...', indent: 2 }).start();
    try {
      const branch = await getCurrentBranch();
      spinner.succeed('分支 ' + chalk.cyan(branch));
      return branch;
    } catch (error) {
      spinner.fail('分支检测失败');
      throw new Error(`无法检测 Git 分支: ${error.message}\n  请确保当前目录是 Git 仓库，或使用 --branch 指定`);
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
    const spinner = ora({ text: '验证 Jenkins 会话...', indent: 2 }).start();
    try {
      const resp = await this.axios.get(this.jenkinsConfig.baseUrl);
      if (resp.status === 401 || resp.status === 403) throw new Error('未登录');
      if (resp.status === 302 && resp.headers.location && resp.headers.location.includes('casdoor')) throw new Error('未登录');
      spinner.succeed('认证有效');
      return true;
    } catch (e) {
      // 优先用 Casdoor cookie 静默刷新
      spinner.text = 'Session 已过期，正在刷新...';
      const refreshed = await this.browserAuth.refreshSessionViaCasdoor();
      if (refreshed) {
        this.setupJenkinsAuth();
        spinner.succeed('Session 已刷新');
        return true;
      }
      // Casdoor 也过期，启动浏览器重新登录
      spinner.warn('Session 已过期，需要重新登录');
      await this.browserAuth.login();
      this.setupJenkinsAuth();
      return true;
    }
  }

  async triggerAndMonitorBuild(jobName, params, buildStartTime) {
    const spinner = ora({ text: '触发构建...', indent: 2 }).start();
    try {
      const queueId = await this.triggerBuild(jobName, params);
      spinner.succeed('构建已触发 ' + chalk.dim(`队列 #${queueId}`));
      await this.monitorQueueAndBuild(jobName, queueId, buildStartTime);
    } catch (error) {
      spinner.fail('构建触发失败');
      console.error(chalk.red('  ' + error.message));
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
          console.log(chalk.yellow('  ⚠ 未能获取队列号'));
        }
        return queueId;
      } else {
        throw new Error('触发构建失败');
      }
    } catch (error) {
      throw new Error(`触发构建失败: ${error.message}`);
    }
  }

  async monitorQueueAndBuild(jobName, queueId, buildStartTime) {
    const spinner = ora({ text: '等待分配构建号...', indent: 2 }).start();
    let buildNumber = null;
    let count = 0;
    while (!buildNumber && count < 60) {
      try {
        const response = await this.axios.get(`${this.jenkinsConfig.baseUrl}queue/item/${queueId}/api/json`, {
          timeout: 10000
        });
        const item = response.data;
        if (item.executable && item.executable.number) {
          buildNumber = item.executable.number;
          spinner.succeed('构建号 ' + chalk.cyan(`#${buildNumber}`));
          break;
        }
      } catch (e) {
        // 队列查询失败不影响主流程
      }
      await new Promise(r => setTimeout(r, 2000));
      count++;
    }
    if (!buildNumber) {
      spinner.fail('超时未分配构建号');
      return;
    }
    await this.monitorBuild(jobName, buildNumber, buildStartTime);
  }

  async monitorBuild(jobName, buildNumber, buildStartTime) {
    const formatTime = (ms) => {
      const s = Math.floor(ms / 1000);
      return s >= 60 ? `${Math.floor(s / 60)}m${s % 60}s` : `${s}s`;
    };

    const spinner = ora({
      text: '构建中 ' + chalk.dim('0s'),
      indent: 2,
      spinner: 'dots'
    }).start();

    // 独立定时器刷新计时，不受 API 请求阻塞
    const timer = setInterval(() => {
      spinner.text = '构建中 ' + chalk.dim(formatTime(Date.now() - buildStartTime));
    }, 200);

    let building = true;
    let lastLog = '';
    let lastLogTime = 0;
    try {
      while (building) {
        try {
          const response = await this.axios.get(`${this.jenkinsConfig.baseUrl}job/${encodeURIComponent(jobName)}/${buildNumber}/api/json`, {
            timeout: 10000
          });
          const buildInfo = response.data;
          building = buildInfo.building;

          // 实时输出日志片段
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
                process.stdout.write(chalk.dim(lastLines) + '\n');
                spinner.start();
                lastLog = lastLines;
              }
              lastLogTime = now;
            } catch (logError) {
              // 日志获取失败不影响主流程
            }
          }
          if (!building) {
            clearInterval(timer);
            const total = formatTime(Date.now() - buildStartTime);
            if (buildInfo.result === 'SUCCESS') {
              spinner.succeed(chalk.green('构建成功') + chalk.dim(` ${total}`));
            } else {
              spinner.fail(chalk.red(`构建失败 ${buildInfo.result}`) + chalk.dim(` ${total}`));
            }
            break;
          }
        } catch (e) {
          // 请求失败不影响主流程
        }
        await new Promise(r => setTimeout(r, 500));
      }
    } finally {
      clearInterval(timer);
    }
  }
}

module.exports = new BuildCommand();