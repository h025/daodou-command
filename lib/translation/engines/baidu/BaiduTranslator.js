/**
 * 百度翻译引擎实现
 * 基于百度翻译API的付费翻译服务
 */
const BaseTranslator = require('../BaseTranslator');
const axios = require('axios');
const crypto = require('crypto');

class BaiduTranslator extends BaseTranslator {
  constructor(config = {}) {
    super(config);
    this.name = 'Baidu Translator';
    this.priority = 3;
    this.intervalLimit = 1000; // 1秒间隔限制
    this.contentLengthLimit = 2000; // 2KB内容长度限制
    
    // 百度翻译API配置
    this.baseUrl = 'https://fanyi-api.baidu.com/api/trans/vip/translate';
    this.appId = config.appId || '';
    this.appKey = config.appKey || '';
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
    if (!this.appId || !this.appKey) {
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

    if (!this.appId || !this.appKey) {
      throw new Error('百度翻译需要配置App ID和App Key');
    }

    return await this.withRetry(async () => {
      try {
        // 语言代码转换
        const baiduSourceLang = this.convertLangCode(sourceLang);
        const baiduTargetLang = this.convertLangCode(targetLang);
        
        // 生成签名
        const salt = Date.now().toString();
        const signStr = this.appId + text + salt + this.appKey;
        const sign = crypto.createHash('md5').update(signStr).digest('hex');
        
        // 构建请求参数
        const params = {
          q: text,
          from: baiduSourceLang,
          to: baiduTargetLang,
          appid: this.appId,
          salt: salt,
          sign: sign
        };

        // 发送请求
        const response = await axios.get(this.baseUrl, {
          params,
          timeout: 10000
        });

        if (!response.data) {
          throw new Error('百度翻译返回数据为空');
        }

        const result = response.data;
        
        // 检查错误码
        if (result.error_code) {
          const errorMsg = this.getErrorMessage(result.error_code);
          throw new Error(`百度翻译错误 (${result.error_code}): ${errorMsg}`);
        }

        if (!result.trans_result || !Array.isArray(result.trans_result)) {
          throw new Error('百度翻译结果格式错误');
        }

        const translation = result.trans_result[0];
        if (!translation) {
          throw new Error('百度翻译结果为空');
        }

        return {
          text: translation.dst || text,
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
            throw new Error('百度翻译请求过于频繁，请稍后重试');
          } else if (status === 403) {
            throw new Error('百度翻译API密钥无效');
          }
        }
        throw new Error(`百度翻译失败: ${error.message}`);
      }
    });
  }

  /**
   * 获取支持的语言列表
   */
  async getSupportedLanguages() {
    // 百度支持的语言列表
    return [
      'auto', 'zh', 'en', 'yue', 'wyw', 'jp', 'kor', 'fra', 'spa', 'th', 'ara', 'ru', 'pt', 'de', 'it', 'el', 'nl',
      'pl', 'bul', 'est', 'dan', 'fin', 'cs', 'rom', 'slo', 'swe', 'hu', 'cht', 'vie'
    ];
  }

  /**
   * 语言代码转换
   * 将标准语言代码转换为百度翻译支持的语言代码
   */
  convertLangCode(langCode) {
    const langMap = {
      'zh': 'zh',
      'zh-CN': 'zh',
      'zh-TW': 'cht',
      'en': 'en',
      'ja': 'jp',
      'ko': 'kor',
      'fr': 'fra',
      'es': 'spa',
      'th': 'th',
      'ar': 'ara',
      'ru': 'ru',
      'pt': 'pt',
      'de': 'de',
      'it': 'it',
      'el': 'el',
      'nl': 'nl',
      'pl': 'pl',
      'bg': 'bul',
      'et': 'est',
      'da': 'dan',
      'fi': 'fin',
      'cs': 'cs',
      'ro': 'rom',
      'sk': 'slo',
      'sv': 'swe',
      'hu': 'hu',
      'vi': 'vie',
      'auto': 'auto'
    };

    return langMap[langCode] || langCode.toLowerCase();
  }

  /**
   * 获取错误信息
   */
  getErrorMessage(errorCode) {
    const errorMessages = {
      52001: '请求超时',
      52002: '系统错误',
      52003: '未授权用户',
      54000: '必填参数为空',
      54001: '签名错误',
      54003: '访问频率受限',
      54004: '账户余额不足',
      54005: '长query请求频繁',
      58000: '客户端IP非法',
      90107: '认证未通过或未生效'
    };

    return errorMessages[errorCode] || '未知错误';
  }
}

module.exports = BaiduTranslator;
