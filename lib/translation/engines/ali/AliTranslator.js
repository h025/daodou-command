/**
 * 阿里云翻译引擎实现
 * 基于阿里云机器翻译API的付费翻译服务
 */
const BaseTranslator = require('../BaseTranslator');
const axios = require('axios');
const crypto = require('crypto');

class AliTranslator extends BaseTranslator {
  constructor(config = {}) {
    super(config);
    this.name = 'Ali Translator';
    this.priority = 4;
    this.intervalLimit = 1000; // 1秒间隔限制
    this.contentLengthLimit = 5000; // 5KB内容长度限制
    
    // 阿里云翻译API配置
    this.baseUrl = 'https://mt.cn-hangzhou.aliyuncs.com';
    this.accessKeyId = config.accessKeyId || '';
    this.accessKeySecret = config.accessKeySecret || '';
    this.version = '2018-10-12';
    this.action = 'TranslateGeneral';
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
    if (!this.accessKeyId || !this.accessKeySecret) {
      return false;
    }
    
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

    if (!this.accessKeyId || !this.accessKeySecret) {
      throw new Error('阿里云翻译需要配置AccessKey ID和AccessKey Secret');
    }

    return await this.withRetry(async () => {
      try {
        // 语言代码转换
        const aliSourceLang = this.convertLangCode(sourceLang);
        const aliTargetLang = this.convertLangCode(targetLang);
        
        // 构建请求参数
        const params = {
          Action: this.action,
          Version: this.version,
          Format: 'JSON',
          SourceLanguage: aliSourceLang,
          TargetLanguage: aliTargetLang,
          SourceText: text,
          Scene: 'general'
        };

        // 生成签名
        const signature = this.generateSignature(params);

        // 发送请求
        const response = await axios.post(this.baseUrl, params, {
          headers: {
            'Authorization': `ACS3-HMAC-SHA256 Credential=${this.accessKeyId}, SignedHeaders=host;x-acs-action;x-acs-content-sha256;x-acs-date;x-acs-version, Signature=${signature}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            'x-acs-action': this.action,
            'x-acs-version': this.version,
            'x-acs-date': new Date().toISOString().replace(/[:\-]|\.\d{3}/g, ''),
            'x-acs-content-sha256': crypto.createHash('sha256').update(JSON.stringify(params)).digest('hex')
          },
          timeout: 10000
        });

        if (!response.data) {
          throw new Error('阿里云翻译返回数据为空');
        }

        const result = response.data;
        
        // 检查错误
        if (result.Code && result.Code !== '200') {
          throw new Error(`阿里云翻译错误: ${result.Message || '未知错误'}`);
        }

        if (!result.Data || !result.Data.Translated) {
          throw new Error('阿里云翻译结果为空');
        }

        return {
          text: result.Data.Translated || text,
          sourceLang: sourceLang,
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
            throw new Error('阿里云翻译请求过于频繁，请稍后重试');
          } else if (status === 403) {
            throw new Error('阿里云翻译API密钥无效');
          }
        }
        throw new Error(`阿里云翻译失败: ${error.message}`);
      }
    });
  }

  /**
   * 生成签名
   */
  generateSignature(params) {
    const timestamp = new Date().toISOString().replace(/[:\-]|\.\d{3}/g, '');
    const method = 'POST';
    const uri = '/';
    const queryString = '';
    const headers = `host:mt.cn-hangzhou.aliyuncs.com\nx-acs-action:${this.action}\nx-acs-content-sha256:${crypto.createHash('sha256').update(JSON.stringify(params)).digest('hex')}\nx-acs-date:${timestamp}\nx-acs-version:${this.version}`;
    const signedHeaders = 'host;x-acs-action;x-acs-content-sha256;x-acs-date;x-acs-version';
    const payloadHash = crypto.createHash('sha256').update(JSON.stringify(params)).digest('hex');
    
    const canonicalRequest = `${method}\n${uri}\n${queryString}\n${headers}\n\n${signedHeaders}\n${payloadHash}`;
    const stringToSign = `ACS3-HMAC-SHA256\n${timestamp}\n${crypto.createHash('sha256').update(canonicalRequest).digest('hex')}`;
    
    const signature = crypto.createHmac('sha256', this.accessKeySecret).update(stringToSign).digest('hex');
    return signature;
  }

  /**
   * 翻译HTML文档
   */
  async translateHtml(htmlContent, sourceLang, targetLang, options = {}) {
    if (!htmlContent || !targetLang) {
      throw new Error('HTML内容和目标语言不能为空');
    }

    if (!this.accessKeyId || !this.accessKeySecret) {
      throw new Error('阿里云翻译需要配置AccessKey ID和AccessKey Secret');
    }

    return await this.withRetry(async () => {
      try {
        // 语言代码转换
        const aliSourceLang = this.convertLangCode(sourceLang);
        const aliTargetLang = this.convertLangCode(targetLang);
        
        // 构建请求参数（HTML模式）
        const params = {
          Action: this.action,
          Version: this.version,
          Format: 'JSON',
          SourceLanguage: aliSourceLang,
          TargetLanguage: aliTargetLang,
          SourceText: htmlContent,
          Scene: 'general',
          FormatType: 'html'  // 指定HTML格式
        };

        // 生成签名
        const signature = this.generateSignature(params);

        // 发送请求
        const response = await axios.post(this.baseUrl, params, {
          headers: {
            'Authorization': `ACS3-HMAC-SHA256 Credential=${this.accessKeyId}, SignedHeaders=host;x-acs-action;x-acs-content-sha256;x-acs-date;x-acs-version, Signature=${signature}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            'x-acs-action': this.action,
            'x-acs-version': this.version,
            'x-acs-date': new Date().toISOString().replace(/[:\-]|\.\d{3}/g, ''),
            'x-acs-content-sha256': crypto.createHash('sha256').update(JSON.stringify(params)).digest('hex')
          },
          timeout: 10000
        });

        if (!response.data) {
          throw new Error('阿里云HTML翻译返回数据为空');
        }

        const result = response.data;
        
        // 检查错误
        if (result.Code && result.Code !== '200') {
          throw new Error(`阿里云HTML翻译错误: ${result.Message || '未知错误'}`);
        }

        if (!result.Data || !result.Data.Translated) {
          throw new Error('阿里云HTML翻译结果为空');
        }

        return {
          text: result.Data.Translated || htmlContent,
          sourceLang: sourceLang,
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
            throw new Error('阿里云HTML翻译请求过于频繁，请稍后重试');
          } else if (status === 403) {
            throw new Error('阿里云HTML翻译API密钥无效');
          }
        }
        throw new Error(`阿里云HTML翻译失败: ${error.message}`);
      }
    });
  }

  /**
   * 获取支持的语言列表
   */
  async getSupportedLanguages() {
    // 阿里云支持的语言列表
    return [
      'auto', 'zh', 'en', 'ja', 'ko', 'fr', 'es', 'it', 'de', 'ru', 'pt', 'ar', 'th', 'vi', 'id', 'ms', 'tr', 'pl',
      'nl', 'sv', 'da', 'no', 'fi', 'cs', 'hu', 'ro', 'bg', 'hr', 'sk', 'sl', 'et', 'lv', 'lt', 'mt', 'ga', 'cy',
      'eu', 'ca', 'gl', 'is', 'mk', 'sq', 'sr', 'bs', 'he', 'fa', 'ur', 'hi', 'bn', 'ta', 'te', 'ml', 'kn', 'gu',
      'pa', 'or', 'as', 'ne', 'si', 'my', 'km', 'lo', 'ka', 'am', 'sw', 'zu', 'af', 'az', 'be', 'bo', 'br', 'ce',
      'co', 'cs', 'cy', 'da', 'de', 'dz', 'el', 'en', 'eo', 'es', 'et', 'eu', 'fa', 'fi', 'fj', 'fo', 'fr', 'fy',
      'ga', 'gd', 'gl', 'gu', 'ha', 'he', 'hi', 'ho', 'hr', 'ht', 'hu', 'hy', 'hz', 'ia', 'id', 'ie', 'ig', 'ii',
      'ik', 'io', 'is', 'it', 'iu', 'ja', 'jv', 'ka', 'kg', 'ki', 'kj', 'kk', 'kl', 'km', 'kn', 'ko', 'kr', 'ks',
      'ku', 'kv', 'kw', 'ky', 'la', 'lb', 'lg', 'li', 'ln', 'lo', 'lt', 'lu', 'lv', 'mg', 'mh', 'mi', 'mk', 'ml',
      'mn', 'mo', 'mr', 'ms', 'mt', 'my', 'na', 'nb', 'nd', 'ne', 'ng', 'nl', 'nn', 'no', 'nr', 'nv', 'ny', 'oc',
      'oj', 'om', 'or', 'os', 'pa', 'pi', 'pl', 'ps', 'pt', 'qu', 'rm', 'rn', 'ro', 'ru', 'rw', 'sa', 'sc', 'sd',
      'se', 'sg', 'si', 'sk', 'sl', 'sm', 'sn', 'so', 'sq', 'sr', 'ss', 'st', 'su', 'sv', 'sw', 'ta', 'te', 'tg',
      'th', 'ti', 'tk', 'tl', 'tn', 'to', 'tr', 'ts', 'tt', 'tw', 'ty', 'ug', 'uk', 'ur', 'uz', 've', 'vi', 'vo',
      'wa', 'wo', 'xh', 'yi', 'yo', 'za', 'zh', 'zu'
    ];
  }

  /**
   * 语言代码转换
   * 将标准语言代码转换为阿里云翻译支持的语言代码
   */
  convertLangCode(langCode) {
    const langMap = {
      'zh': 'zh',
      'zh-CN': 'zh',
      'zh-TW': 'zh',
      'tw': 'zh',
      'en': 'en',
      'ja': 'ja',
      'ko': 'ko',
      'fr': 'fr',
      'es': 'es',
      'it': 'it',
      'de': 'de',
      'ru': 'ru',
      'pt': 'pt',
      'ar': 'ar',
      'th': 'th',
      'vi': 'vi',
      'id': 'id',
      'ms': 'ms',
      'tr': 'tr',
      'pl': 'pl',
      'nl': 'nl',
      'sv': 'sv',
      'da': 'da',
      'no': 'no',
      'fi': 'fi',
      'cs': 'cs',
      'hu': 'hu',
      'ro': 'ro',
      'bg': 'bg',
      'hr': 'hr',
      'sk': 'sk',
      'sl': 'sl',
      'et': 'et',
      'lv': 'lv',
      'lt': 'lt',
      'mt': 'mt',
      'ga': 'ga',
      'cy': 'cy',
      'auto': 'auto'
    };

    return langMap[langCode] || langCode.toLowerCase();
  }
}

module.exports = AliTranslator;
