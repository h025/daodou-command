const axios = require('axios');
const cheerio = require('cheerio');
const { HttpProxyAgent } = require('http-proxy-agent');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { ConfigManager } = require('./config');

/**
 * 代理管理器类
 * 从 free-proxy-list.net 获取代理列表并实现轮换
 */
class ProxyManager {
  constructor() {
    this.proxies = [];
    this.currentIndex = 0;
    this.failedProxies = new Set();
    this.lastFetchTime = 0;
    this.fetchInterval = 30 * 60 * 1000; // 30分钟更新一次
    
    // 缓存文件路径
    this.cacheDir = path.join(os.homedir(), '.daodou');
    this.cacheFile = path.join(this.cacheDir, 'proxy-cache.json');
    this.failedProxiesFile = path.join(this.cacheDir, 'failed-proxies.json');
    
    // 配置管理器
    this.configManager = new ConfigManager();
    this.config = this.configManager.getLangConfig();
    
    // 确保缓存目录存在
    this.ensureCacheDir();
  }

  /**
   * 获取代理列表URL
   */
  getProxyListUrl() {
    return this.config?.proxyListUrl || 'https://free-proxy-list.net/';
  }

  /**
   * 获取代理测试URL
   */
  getProxyTestUrl() {
    return this.config?.proxyTestUrl || 'https://httpbin.org/ip';
  }

