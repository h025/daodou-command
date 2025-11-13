/**
 * DeepL翻译引擎实现
 * 基于DeepL API的付费翻译服务
 */
const BaseTranslator = require('../BaseTranslator');
const axios = require('axios');

class DeeplTranslator extends BaseTranslator {
  constructor(config = {}) {
    super(config);
    this.name = 'DeepL Translator';
    this.priority = 6;
    this.intervalLimit = 1000; // 1秒间隔限制
    this.contentLengthLimit = 5000; // 5KB内容长度限制
    
    // DeepL API配置
    this.baseUrl = 'https://api-free.deepl.com/v2/translate';
    this.apiKey = config.apiKey || '';
    this.isPro = config.isPro || false; // 是否为Pro版本
    
    // 如果是Pro版本，使用不同的URL
    if (this.isPro) {
      this.baseUrl = 'https://api.deepl.com/v2/translate';
    }
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
    if (!this.apiKey) {
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

    if (!this.apiKey) {
      throw new Error('DeepL翻译需要配置API Key');
    }

    return await this.withRetry(async () => {
      try {
        // 语言代码转换
        const deeplSourceLang = this.convertLangCode(sourceLang);
        const deeplTargetLang = this.convertLangCode(targetLang);
        
        // 构建请求参数
        const params = {
          auth_key: this.apiKey,
          text: text,
          target_lang: deeplTargetLang
        };

        // 如果不是自动检测，添加源语言参数
        if (deeplSourceLang !== 'auto') {
          params.source_lang = deeplSourceLang;
        }

        // 发送请求
        const response = await axios.post(this.baseUrl, params, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          timeout: 10000
        });

        if (!response.data) {
          throw new Error('DeepL翻译返回数据为空');
        }

        const result = response.data;
        
        // 检查错误
        if (result.message) {
          throw new Error(`DeepL翻译错误: ${result.message}`);
        }

        if (!result.translations || !Array.isArray(result.translations)) {
          throw new Error('DeepL翻译结果格式错误');
        }

        const translation = result.translations[0];
        if (!translation) {
          throw new Error('DeepL翻译结果为空');
        }

        return {
          text: translation.text || text,
          sourceLang: translation.detected_source_language || sourceLang,
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
            throw new Error('DeepL翻译请求过于频繁，请稍后重试');
          } else if (status === 403) {
            throw new Error('DeepL翻译API密钥无效');
          } else if (status === 456) {
            throw new Error('DeepL翻译字符数超出限制');
          }
        }
        throw new Error(`DeepL翻译失败: ${error.message}`);
      }
    });
  }

  /**
   * 获取支持的语言列表
   */
  async getSupportedLanguages() {
    // DeepL支持的语言列表
    return [
      'auto', 'BG', 'CS', 'DA', 'DE', 'EL', 'EN', 'ES', 'ET', 'FI', 'FR', 'HU', 'ID', 'IT', 'JA', 'KO', 'LT',
      'LV', 'NB', 'NL', 'PL', 'PT', 'RO', 'RU', 'SK', 'SL', 'SV', 'TR', 'UK', 'ZH'
    ];
  }

  /**
   * 语言代码转换
   * 将标准语言代码转换为DeepL支持的语言代码
   */
  convertLangCode(langCode) {
    const langMap = {
      'zh': 'ZH',
      'zh-CN': 'ZH',
      'zh-TW': 'ZH',
      'tw': 'ZH',
      'en': 'EN',
      'ja': 'JA',
      'ko': 'KO',
      'fr': 'FR',
      'es': 'ES',
      'it': 'IT',
      'de': 'DE',
      'ru': 'RU',
      'pt': 'PT',
      'ar': 'AR',
      'th': 'TH',
      'vi': 'VI',
      'id': 'ID',
      'ms': 'MS',
      'tr': 'TR',
      'pl': 'PL',
      'nl': 'NL',
      'sv': 'SV',
      'da': 'DA',
      'no': 'NB',
      'fi': 'FI',
      'cs': 'CS',
      'hu': 'HU',
      'ro': 'RO',
      'bg': 'BG',
      'hr': 'HR',
      'sk': 'SK',
      'sl': 'SL',
      'et': 'ET',
      'lv': 'LV',
      'lt': 'LT',
      'mt': 'MT',
      'ga': 'GA',
      'cy': 'CY',
      'eu': 'EU',
      'ca': 'CA',
      'gl': 'GL',
      'is': 'IS',
      'mk': 'MK',
      'sq': 'SQ',
      'sr': 'SR',
      'bs': 'BS',
      'he': 'HE',
      'fa': 'FA',
      'ur': 'UR',
      'hi': 'HI',
      'bn': 'BN',
      'ta': 'TA',
      'te': 'TE',
      'ml': 'ML',
      'kn': 'KN',
      'gu': 'GU',
      'pa': 'PA',
      'or': 'OR',
      'as': 'AS',
      'ne': 'NE',
      'si': 'SI',
      'my': 'MY',
      'km': 'KM',
      'lo': 'LO',
      'ka': 'KA',
      'am': 'AM',
      'sw': 'SW',
      'zu': 'ZU',
      'af': 'AF',
      'auto': 'auto'
    };

    return langMap[langCode] || langCode.toUpperCase();
  }
}

module.exports = DeeplTranslator;
