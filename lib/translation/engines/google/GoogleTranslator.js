/**
 * Google翻译引擎实现
 * 基于Google Translate Web API的免费翻译服务
 */
const BaseTranslator = require('../BaseTranslator');
const axios = require('axios');
const crypto = require('crypto');

class GoogleTranslator extends BaseTranslator {
  constructor(config = {}) {
    super(config);
    this.name = 'Google Translator';
    this.priority = 2;
    this.intervalLimit = 1000; // 1秒间隔限制
    this.contentLengthLimit = 5000; // 5KB内容长度限制
    
    // Google Translate API配置
    this.baseUrl = 'https://translate.googleapis.com/translate_a/single';
    this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
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
      // 尝试翻译一个简单的测试文本
      const testResult = await this.translate('hello', 'en', 'zh');
      return testResult && testResult.success;
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
      try {
        // 语言代码转换
        const googleSourceLang = this.convertLangCode(sourceLang);
        const googleTargetLang = this.convertLangCode(targetLang);
        
        // 构建请求参数
        const params = {
          client: 'gtx',
          sl: googleSourceLang,
          tl: googleTargetLang,
          dt: 't',
          q: text
        };

        // 发送请求
        const response = await axios.get(this.baseUrl, {
          params,
          headers: {
            'User-Agent': this.userAgent,
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Referer': 'https://translate.google.com/'
          },
          timeout: 10000
        });

        if (!response.data || !Array.isArray(response.data)) {
          throw new Error('Google翻译返回数据格式错误');
        }

        const result = response.data[0];
        if (!result || !Array.isArray(result)) {
          throw new Error('Google翻译结果为空');
        }

        // 提取翻译结果
        let translatedText = '';
        let detectedLang = sourceLang;
        
        for (const item of result) {
          if (item && item[0]) {
            translatedText += item[0];
          }
        }

        // 检测源语言
        if (response.data[2] && response.data[2] !== sourceLang) {
          detectedLang = response.data[2];
        }

        return {
          text: translatedText || text,
          sourceLang: detectedLang,
          targetLang: targetLang,
          engine: this.name,
          success: true,
          confidence: 1.0,
          alternatives: []
        };

      } catch (error) {
        if (error.response) {
          const status = error.response.status;
          if (status === 429) {
            throw new Error('Google翻译请求过于频繁，请稍后重试');
          } else if (status === 403) {
            throw new Error('Google翻译访问被拒绝');
          }
        }
        throw new Error(`Google翻译失败: ${error.message}`);
      }
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
      try {
        // 语言代码转换
        const googleSourceLang = this.convertLangCode(sourceLang);
        const googleTargetLang = this.convertLangCode(targetLang);
        
        // 构建请求参数（HTML模式）
        const params = {
          client: 'te_lib',
          sl: googleSourceLang,
          tl: googleTargetLang,
          dt: 't',
          format: 'html',
          q: htmlContent
        };

        // 发送请求
        const response = await axios.get(this.baseUrl, {
          params,
          headers: {
            'User-Agent': this.userAgent,
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Referer': 'https://translate.google.com/'
          },
          timeout: 10000
        });

        if (!response.data || !Array.isArray(response.data)) {
          throw new Error('Google HTML翻译返回数据格式错误');
        }

        const result = response.data[0];
        if (!result || !Array.isArray(result)) {
          throw new Error('Google HTML翻译结果为空');
        }

        // 提取翻译结果
        let translatedText = '';
        let detectedLang = sourceLang;
        
        for (const item of result) {
          if (item && item[0]) {
            translatedText += item[0];
          }
        }

        // 检测源语言
        if (response.data[2] && response.data[2] !== sourceLang) {
          detectedLang = response.data[2];
        }

        return {
          text: translatedText || htmlContent,
          sourceLang: detectedLang,
          targetLang: targetLang,
          engine: this.name,
          success: true,
          confidence: 1.0,
          alternatives: []
        };

      } catch (error) {
        if (error.response) {
          const status = error.response.status;
          if (status === 429) {
            throw new Error('Google HTML翻译请求过于频繁，请稍后重试');
          } else if (status === 403) {
            throw new Error('Google HTML翻译访问被拒绝');
          }
        }
        throw new Error(`Google HTML翻译失败: ${error.message}`);
      }
    });
  }

  /**
   * 获取支持的语言列表
   */
  async getSupportedLanguages() {
    // Google支持的语言列表
    return [
      'auto', 'af', 'sq', 'am', 'ar', 'hy', 'az', 'eu', 'be', 'bn', 'bs', 'bg', 'ca', 'ceb', 'ny', 'zh', 'zh-cn', 'zh-tw',
      'co', 'hr', 'cs', 'da', 'nl', 'en', 'eo', 'et', 'tl', 'fi', 'fr', 'fy', 'gl', 'ka', 'de', 'el', 'gu', 'ht', 'ha',
      'haw', 'iw', 'hi', 'hmn', 'hu', 'is', 'ig', 'id', 'ga', 'it', 'ja', 'jw', 'kn', 'kk', 'km', 'ko', 'ku', 'ky',
      'lo', 'la', 'lv', 'lt', 'lb', 'mk', 'mg', 'ms', 'ml', 'mt', 'mi', 'mr', 'mn', 'my', 'ne', 'no', 'ps', 'fa',
      'pl', 'pt', 'ma', 'ro', 'ru', 'sm', 'gd', 'sr', 'st', 'sn', 'sd', 'si', 'sk', 'sl', 'so', 'es', 'su', 'sw',
      'sv', 'tg', 'ta', 'te', 'th', 'tr', 'uk', 'ur', 'uz', 'vi', 'cy', 'xh', 'yi', 'yo', 'zu'
    ];
  }

  /**
   * 语言代码转换
   * 将标准语言代码转换为Google Translate支持的语言代码
   */
  convertLangCode(langCode) {
    const langMap = {
      'zh': 'zh-cn',
      'zh-CN': 'zh-cn',
      'zh-TW': 'zh-tw',
      'tw': 'zh-tw',
      'auto': 'auto'
    };

    return langMap[langCode] || langCode.toLowerCase();
  }
}

module.exports = GoogleTranslator;
