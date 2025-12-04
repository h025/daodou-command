const puppeteer = require('puppeteer');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { ConfigManager } = require('./config');

// 配置管理器
const configManager = new ConfigManager();

class BrowserAuth {
  constructor() {
    this.config = configManager.getBuildConfig();
    this.jenkinsUrl = this.config.jenkinsUrl;
    this.username = this.config.jenkinsUsername;
    this.password = this.config.jenkinsPassword;
    this.cookies = null;
  }

  /**
   * 启动浏览器并登录Jenkins
   */
  async login() {
    try {
      console.log(chalk.blue('🌐 启动浏览器...'));
      
      // 验证 Jenkins URL
      if (!this.jenkinsUrl || this.jenkinsUrl === 'your-jenkins-url') {
        throw new Error('Jenkins URL 未配置或为模板值，请检查 .daodourc 文件');
      }
      
      this.browser = await puppeteer.launch({ 
        headless: true,
        // 移除硬编码路径，让 Puppeteer 自动查找
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      });
      this.page = await this.browser.newPage();
      await this.page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      console.log(chalk.blue('🔗 访问Jenkins首页...'));
      console.log(chalk.gray(`   目标URL: ${this.jenkinsUrl}`));
      await this.page.goto(this.jenkinsUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      console.log(chalk.green(`✅ 当前页面: ${this.page.url()}`));

      // 检查是否跳转到Casdoor登录页
      if (this.page.url().includes('casdoor')) {
        console.log(chalk.yellow('📋 检测到Casdoor登录页，自动填写登录信息...'));
        // 等待用户名输入框
        await this.page.waitForSelector('input[name="username"], input[type="text"]', { timeout: 10000 });
        // 填写用户名
        await this.page.type('input[name="username"], input[type="text"]', this.username, {delay: 50});
        // 填写密码
        await this.page.type('input[name="password"], input[type="password"]', this.password, {delay: 50});
        // 点击登录按钮
        await Promise.all([
          this.page.click('button[type="submit"], input[type="submit"], .login-button'),
          this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 })
        ]);
        console.log(chalk.green(`✅ 登录表单已提交，当前页面: ${this.page.url()}`));
      }

      // 检查是否成功跳转到Jenkins
      if (this.page.url().includes(this.jenkinsUrl)) {
        console.log(chalk.green('🎉 Jenkins登录成功！'));
        // 获取cookies
        this.cookies = await this.page.cookies();
        await this.saveCookies();
        await this.browser.close();
        return true;
      } else {
        console.log(chalk.red('❌ 登录失败，当前页面:'), this.page.url());
        await this.browser.close();
        throw new Error('自动登录失败，未跳转回Jenkins');
      }
    } catch (error) {
      console.error(chalk.red('Jenkins自动登录失败:'), error.message);
      if (this.browser) await this.browser.close();
      throw error;
    }
  }

  /**
   * 保存 cookies 到本地
   */
  async saveCookies() {
    const dir = path.join(os.homedir(), '.daodou');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    const file = path.join(dir, 'cookies.json');
    fs.writeFileSync(file, JSON.stringify(this.cookies, null, 2));
  }

  /**
   * 加载本地 cookies
   */
  loadCookies() {
    const file = path.join(os.homedir(), '.daodou', 'cookies.json');
    if (fs.existsSync(file)) {
      this.cookies = JSON.parse(fs.readFileSync(file, 'utf-8'));
      return true;
    }
    return false;
  }

  /**
   * 从 set-cookie 更新 cookies
   * @param {Array<string>} setCookies 响应头中的 set-cookie 数组
   */
  async updateCookiesFromSetCookie(setCookies) {
    if (!setCookies || !Array.isArray(setCookies)) return;

    if (!this.cookies) this.cookies = [];

    let changed = false;
    setCookies.forEach(str => {
      // 简单解析：取第一个分号前的部分作为 name=value
      const firstPart = str.split(';')[0];
      const [name, ...valueParts] = firstPart.split('=');
      const value = valueParts.join('=');
      
      if (name && value) {
        const index = this.cookies.findIndex(c => c.name === name);
        if (index !== -1) {
          if (this.cookies[index].value !== value) {
            this.cookies[index].value = value;
            changed = true;
          }
        } else {
          this.cookies.push({
            name,
            value,
            domain: new URL(this.jenkinsUrl).hostname,
            path: '/'
          });
          changed = true;
        }
      }
    });

    if (changed) {
      await this.saveCookies();
    }
  }

  /**
   * 获取 Cookie 字符串
   */
  getCookieString() {
    if (!this.cookies) return '';
    return this.cookies.map(c => `${c.name}=${c.value}`).join('; ');
  }

  async ensureLogin() {
    if (this.loadCookies()) {
      console.log(chalk.green('✅ 已加载保存的cookies'));
      return;
    }
    await this.login();
  }
}

module.exports = {
  BrowserAuth
}; 