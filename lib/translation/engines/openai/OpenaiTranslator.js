/**
 * OpenAI翻译引擎实现
 * 基于OpenAI GPT API的付费翻译服务
 */
const BaseTranslator = require('../BaseTranslator');
const axios = require('axios');

class OpenaiTranslator extends BaseTranslator {
  constructor(config = {}) {
    super(config);
    this.name = 'OpenAI Translator';
    this.priority = 7;
    this.intervalLimit = 2000; // 2秒间隔限制（OpenAI有速率限制）
    this.contentLengthLimit = 4000; // 4KB内容长度限制
    
    // OpenAI API配置
    this.baseUrl = config.baseUrl || 'https://api.openai.com/v1';
    this.apiKey = config.apiKey || '';
    this.model = config.model || 'gpt-3.5-turbo';
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
      throw new Error('OpenAI翻译需要配置API Key');
    }

    return await this.withRetry(async () => {
      try {
        // 构建翻译提示词
        const prompt = this.buildTranslationPrompt(text, sourceLang, targetLang);
        
        // 构建请求参数
        const requestData = {
          model: this.model,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 1000,
          temperature: 0.3,
          top_p: 1,
          frequency_penalty: 0,
          presence_penalty: 0
        };

        // 发送请求
        const response = await axios.post(`${this.baseUrl}/chat/completions`, requestData, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000 // OpenAI可能需要更长时间
        });

        if (!response.data) {
          throw new Error('OpenAI翻译返回数据为空');
        }

        const result = response.data;
        
        // 检查错误
        if (result.error) {
          throw new Error(`OpenAI翻译错误: ${result.error.message}`);
        }

        if (!result.choices || !Array.isArray(result.choices) || result.choices.length === 0) {
          throw new Error('OpenAI翻译结果为空');
        }

        const choice = result.choices[0];
        if (!choice.message || !choice.message.content) {
          throw new Error('OpenAI翻译结果格式错误');
        }

        const translatedText = choice.message.content.trim();

        return {
          text: translatedText || text,
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
            throw new Error('OpenAI翻译请求过于频繁，请稍后重试');
          } else if (status === 401) {
            throw new Error('OpenAI翻译API密钥无效');
          } else if (status === 402) {
            throw new Error('OpenAI翻译账户余额不足');
          } else if (status === 413) {
            throw new Error('OpenAI翻译请求内容过长');
          }
        }
        throw new Error(`OpenAI翻译失败: ${error.message}`);
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

    if (!this.apiKey) {
      throw new Error('OpenAI翻译需要配置API Key');
    }

    return await this.withRetry(async () => {
      try {
        // 构建HTML翻译提示词
        const prompt = this.buildHtmlTranslationPrompt(htmlContent, sourceLang, targetLang);
        
        // 构建请求参数
        const requestData = {
          model: this.model,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 2000, // HTML内容可能需要更多token
          temperature: 0.3,
          top_p: 1,
          frequency_penalty: 0,
          presence_penalty: 0
        };

        // 发送请求
        const response = await axios.post(`${this.baseUrl}/chat/completions`, requestData, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000 // HTML翻译可能需要更长时间
        });

        if (!response.data) {
          throw new Error('OpenAI HTML翻译返回数据为空');
        }

        const result = response.data;
        
        // 检查错误
        if (result.error) {
          throw new Error(`OpenAI HTML翻译错误: ${result.error.message}`);
        }

        if (!result.choices || !Array.isArray(result.choices) || result.choices.length === 0) {
          throw new Error('OpenAI HTML翻译结果为空');
        }

        const choice = result.choices[0];
        if (!choice.message || !choice.message.content) {
          throw new Error('OpenAI HTML翻译结果格式错误');
        }

        const translatedText = choice.message.content.trim();

        return {
          text: translatedText || htmlContent,
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
            throw new Error('OpenAI HTML翻译请求过于频繁，请稍后重试');
          } else if (status === 401) {
            throw new Error('OpenAI HTML翻译API密钥无效');
          } else if (status === 402) {
            throw new Error('OpenAI HTML翻译账户余额不足');
          } else if (status === 413) {
            throw new Error('OpenAI HTML翻译请求内容过长');
          }
        }
        throw new Error(`OpenAI HTML翻译失败: ${error.message}`);
      }
    });
  }

  /**
   * 构建翻译提示词
   */
  buildTranslationPrompt(text, sourceLang, targetLang) {
    const sourceLangName = this.getLanguageName(sourceLang);
    const targetLangName = this.getLanguageName(targetLang);
    
    return `请将以下${sourceLangName}文本翻译成${targetLangName}，只返回翻译结果，不要添加任何解释或其他内容：

${text}`;
  }

  /**
   * 构建HTML翻译提示词
   */
  buildHtmlTranslationPrompt(htmlContent, sourceLang, targetLang) {
    const sourceLangName = this.getLanguageName(sourceLang);
    const targetLangName = this.getLanguageName(targetLang);
    
    return `请将以下${sourceLangName}HTML内容翻译成${targetLangName}，保持HTML标签结构不变，只翻译文本内容，不要添加任何解释或其他内容：

${htmlContent}`;
  }

  /**
   * 获取语言名称
   */
  getLanguageName(langCode) {
    const langNames = {
      'zh': '中文',
      'zh-CN': '简体中文',
      'zh-TW': '繁体中文',
      'en': '英文',
      'ja': '日文',
      'ko': '韩文',
      'fr': '法文',
      'es': '西班牙文',
      'it': '意大利文',
      'de': '德文',
      'ru': '俄文',
      'pt': '葡萄牙文',
      'ar': '阿拉伯文',
      'th': '泰文',
      'vi': '越南文',
      'id': '印尼文',
      'ms': '马来文',
      'tr': '土耳其文',
      'pl': '波兰文',
      'nl': '荷兰文',
      'sv': '瑞典文',
      'da': '丹麦文',
      'no': '挪威文',
      'fi': '芬兰文',
      'cs': '捷克文',
      'hu': '匈牙利文',
      'ro': '罗马尼亚文',
      'bg': '保加利亚文',
      'hr': '克罗地亚文',
      'sk': '斯洛伐克文',
      'sl': '斯洛文尼亚文',
      'et': '爱沙尼亚文',
      'lv': '拉脱维亚文',
      'lt': '立陶宛文',
      'mt': '马耳他文',
      'ga': '爱尔兰文',
      'cy': '威尔士文',
      'eu': '巴斯克文',
      'ca': '加泰罗尼亚文',
      'gl': '加利西亚文',
      'is': '冰岛文',
      'mk': '马其顿文',
      'sq': '阿尔巴尼亚文',
      'sr': '塞尔维亚文',
      'bs': '波斯尼亚文',
      'he': '希伯来文',
      'fa': '波斯文',
      'ur': '乌尔都文',
      'hi': '印地文',
      'bn': '孟加拉文',
      'ta': '泰米尔文',
      'te': '泰卢固文',
      'ml': '马拉雅拉姆文',
      'kn': '卡纳达文',
      'gu': '古吉拉特文',
      'pa': '旁遮普文',
      'or': '奥里亚文',
      'as': '阿萨姆文',
      'ne': '尼泊尔文',
      'si': '僧伽罗文',
      'my': '缅甸文',
      'km': '高棉文',
      'lo': '老挝文',
      'ka': '格鲁吉亚文',
      'am': '阿姆哈拉文',
      'sw': '斯瓦希里文',
      'zu': '祖鲁文',
      'af': '南非荷兰文',
      'auto': '自动检测'
    };

    return langNames[langCode] || langCode;
  }

  /**
   * 获取支持的语言列表
   */
  async getSupportedLanguages() {
    // OpenAI支持所有主要语言
    return [
      'auto', 'zh', 'zh-CN', 'zh-TW', 'en', 'ja', 'ko', 'fr', 'es', 'it', 'de', 'ru', 'pt', 'ar', 'th', 'vi',
      'id', 'ms', 'tr', 'pl', 'nl', 'sv', 'da', 'no', 'fi', 'cs', 'hu', 'ro', 'bg', 'hr', 'sk', 'sl', 'et',
      'lv', 'lt', 'mt', 'ga', 'cy', 'eu', 'ca', 'gl', 'is', 'mk', 'sq', 'sr', 'bs', 'he', 'fa', 'ur', 'hi',
      'bn', 'ta', 'te', 'ml', 'kn', 'gu', 'pa', 'or', 'as', 'ne', 'si', 'my', 'km', 'lo', 'ka', 'am', 'sw',
      'zu', 'af'
    ];
  }

  /**
   * 语言代码转换
   * OpenAI使用标准语言代码，无需转换
   */
  convertLangCode(langCode) {
    return langCode;
  }
}

module.exports = OpenaiTranslator;
