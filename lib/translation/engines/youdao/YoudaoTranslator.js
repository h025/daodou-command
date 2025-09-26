/**
 * 有道翻译引擎实现
 * 基于有道翻译API的付费翻译服务
 */
const BaseTranslator = require('../BaseTranslator');
const axios = require('axios');
const crypto = require('crypto');

class YoudaoTranslator extends BaseTranslator {
  constructor(config = {}) {
    super(config);
    this.name = 'Youdao Translator';
    this.priority = 5;
    this.intervalLimit = 1000; // 1秒间隔限制
    this.contentLengthLimit = 2000; // 2KB内容长度限制
    
    // 有道翻译API配置
    this.baseUrl = 'https://openapi.youdao.com/api';
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
      throw new Error('有道翻译需要配置App ID和App Key');
    }

    return await this.withRetry(async () => {
      try {
        // 语言代码转换
        const youdaoSourceLang = this.convertLangCode(sourceLang);
        const youdaoTargetLang = this.convertLangCode(targetLang);
        
        // 生成签名
        const salt = Date.now().toString();
        const curtime = Math.round(Date.now() / 1000).toString();
        const signStr = this.appId + this.truncate(text) + salt + curtime + this.appKey;
        const sign = crypto.createHash('sha256').update(signStr).digest('hex');
        
        // 构建请求参数
        const params = {
          q: text,
          from: youdaoSourceLang,
          to: youdaoTargetLang,
          appKey: this.appId,
          salt: salt,
          sign: sign,
          signType: 'v3',
          curtime: curtime
        };

        // 发送请求
        const response = await axios.post(this.baseUrl, params, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          timeout: 10000
        });

        if (!response.data) {
          throw new Error('有道翻译返回数据为空');
        }

        const result = response.data;
        
        // 检查错误码
        if (result.errorCode && result.errorCode !== '0') {
          const errorMsg = this.getErrorMessage(result.errorCode);
          throw new Error(`有道翻译错误 (${result.errorCode}): ${errorMsg}`);
        }

        if (!result.translation || !Array.isArray(result.translation)) {
          throw new Error('有道翻译结果格式错误');
        }

        const translation = result.translation[0];
        if (!translation) {
          throw new Error('有道翻译结果为空');
        }

        return {
          text: translation || text,
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
            throw new Error('有道翻译请求过于频繁，请稍后重试');
          } else if (status === 403) {
            throw new Error('有道翻译API密钥无效');
          }
        }
        throw new Error(`有道翻译失败: ${error.message}`);
      }
    });
  }

  /**
   * 截断文本（有道API要求）
   */
  truncate(text) {
    if (text.length <= 20) {
      return text;
    }
    return text.substring(0, 10) + text.length + text.substring(text.length - 10);
  }

  /**
   * 获取支持的语言列表
   */
  async getSupportedLanguages() {
    // 有道支持的语言列表
    return [
      'auto', 'zh-CHS', 'zh-CHT', 'en', 'ja', 'ko', 'fr', 'es', 'pt', 'it', 'ru', 'vi', 'de', 'ar', 'id', 'af',
      'bs', 'bg', 'ca', 'cs', 'cy', 'da', 'el', 'et', 'fa', 'fi', 'fr', 'gl', 'gu', 'he', 'hi', 'hr', 'ht', 'hu',
      'is', 'ja', 'ko', 'lt', 'lv', 'ms', 'mt', 'mww', 'nl', 'no', 'pl', 'pt', 'ro', 'ru', 'sk', 'sl', 'sr', 'sv',
      'sw', 'th', 'tr', 'uk', 'ur', 'vi', 'zh-CHS', 'zh-CHT'
    ];
  }

  /**
   * 语言代码转换
   * 将标准语言代码转换为有道翻译支持的语言代码
   */
  convertLangCode(langCode) {
    const langMap = {
      'zh': 'zh-CHS',
      'zh-CN': 'zh-CHS',
      'zh-TW': 'zh-CHT',
      'en': 'en',
      'ja': 'ja',
      'ko': 'ko',
      'fr': 'fr',
      'es': 'es',
      'pt': 'pt',
      'it': 'it',
      'ru': 'ru',
      'vi': 'vi',
      'de': 'de',
      'ar': 'ar',
      'id': 'id',
      'af': 'af',
      'bs': 'bs',
      'bg': 'bg',
      'ca': 'ca',
      'cs': 'cs',
      'cy': 'cy',
      'da': 'da',
      'el': 'el',
      'et': 'et',
      'fa': 'fa',
      'fi': 'fi',
      'gl': 'gl',
      'gu': 'gu',
      'he': 'he',
      'hi': 'hi',
      'hr': 'hr',
      'ht': 'ht',
      'hu': 'hu',
      'is': 'is',
      'lt': 'lt',
      'lv': 'lv',
      'ms': 'ms',
      'mt': 'mt',
      'mww': 'mww',
      'nl': 'nl',
      'no': 'no',
      'pl': 'pl',
      'ro': 'ro',
      'sk': 'sk',
      'sl': 'sl',
      'sr': 'sr',
      'sv': 'sv',
      'sw': 'sw',
      'th': 'th',
      'tr': 'tr',
      'uk': 'uk',
      'ur': 'ur',
      'auto': 'auto'
    };

    return langMap[langCode] || langCode.toLowerCase();
  }

  /**
   * 获取错误信息
   */
  getErrorMessage(errorCode) {
    const errorMessages = {
      '101': '缺少必填的参数',
      '102': '不支持的语言类型',
      '103': '翻译文本过长',
      '104': '不支持的API类型',
      '105': '不支持的签名类型',
      '106': '不支持的响应类型',
      '107': '不支持的传输协议',
      '108': 'appKey无效',
      '109': 'batchLog格式不正确',
      '110': '无相关服务的有效实例',
      '111': '开发者账号无效',
      '201': '请求被拒绝',
      '202': '请求被拒绝',
      '203': '请求被拒绝',
      '301': '词典查询失败',
      '302': '翻译查询失败',
      '303': '服务端的其他异常',
      '401': '账户余额不足',
      '411': '访问频率受限',
      '412': '请求长度受限',
      '1001': '无效的apikey',
      '1002': 'apikey已过期',
      '1003': 'apikey已过期',
      '1004': 'apikey已过期',
      '1005': 'apikey已过期',
      '1006': 'apikey已过期',
      '1007': 'apikey已过期',
      '1008': 'apikey已过期',
      '1009': 'apikey已过期',
      '1010': 'apikey已过期',
      '1011': 'apikey已过期',
      '1012': 'apikey已过期',
      '1013': 'apikey已过期',
      '1014': 'apikey已过期',
      '1015': 'apikey已过期',
      '1016': 'apikey已过期',
      '1017': 'apikey已过期',
      '1018': 'apikey已过期',
      '1019': 'apikey已过期',
      '1020': 'apikey已过期',
      '1021': 'apikey已过期',
      '1022': 'apikey已过期',
      '1023': 'apikey已过期',
      '1024': 'apikey已过期',
      '1025': 'apikey已过期',
      '1026': 'apikey已过期',
      '1027': 'apikey已过期',
      '1028': 'apikey已过期',
      '1029': 'apikey已过期',
      '1030': 'apikey已过期',
      '1031': 'apikey已过期',
      '1032': 'apikey已过期',
      '1033': 'apikey已过期',
      '1034': 'apikey已过期',
      '1035': 'apikey已过期',
      '1036': 'apikey已过期',
      '1037': 'apikey已过期',
      '1038': 'apikey已过期',
      '1039': 'apikey已过期',
      '1040': 'apikey已过期',
      '1041': 'apikey已过期',
      '1042': 'apikey已过期',
      '1043': 'apikey已过期',
      '1044': 'apikey已过期',
      '1045': 'apikey已过期',
      '1046': 'apikey已过期',
      '1047': 'apikey已过期',
      '1048': 'apikey已过期',
      '1049': 'apikey已过期',
      '1050': 'apikey已过期',
      '1051': 'apikey已过期',
      '1052': 'apikey已过期',
      '1053': 'apikey已过期',
      '1054': 'apikey已过期',
      '1055': 'apikey已过期',
      '1056': 'apikey已过期',
      '1057': 'apikey已过期',
      '1058': 'apikey已过期',
      '1059': 'apikey已过期',
      '1060': 'apikey已过期',
      '1061': 'apikey已过期',
      '1062': 'apikey已过期',
      '1063': 'apikey已过期',
      '1064': 'apikey已过期',
      '1065': 'apikey已过期',
      '1066': 'apikey已过期',
      '1067': 'apikey已过期',
      '1068': 'apikey已过期',
      '1069': 'apikey已过期',
      '1070': 'apikey已过期',
      '1071': 'apikey已过期',
      '1072': 'apikey已过期',
      '1073': 'apikey已过期',
      '1074': 'apikey已过期',
      '1075': 'apikey已过期',
      '1076': 'apikey已过期',
      '1077': 'apikey已过期',
      '1078': 'apikey已过期',
      '1079': 'apikey已过期',
      '1080': 'apikey已过期',
      '1081': 'apikey已过期',
      '1082': 'apikey已过期',
      '1083': 'apikey已过期',
      '1084': 'apikey已过期',
      '1085': 'apikey已过期',
      '1086': 'apikey已过期',
      '1087': 'apikey已过期',
      '1088': 'apikey已过期',
      '1089': 'apikey已过期',
      '1090': 'apikey已过期',
      '1091': 'apikey已过期',
      '1092': 'apikey已过期',
      '1093': 'apikey已过期',
      '1094': 'apikey已过期',
      '1095': 'apikey已过期',
      '1096': 'apikey已过期',
      '1097': 'apikey已过期',
      '1098': 'apikey已过期',
      '1099': 'apikey已过期',
      '1100': 'apikey已过期'
    };

    return errorMessages[errorCode] || '未知错误';
  }
}

module.exports = YoudaoTranslator;
