/**
 * 微软翻译引擎实现
 * 基于Edge浏览器认证的免费翻译服务
 */
const BaseTranslator = require('../BaseTranslator');
const MicrosoftTranslatorService = require('./services/TranslatorService');
const { LANG_CODES, TEXT_TYPES } = require('./types');

class MicrosoftTranslator extends BaseTranslator {
  constructor(config = {}) {
    super(config);
    this.name = 'Microsoft Translator';
    this.priority = 1; // 最高优先级
    this.intervalLimit = 1000; // 1秒间隔限制
    this.contentLengthLimit = 50000; // 50KB内容长度限制
    
    // 初始化翻译服务
    this.service = new MicrosoftTranslatorService();
  }

  /**
   * 获取翻译器名称
   */
  getName() {
    return this.name;
  }

  /**
   * 获取优先级
   */
  getPriority() {
    return this.priority;
  }

  /**
   * 检查翻译器是否可用
   */
  async isAvailable() {
    try {
      // 尝试获取访问令牌来检查服务是否可用
      await this.service.httpClient.authService.getAccessToken();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 翻译文本
   */
  async translate(text, sourceLang, targetLang, options = {}) {
    if (!text || !targetLang) {
      throw new Error('文本和目标语言不能为空');
    }

    return await this.withRetry(async () => {
      // 语言代码转换
      const msSourceLang = this.convertLangCode(sourceLang);
      const msTargetLang = this.convertLangCode(targetLang);
      
      // 执行翻译
      const result = await this.service.translate(text, msSourceLang, msTargetLang, TEXT_TYPES.PLAIN);
      
      if (!result || !result.translations || result.translations.length === 0) {
        throw new Error('翻译结果为空');
      }

      const translation = result.translations[0];
      const detectedLang = result.detectedLanguage?.language || sourceLang;
      
      return {
        text: translation.text || text,
        sourceLang: detectedLang,
        targetLang: targetLang,
        engine: this.name,
        success: true,
        confidence: translation.confidence || 1.0,
        alternatives: []
      };
    });
  }

  /**
   * 翻译HTML文档
   */
  async translateHtml(htmlContent, sourceLang, targetLang, options = {}) {
    if (!htmlContent || !targetLang) {
      throw new Error('HTML内容和目标语言不能为空');
    }

    return await this.withRetry(async () => {
      // 语言代码转换
      const msSourceLang = this.convertLangCode(sourceLang);
      const msTargetLang = this.convertLangCode(targetLang);
      
      // 执行HTML翻译
      const result = await this.service.translate(htmlContent, msSourceLang, msTargetLang, TEXT_TYPES.HTML);
      
      if (!result || !result.translations || result.translations.length === 0) {
        throw new Error('HTML翻译结果为空');
      }

      const translation = result.translations[0];
      const detectedLang = result.detectedLanguage?.language || sourceLang;
      
      return {
        text: translation.text || htmlContent,
        sourceLang: detectedLang,
        targetLang: targetLang,
        engine: this.name,
        success: true,
        confidence: translation.confidence || 1.0,
        alternatives: []
      };
    });
  }

  /**
   * 获取支持的语言列表
   */
  async getSupportedLanguages() {
    try {
      const languages = await this.service.getSupportedLanguages();
      return Object.keys(languages);
    } catch (error) {
      // 返回默认支持的语言列表
      return Object.values(LANG_CODES);
    }
  }

  /**
   * 语言代码转换
   * 将标准语言代码转换为微软翻译API支持的语言代码
   */
  convertLangCode(langCode) {
    const langMap = {
      'zh': LANG_CODES.CHINESE_SIMPLIFIED,
      'zh-CN': LANG_CODES.CHINESE_SIMPLIFIED,
      'zh-TW': LANG_CODES.CHINESE_TRADITIONAL,
      'en': LANG_CODES.ENGLISH,
      'ja': LANG_CODES.JAPANESE,
      'ko': LANG_CODES.KOREAN,
      'fr': LANG_CODES.FRENCH,
      'de': LANG_CODES.GERMAN,
      'es': LANG_CODES.SPANISH,
      'it': LANG_CODES.ITALIAN,
      'pt': LANG_CODES.PORTUGUESE,
      'ru': LANG_CODES.RUSSIAN,
      'ar': LANG_CODES.ARABIC,
      'th': LANG_CODES.THAI,
      'vi': LANG_CODES.VIETNAMESE,
      'auto': LANG_CODES.AUTO
    };

    return langMap[langCode] || langCode;
  }

  /**
   * 翻译文档
   */
  async translateDocumentation(text, sourceLang, targetLang, options = {}) {
    try {
      const msSourceLang = this.convertLangCode(sourceLang);
      const msTargetLang = this.convertLangCode(targetLang);
      
      const result = await this.service.translate(text, msSourceLang, msTargetLang, TEXT_TYPES.HTML);
      
      if (!result || !result.translations || result.translations.length === 0) {
        throw new Error('文档翻译结果为空');
      }

      const translation = result.translations[0];
      const detectedLang = result.detectedLanguage?.language || sourceLang;
      
      return {
        text: translation.text || text,
        sourceLang: detectedLang,
        targetLang: targetLang,
        engine: this.name,
        success: true,
        confidence: translation.confidence || 1.0,
        alternatives: []
      };
    } catch (error) {
      throw new Error(`微软翻译文档失败: ${error.message}`);
    }
  }
}

module.exports = MicrosoftTranslator;
