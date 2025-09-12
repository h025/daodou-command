const { translate } = require('@vitalets/google-translate-api');
const chalk = require('chalk');
const ProxyManager = require('./proxy-manager');

/**
 * 翻译服务类
 * 处理 Google Translate API 调用和重试机制
 */
class TranslationService {
  constructor() {
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1秒
    this.proxyManager = new ProxyManager();
    this.currentProxy = null;
  }

  /**
   * 翻译文本（支持多代理轮换）
   * @param {string} text - 要翻译的文本
   * @param {string} targetLang - 目标语言代码
   * @param {string} sourceLang - 源语言代码，默认为 'en'
   * @returns {Promise<{success: boolean, result: string, error: string}>}
   */
  async translateText(text, targetLang, sourceLang = 'en') {
    console.log(chalk.blue(`  🌐 步骤 2/4: 开始翻译 "${text}"...`));
    
    // 首先尝试直连（不使用代理）
    console.log(chalk.gray(`  🔗 尝试直连翻译...`));
    try {
      const result = await translate(text, {
        from: sourceLang,
        to: targetLang
      });

      console.log(chalk.green(`  🔄 步骤 3/4: 翻译完成 "${text}" -> "${result.text}"`));
      
      return {
        success: true,
        result: result.text,
        error: null
      };
    } catch (error) {
      console.log(chalk.yellow(`  ⚠️ 直连失败: ${error.message}`));
      console.log(chalk.blue(`  🔄 开始使用代理轮换...`));
    }

    // 直连失败，开始代理轮换
    const availableProxies = await this.proxyManager.getAvailableProxies();
    
    if (availableProxies.length === 0) {
      console.log(chalk.red(`  ❌ 没有可用的代理服务器`));
      return {
        success: false,
        result: null,
        error: '没有可用的代理服务器'
      };
    }

    // 轮询所有可用代理
    let proxyIndex = 0;
    while (proxyIndex < availableProxies.length) {
      const proxy = availableProxies[proxyIndex];
      const remainingProxies = this.proxyManager.getAvailableProxyCount();
      
      console.log(chalk.gray(`  🔗 使用代理: ${proxy.ip}:${proxy.port} (${proxy.country}) [${proxyIndex + 1}/${availableProxies.length}] (剩余: ${remainingProxies})`));
      
      // 对每个代理尝试3次
      let proxySuccess = false;
      for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
        try {
          const agent = this.proxyManager.createProxyAgent(proxy);
          if (!agent) {
            console.log(chalk.red(`  ❌ 创建代理代理失败`));
            break;
          }
          
          const result = await translate(text, {
            from: sourceLang,
            to: targetLang,
            fetchOptions: { agent }
          });

          console.log(chalk.green(`  🔄 步骤 3/4: 翻译完成 "${text}" -> "${result.text}"`));
          
          return {
            success: true,
            result: result.text,
            error: null
          };

        } catch (error) {
          console.log(chalk.red(`  ❌ 代理 ${proxy.ip}:${proxy.port} 失败 (${attempt}/${this.maxRetries}): ${error.message}`));
          
          if (attempt < this.maxRetries) {
            await this.delay(this.retryDelay * attempt);
          }
        }
      }
      
      // 如果这个代理3次都失败了，标记为失败并从列表中移除
      if (!proxySuccess) {
        console.log(chalk.yellow(`  ⚠️ 代理 ${proxy.ip}:${proxy.port} 已失败3次，从列表中移除`));
        this.proxyManager.markProxyFailed(proxy.url);
        
        // 检查是否还有可用代理
        if (!this.proxyManager.hasAvailableProxies()) {
          console.log(chalk.red(`  ❌ 所有代理都已失败，无法继续翻译`));
          break;
        }
        
        // 重新获取可用代理列表（因为可能有代理被移除）
        const newAvailableProxies = await this.proxyManager.getAvailableProxies();
        if (newAvailableProxies.length === 0) {
          console.log(chalk.red(`  ❌ 没有可用的代理服务器`));
          break;
        }
        
        // 更新可用代理列表
        availableProxies.length = 0;
        availableProxies.push(...newAvailableProxies);
      }
      
      proxyIndex++;
    }

    // 所有代理都失败了
    console.log(chalk.red(`  ❌ 所有代理都失败了，跳过该语言`));
    return {
      success: false,
      result: null,
      error: '所有代理都失败了'
    };
  }

  /**
   * 延迟函数
   * @param {number} ms - 延迟毫秒数
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 检查是否为默认语言
   * @param {string} lang - 语言代码
   * @param {string} defaultLang - 默认语言代码
   * @returns {boolean}
   */
  isDefaultLanguage(lang, defaultLang) {
    return lang === defaultLang;
  }

  /**
   * 获取语言显示名称
   * @param {string} langCode - 语言代码
   * @returns {string}
   */
  getLanguageDisplayName(langCode) {
    const languageNames = {
      'en': 'English',
      'zh': '中文',
      'ja': '日本語',
      'fr': 'Français',
      'de': 'Deutsch',
      'es': 'Español',
      'it': 'Italiano',
      'pt': 'Português',
      'ru': 'Русский',
      'ko': '한국어',
      'ar': 'العربية',
      'hi': 'हिन्दी'
    };
    
    return languageNames[langCode] || langCode.toUpperCase();
  }

  /**
   * 获取代理统计信息
   * @returns {Object} 统计信息
   */
  getProxyStats() {
    return this.proxyManager.getStats();
  }

  /**
   * 显示代理统计信息
   */
  showProxyStats() {
    const stats = this.getProxyStats();
    console.log(chalk.blue('\n📊 代理服务器统计:'));
    console.log(chalk.gray(`  总代理数: ${stats.totalProxies}`));
    console.log(chalk.green(`  可用代理: ${stats.availableProxies}`));
    console.log(chalk.red(`  失败代理: ${stats.failedProxies}`));
    console.log(chalk.gray(`  缓存文件: ${stats.cacheFile}`));
    console.log(chalk.gray(`  失败代理文件: ${stats.failedProxiesFile}`));
  }
}

module.exports = TranslationService;
