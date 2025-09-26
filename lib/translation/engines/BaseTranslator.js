/**
 * 基础翻译器抽象类
 * 定义所有翻译引擎的统一接口
 */
class BaseTranslator {
  constructor(config = {}) {
    this.config = config;
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1秒
  }

  /**
   * 翻译文本
   * @param {string} text - 要翻译的文本
   * @param {string} sourceLang - 源语言代码
   * @param {string} targetLang - 目标语言代码
   * @param {object} options - 翻译选项
   * @returns {Promise<object>} 翻译结果
   */
  async translate(text, sourceLang, targetLang, options = {}) {
    throw new Error('必须实现translate方法');
  }

  /**
   * 翻译HTML文档
   * @param {string} htmlContent - HTML内容
   * @param {string} sourceLang - 源语言代码
   * @param {string} targetLang - 目标语言代码
   * @param {object} options - 翻译选项
   * @returns {Promise<object>} 翻译结果
   */
  async translateHtml(htmlContent, sourceLang, targetLang, options = {}) {
    // 默认实现：调用普通翻译方法
    return await this.translate(htmlContent, sourceLang, targetLang, options);
  }

  /**
   * 获取支持的语言列表
   * @returns {Promise<Array>} 支持的语言列表
   */
  async getSupportedLanguages() {
    throw new Error('必须实现getSupportedLanguages方法');
  }

  /**
   * 获取翻译器名称
   * @returns {string} 翻译器名称
   */
  getName() {
    throw new Error('必须实现getName方法');
  }


  /**
   * 检查翻译器是否可用
   * @returns {Promise<boolean>} 是否可用
   */
  async isAvailable() {
    throw new Error('必须实现isAvailable方法');
  }

  /**
   * 获取翻译器优先级（数字越小优先级越高）
   * @returns {number} 优先级
   */
  getPriority() {
    return 999; // 默认低优先级
  }

  /**
   * 重试机制
   * @param {Function} fn - 要重试的函数
   * @param {number} retries - 重试次数
   * @returns {Promise<any>} 执行结果
   */
  async withRetry(fn, retries = this.maxRetries) {
    for (let i = 0; i < retries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i === retries - 1) throw error;
        
        // 等待后重试
        await new Promise(resolve => setTimeout(resolve, this.retryDelay * (i + 1)));
      }
    }
  }
}

module.exports = BaseTranslator;
