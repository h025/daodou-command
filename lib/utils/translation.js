const chalk = require('chalk');
const { TranslationService: NewTranslationService } = require('../translation');

/**
 * 翻译服务类（兼容性包装器）
 * 使用新的多引擎翻译架构，微软优先，Google备用
 */
class TranslationService {
  constructor() {
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1秒
    this.translationService = new NewTranslationService();
  }

  /**
   * 翻译文本（使用新的多引擎架构）
   * @param {string} text - 要翻译的文本
   * @param {string} targetLang - 目标语言代码
   * @param {string} sourceLang - 源语言代码，默认为 'en'
   * @returns {Promise<{success: boolean, result: string, error: string}>}
   */
  async translateText(text, targetLang, sourceLang = 'en') {
    try {
      const result = await this.translationService.translate(text, sourceLang, targetLang);
      return {
        success: true,
        result: result.text,
        error: null
      };
    } catch (error) {
      return {
        success: false,
        result: null,
        error: error.message
      };
    }
  }

  /**
   * 翻译HTML文档（使用新的多引擎架构）
   * @param {string} htmlContent - 要翻译的HTML内容
   * @param {string} targetLang - 目标语言代码
   * @param {string} sourceLang - 源语言代码，默认为 'en'
   * @returns {Promise<{success: boolean, result: string, error: string}>}
   */
  async translateHtml(htmlContent, targetLang, sourceLang = 'en') {
    try {
      const result = await this.translationService.translateHtml(htmlContent, sourceLang, targetLang);
      return {
        success: true,
        result: result.text,
        error: null
      };
    } catch (error) {
      return {
        success: false,
        result: null,
        error: error.message
      };
    }
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
   * 获取引擎状态
   * @returns {Promise<Array>} 引擎状态列表
   */
  async getEngineStatus() {
    return await this.translationService.getEngineStatus();
  }

  /**
   * 显示引擎状态
   */
  async showEngineStatus() {
    const status = await this.getEngineStatus();
    console.log('');
    console.log(chalk.dim('  翻译引擎状态:'));
    status.forEach(engine => {
      const icon = engine.available ? chalk.green('✔') : chalk.red('✖');
      console.log(`  ${icon} ${engine.name} ${chalk.dim(`(优先级 ${engine.priority})`)}`);
    });
  }
}

module.exports = TranslationService;
