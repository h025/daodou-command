/**
 * 微软翻译服务
 * 提供翻译、词典查询、示例查询等功能
 */
const MicrosoftHttpClient = require('./HttpClient');

// 文本类型枚举
const TEXT_TYPES = {
  PLAIN: 'Plain',
  HTML: 'Html'
};

// 错误代码
const ERROR_CODES = {
  INVALID_LANGUAGE_PAIR: 400023,
  CONTENT_TOO_LONG: 400050,
  AUTHENTICATION_FAILED: 401000,
  QUOTA_EXCEEDED: 403000,
  SERVICE_UNAVAILABLE: 503000
};

class MicrosoftTranslatorService {
  constructor() {
    this.httpClient = new MicrosoftHttpClient();
    this.MAX_DICT_INPUT_TEXT_LENGTH = 100;
    this.MAX_DICT_EXAMPLE_INPUT_ITEM_COUNT = 10;
  }

  /**
   * 翻译文本
   * @param {string} text 要翻译的文本
   * @param {string} from 源语言代码
   * @param {string} to 目标语言代码
   * @param {string} textType 文本类型 (Plain 或 Html)
   * @returns {Promise<Object>} 翻译结果
   */
  async translate(text, from, to, textType = TEXT_TYPES.PLAIN) {
    const params = {
      to: to,
      textType: textType
    };

    // 如果不是自动检测，添加源语言参数
    if (from !== 'auto') {
      params.from = from;
    }

    const data = [{ text: text }];
    
    try {
      const response = await this.httpClient.post('/translate', data, { params });
      return response[0] || null;
    } catch (error) {
      if (error.message.includes('400050')) {
        throw new Error('内容过长，无法翻译');
      }
      throw error;
    }
  }

  /**
   * 检查文本是否可以查询词典
   * @param {string} text 要检查的文本
   * @returns {boolean} 是否可以查询词典
   */
  canLookupDictionary(text) {
    return text.length <= this.MAX_DICT_INPUT_TEXT_LENGTH && 
           text.split('').some(char => !char.match(/\s/));
  }

  /**
   * 词典查询
   * @param {string} text 要查询的文本
   * @param {string} from 源语言代码
   * @param {string} to 目标语言代码
   * @returns {Promise<Object>} 词典查询结果
   */
  async dictionaryLookup(text, from, to) {
    const params = {
      from: from,
      to: to
    };

    const data = [{ text: text }];
    
    try {
      const response = await this.httpClient.post('/dictionary/lookup', data, { params });
      return response[0];
    } catch (error) {
      if (error.message.includes('400023')) {
        console.warn('不支持的语言对:', from, '->', to);
        return null;
      }
      throw error;
    }
  }

  /**
   * 词典示例查询
   * @param {Object} dictionaryLookup 词典查询结果
   * @param {string} from 源语言代码
   * @param {string} to 目标语言代码
   * @returns {Promise<Array>} 示例列表
   */
  async dictionaryExamples(dictionaryLookup, from, to) {
    if (!dictionaryLookup || !dictionaryLookup.translations) {
      return [];
    }

    // 按置信度排序，取前几个翻译
    const sortedTranslations = dictionaryLookup.translations
      .sort((a, b) => b.confidence - a.confidence)
      .filter(translation => translation.normalizedTarget.length <= this.MAX_DICT_INPUT_TEXT_LENGTH)
      .slice(0, this.MAX_DICT_EXAMPLE_INPUT_ITEM_COUNT);

    if (sortedTranslations.length === 0) {
      return [];
    }

    const request = sortedTranslations.map(translation => ({
      text: dictionaryLookup.normalizedSource,
      translation: translation.normalizedTarget
    }));

    const params = {
      from: from,
      to: to
    };

    try {
      const response = await this.httpClient.post('/dictionary/examples', request, { params });
      return response;
    } catch (error) {
      console.warn('获取词典示例失败:', error.message);
      return [];
    }
  }

  /**
   * 检查语言是否支持
   * @param {string} language 语言代码
   * @returns {boolean} 是否支持
   */
  isLanguageSupported(language) {
    // 这里可以添加语言支持检查逻辑
    // 暂时返回true，实际使用时应该检查微软API支持的语言列表
    return true;
  }

  /**
   * 获取支持的语言列表
   * @returns {Promise<Array>} 支持的语言列表
   */
  async getSupportedLanguages() {
    try {
      const response = await this.httpClient.post('/languages', {}, {
        params: { scope: 'translation' }
      });
      return response.translation || {};
    } catch (error) {
      console.warn('获取支持语言列表失败:', error.message);
      return {};
    }
  }
}

module.exports = MicrosoftTranslatorService;