  /**
   * 确保缓存目录存在
   */
  ensureCacheDir() {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  /**
   * 从缓存文件加载代理列表
   * @returns {Promise<Array>} 代理列表
   */
  async loadFromCache() {
    try {
      if (!fs.existsSync(this.cacheFile)) {
        return [];
      }

      const cacheData = JSON.parse(fs.readFileSync(this.cacheFile, 'utf8'));
      const now = Date.now();
      
      // 检查缓存是否过期
      if (now - cacheData.timestamp > this.fetchInterval) {
        console.log(chalk.yellow('⚠️ 代理缓存已过期，需要重新获取'));
        return [];
      }

      console.log(chalk.blue(`📁 从缓存加载 ${cacheData.proxies.length} 个代理服务器`));
      return cacheData.proxies || [];
    } catch (error) {
      console.log(chalk.red(`❌ 加载代理缓存失败: ${error.message}`));
      return [];
    }
  }

  /**
   * 保存代理列表到缓存文件
   * @param {Array} proxies 代理列表
   */
  async saveToCache(proxies) {
    try {
      const cacheData = {
        timestamp: Date.now(),
        proxies: proxies
      };
      
      fs.writeFileSync(this.cacheFile, JSON.stringify(cacheData, null, 2));
      console.log(chalk.green(`💾 已缓存 ${proxies.length} 个代理服务器到 ${this.cacheFile}`));
    } catch (error) {
      console.log(chalk.red(`❌ 保存代理缓存失败: ${error.message}`));
    }
  }

  /**
   * 从缓存文件加载失败的代理列表
   */
  loadFailedProxies() {
    try {
      if (!fs.existsSync(this.failedProxiesFile)) {
        return new Set();
      }

      const failedProxies = JSON.parse(fs.readFileSync(this.failedProxiesFile, 'utf8'));
      return new Set(failedProxies || []);
    } catch (error) {
      console.log(chalk.red(`❌ 加载失败代理列表失败: ${error.message}`));
      return new Set();
    }
  }

  /**
   * 保存失败的代理列表到缓存文件
   */
  saveFailedProxies() {
    try {
      const failedProxies = Array.from(this.failedProxies);
      fs.writeFileSync(this.failedProxiesFile, JSON.stringify(failedProxies, null, 2));
    } catch (error) {
      console.log(chalk.red(`❌ 保存失败代理列表失败: ${error.message}`));
    }
  }

  /**
   * 从 free-proxy-list.net 获取代理列表
   * @returns {Promise<Array>} 代理列表
   */
  async fetchProxies() {
    try {
      console.log(chalk.blue('🔍 正在获取代理服务器列表...'));
      
      const response = await axios.get(this.getProxyListUrl(), {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });

      const $ = cheerio.load(response.data);
      const proxies = [];

      // 解析表格数据
      $('table.table-striped tbody tr').each((index, element) => {
        const $row = $(element);
        const cells = $row.find('td');
        
        if (cells.length >= 8) {
          const ip = $(cells[0]).text().trim();
          const port = $(cells[1]).text().trim();
          const code = $(cells[2]).text().trim();
          const country = $(cells[3]).text().trim();
          const anonymity = $(cells[4]).text().trim();
          const google = $(cells[5]).text().trim();
          const https = $(cells[6]).text().trim();
          const lastChecked = $(cells[7]).text().trim();

          // 过滤条件：Anonymity = "anonymous" 且 Google ≠ "no"
          if (anonymity === 'anonymous' && google !== 'no') {
            proxies.push({
              ip,
              port: parseInt(port),
              code,
              country,
              anonymity,
              google,
              https: https === 'yes',
              lastChecked,
              url: `http://${ip}:${port}`
            });
          }
        }
      });

      console.log(chalk.green(`✅ 获取到 ${proxies.length} 个符合条件的代理服务器`));
      
      // 保存到缓存
      await this.saveToCache(proxies);
      
      return proxies;

    } catch (error) {
      console.log(chalk.red(`❌ 获取代理列表失败: ${error.message}`));
      return [];
    }
  }

  /**
   * 获取可用的代理列表
   * @returns {Promise<Array>} 可用的代理列表
   */
  async getAvailableProxies() {
    // 如果代理列表为空，尝试从缓存加载
    if (this.proxies.length === 0) {
      this.proxies = await this.loadFromCache();
      this.failedProxies = this.loadFailedProxies();
    }

    // 如果缓存中没有代理或缓存为空，重新获取
    if (this.proxies.length === 0) {
      this.proxies = await this.fetchProxies();
      this.failedProxies.clear();
    }

    // 过滤掉失败的代理
    const availableProxies = this.proxies.filter(proxy => 
      !this.failedProxies.has(proxy.url)
    );

    return availableProxies;
  }

  /**
   * 获取下一个可用的代理
   * @returns {Promise<Object|null>} 代理对象或null
   */
  async getNextProxy() {
    const availableProxies = await this.getAvailableProxies();
    
    if (availableProxies.length === 0) {
      console.log(chalk.yellow('⚠️ 没有可用的代理服务器'));
      return null;
    }

    // 轮换选择代理
    const proxy = availableProxies[this.currentIndex % availableProxies.length];
    this.currentIndex++;

    return proxy;
  }

  /**
   * 标记代理为失败
   * @param {string} proxyUrl 代理URL
   */
  markProxyFailed(proxyUrl) {
    this.failedProxies.add(proxyUrl);
    
    // 从代理列表中移除失败的代理
    this.proxies = this.proxies.filter(proxy => proxy.url !== proxyUrl);
    
    // 保存失败代理列表和更新后的代理列表
    this.saveFailedProxies();
    this.saveToCache(this.proxies);
    
    console.log(chalk.yellow(`⚠️ 代理 ${proxyUrl} 已从列表中移除`));
  }

  /**
   * 创建代理代理
   * @param {Object} proxy 代理对象
   * @returns {HttpProxyAgent} 代理代理
   */
  createProxyAgent(proxy) {
    if (!proxy) return null;
    
    try {
      return new HttpProxyAgent(proxy.url);
    } catch (error) {
      console.log(chalk.red(`❌ 创建代理代理失败: ${error.message}`));
      return null;
    }
  }

  /**
   * 测试代理是否可用
   * @param {Object} proxy 代理对象
   * @returns {Promise<boolean>} 是否可用
   */
  async testProxy(proxy) {
    if (!proxy) return false;

    try {
      const agent = this.createProxyAgent(proxy);
      if (!agent) return false;

      const response = await axios.get(this.getProxyTestUrl(), {
        httpAgent: agent,
        httpsAgent: agent,
        timeout: 5000
      });

      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  /**
   * 获取统计信息
   * @returns {Object} 统计信息
   */
  getStats() {
    return {
      totalProxies: this.proxies.length,
      failedProxies: this.failedProxies.size,
      availableProxies: this.proxies.length - this.failedProxies.size,
      currentIndex: this.currentIndex,
      cacheFile: this.cacheFile,
      failedProxiesFile: this.failedProxiesFile
    };
  }

  /**
   * 清理缓存文件
   */
  clearCache() {
    try {
      if (fs.existsSync(this.cacheFile)) {
        fs.unlinkSync(this.cacheFile);
        console.log(chalk.green(`🗑️ 已清理代理缓存文件: ${this.cacheFile}`));
      }
      if (fs.existsSync(this.failedProxiesFile)) {
        fs.unlinkSync(this.failedProxiesFile);
        console.log(chalk.green(`🗑️ 已清理失败代理缓存文件: ${this.failedProxiesFile}`));
      }
    } catch (error) {
      console.log(chalk.red(`❌ 清理缓存失败: ${error.message}`));
    }
  }

  /**
   * 强制刷新代理列表（忽略缓存）
   * @returns {Promise<Array>} 新的代理列表
   */
  async forceRefresh() {
    console.log(chalk.blue('🔄 强制刷新代理列表...'));
    this.proxies = await this.fetchProxies();
    this.failedProxies.clear();
    this.currentIndex = 0;
    return this.proxies;
  }

  /**
   * 检查是否还有可用代理
   * @returns {boolean} 是否还有可用代理
   */
  hasAvailableProxies() {
    const availableProxies = this.proxies.filter(proxy => 
      !this.failedProxies.has(proxy.url)
    );
    return availableProxies.length > 0;
  }

  /**
   * 获取可用代理数量
   * @returns {number} 可用代理数量
   */
  getAvailableProxyCount() {
    const availableProxies = this.proxies.filter(proxy => 
      !this.failedProxies.has(proxy.url)
    );
    return availableProxies.length;
  }
}

module.exports = ProxyManager;
