const puppeteer = require('puppeteer');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const os = require('os');
const axios = require('axios');
const ora = require('ora');
const { ConfigManager } = require('./config');

// 配置管理器
const configManager = new ConfigManager();

class BrowserAuth {
  constructor() {
    this.config = configManager.getBuildConfig();
    this.jenkinsUrl = this.config.jenkinsUrl;
    this.username = this.config.jenkinsUsername;
    this.password = this.config.jenkinsPassword;
    this.cookies = null;       // Jenkins 域名的 cookies
    this.allCookies = null;    // 所有域名的 cookies（含 Casdoor）
  }

  /**
   * 启动浏览器并登录Jenkins
   */
  async login() {
    const spinner = ora({ text: '正在登录 Jenkins...', indent: 2 }).start();
    try {
      // 验证 Jenkins URL
      if (!this.jenkinsUrl || this.jenkinsUrl === 'your-jenkins-url') {
        throw new Error('Jenkins URL 未配置或为模板值，请检查 .daodourc 文件');
      }

      this.browser = await puppeteer.launch({
        headless: true,
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

      spinner.text = '正在访问 Jenkins...';
      await this.page.goto(this.jenkinsUrl, { waitUntil: 'networkidle2', timeout: 30000 });

      // 检查是否跳转到Casdoor登录页
      if (this.page.url().includes('casdoor')) {
        spinner.text = '正在通过 Casdoor 认证...';
        await this.page.waitForSelector('input[name="username"], input[type="text"]', { timeout: 10000 });
        await this.page.type('input[name="username"], input[type="text"]', this.username, {delay: 50});
        await this.page.type('input[name="password"], input[type="password"]', this.password, {delay: 50});
        // 勾选"记住我"，延长 session 有效期
        try {
          const rememberCheckbox = await this.page.$('input[name="autoSignin"], input[name="remember"], input[name="rememberMe"], .ant-checkbox-input, input[type="checkbox"]');
          if (rememberCheckbox) {
            const isChecked = await rememberCheckbox.evaluate(el => el.checked);
            if (!isChecked) {
              await rememberCheckbox.click();
            }
          }
        } catch (e) {
          // 找不到记住我选项不影响登录
        }
        await Promise.all([
          this.page.click('button[type="submit"], input[type="submit"], .login-button'),
          this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 })
        ]);
      }

      // 检查是否成功跳转到Jenkins
      if (this.page.url().includes(this.jenkinsUrl)) {
        // 通过 CDP 获取所有域名的 cookies（含 Casdoor 的长期 cookie）
        const client = await this.page.target().createCDPSession();
        const { cookies: allCookies } = await client.send('Network.getAllCookies');
        this.allCookies = allCookies;
        const jenkinsHost = new URL(this.jenkinsUrl).hostname;
        this.cookies = allCookies.filter(c => c.domain.includes(jenkinsHost));
        await this.saveCookies();
        await this.browser.close();
        spinner.succeed('登录成功');
        return true;
      } else {
        await this.browser.close();
        throw new Error('登录失败，未跳转回 Jenkins');
      }
    } catch (error) {
      if (this.browser) await this.browser.close();
      spinner.fail('登录失败 ' + chalk.dim(error.message));
      throw error;
    }
  }

  /**
   * 保存 cookies 到本地
   */
  async saveCookies() {
    const dir = path.join(os.homedir(), '.daodou');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    // 保存所有域名的 cookies
    const file = path.join(dir, 'cookies.json');
    fs.writeFileSync(file, JSON.stringify({
      jenkins: this.cookies,
      all: this.allCookies || this.cookies
    }, null, 2));
  }

  /**
   * 加载本地 cookies
   */
  loadCookies() {
    const file = path.join(os.homedir(), '.daodou', 'cookies.json');
    if (fs.existsSync(file)) {
      const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
      // 兼容旧格式（纯数组）
      if (Array.isArray(data)) {
        this.cookies = data;
        this.allCookies = data;
      } else {
        this.cookies = data.jenkins || [];
        this.allCookies = data.all || data.jenkins || [];
      }
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
    const jenkinsHost = new URL(this.jenkinsUrl).hostname;
    setCookies.forEach(str => {
      // 简单解析：取第一个分号前的部分作为 name=value
      const firstPart = str.split(';')[0];
      const [rawName, ...valueParts] = firstPart.split('=');
      const name = rawName.trim();
      const value = valueParts.join('=').trim();

      if (name && value) {
        // 更新 jenkins cookies
        const index = this.cookies.findIndex(c => c.name === name);
        if (index !== -1) {
          if (this.cookies[index].value !== value) {
            this.cookies[index].value = value;
            changed = true;
          }
        } else {
          this.cookies.push({ name, value, domain: jenkinsHost, path: '/' });
          changed = true;
        }
        // 同步更新 allCookies 中对应的 Jenkins cookie
        if (this.allCookies) {
          const allIdx = this.allCookies.findIndex(c => c.name === name && c.domain.includes(jenkinsHost));
          if (allIdx !== -1) {
            this.allCookies[allIdx].value = value;
          } else {
            this.allCookies.push({ name, value, domain: jenkinsHost, path: '/' });
          }
        }
      }
    });

    if (changed) {
      await this.saveCookies();
    }
  }

  /**
   * 获取 Cookie 字符串（Jenkins 域名）
   */
  getCookieString() {
    if (!this.cookies) return '';
    return this.cookies.map(c => `${c.name}=${c.value}`).join('; ');
  }

  /**
   * 获取指定域名的 Cookie 字符串
   */
  getCookieStringForDomain(domain) {
    if (!this.allCookies) return '';
    return this.allCookies
      .filter(c => domain.includes(c.domain.replace(/^\./, '')))
      .map(c => `${c.name}=${c.value}`)
      .join('; ');
  }

  /**
   * 用 Casdoor cookie 走 SSO 重定向刷新 Jenkins session（无需启动浏览器）
   * @returns {boolean} 是否刷新成功
   */
  async refreshSessionViaCasdoor() {
    if (!this.allCookies || this.allCookies.length === 0) return false;

    try {
      // 1. 访问 Jenkins，期望 302 跳转到 Casdoor
      const resp1 = await axios.get(this.jenkinsUrl, {
        maxRedirects: 0,
        validateStatus: s => s === 302 || s === 301,
        headers: {
          Cookie: this.getCookieString(),
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
      }).catch(e => e.response);

      if (!resp1 || !resp1.headers.location) return false;
      const casdoorUrl = resp1.headers.location;
      if (!casdoorUrl.includes('casdoor')) return false;

      // 2. 带 Casdoor cookie 访问授权页，期望自动跳回 Jenkins
      const casdoorDomain = new URL(casdoorUrl).hostname;
      const casdoorCookieStr = this.getCookieStringForDomain(casdoorDomain);
      if (!casdoorCookieStr) return false;

      const resp2 = await axios.get(casdoorUrl, {
        maxRedirects: 0,
        validateStatus: s => s === 302 || s === 301,
        headers: {
          Cookie: casdoorCookieStr,
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
      }).catch(e => e.response);

      if (!resp2 || !resp2.headers.location) return false;
      const callbackUrl = resp2.headers.location;

      // 收集 Casdoor 返回的 set-cookie
      const casdoorSetCookies = resp2.headers['set-cookie'] || [];

      // 3. 跟随回调 URL 到 Jenkins，收集所有重定向中的 Set-Cookie
      let currentUrl = callbackUrl;
      let allSetCookies = [];
      for (let i = 0; i < 5; i++) { // 最多跟随 5 次重定向
        const resp = await axios.get(currentUrl, {
          maxRedirects: 0,
          validateStatus: s => s < 400 || s === 302 || s === 301,
          headers: {
            Cookie: this.getCookieString(),
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
          }
        }).catch(e => e.response);

        if (!resp) return false;
        if (resp.headers['set-cookie']) {
          allSetCookies = allSetCookies.concat(resp.headers['set-cookie']);
          // 实时更新 cookies，后续重定向用新 cookie
          await this.updateCookiesFromSetCookie(resp.headers['set-cookie']);
        }
        if ((resp.status === 302 || resp.status === 301) && resp.headers.location) {
          currentUrl = resp.headers.location;
          // 相对路径补全
          if (currentUrl.startsWith('/')) {
            const base = new URL(this.jenkinsUrl);
            currentUrl = `${base.protocol}//${base.host}${currentUrl}`;
          }
        } else {
          break; // 非重定向，结束
        }
      }

      if (allSetCookies.length === 0) return false;

      // 4. 更新 Casdoor cookies
      if (casdoorSetCookies.length > 0) {
        this._updateAllCookiesFromSetCookie(casdoorSetCookies, casdoorDomain);
      }
      // 同步 Jenkins cookie 到 allCookies 并持久化
      await this._syncAndSave();

      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * 更新 allCookies 中指定域名的 cookie
   */
  _updateAllCookiesFromSetCookie(setCookies, domain) {
    if (!setCookies || !this.allCookies) return;
    setCookies.forEach(str => {
      const firstPart = str.split(';')[0];
      const [rawName, ...valueParts] = firstPart.split('=');
      const name = rawName.trim();
      const value = valueParts.join('=').trim();
      if (name && value) {
        const index = this.allCookies.findIndex(c => c.name === name && c.domain.includes(domain));
        if (index !== -1) {
          this.allCookies[index].value = value;
        } else {
          this.allCookies.push({ name, value, domain, path: '/' });
        }
      }
    });
  }

  /**
   * 将 jenkins cookies 同步到 allCookies 并持久化
   */
  async _syncAndSave() {
    if (!this.allCookies) this.allCookies = [];
    const jenkinsHost = new URL(this.jenkinsUrl).hostname;
    // 用最新的 jenkins cookies 覆盖 allCookies 中对应的条目
    for (const jc of this.cookies) {
      const idx = this.allCookies.findIndex(c => c.name === jc.name && c.domain.includes(jenkinsHost));
      if (idx !== -1) {
        this.allCookies[idx] = jc;
      } else {
        this.allCookies.push(jc);
      }
    }
    await this.saveCookies();
  }

  async ensureLogin() {
    if (this.loadCookies()) {
      return;
    }
    await this.login();
  }
}

module.exports = {
  BrowserAuth
}; 