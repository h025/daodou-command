/**
 * 主翻译服务调度器
 * 支持多引擎调度和配置管理
 */
const { getEnginesByPriority, getEnabledEngines } = require('./engines');
const { ConfigManager } = require('../utils/config');

class TranslationService {
  constructor() {
    this.configManager = new ConfigManager();
    this.config = this.configManager.getAll();
    
    // 根据配置获取启用的引擎
    this.engines = getEnabledEngines(this.config);
    
    // 如果没有启用的引擎，使用默认的微软翻译
    if (this.engines.length === 0) {
      const MicrosoftTranslator = require('./engines/microsoft/MicrosoftTranslator');
      this.engines = [new MicrosoftTranslator()];
    }
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
    if (!text || !targetLang) {
      throw new Error('文本和目标语言不能为空');
    }

    let lastError = null;

    // 按优先级尝试各个引擎
    for (const engine of this.engines) {
      try {
        const isAvailable = await engine.isAvailable();
        if (!isAvailable) {
          continue;
        }

        const result = await engine.translate(text, sourceLang, targetLang, options);

        if (result.success) {
          return result;
        }
      } catch (error) {
        lastError = error;
        continue;
      }
    }

    // 所有引擎都失败了
    throw new Error(`所有翻译引擎都失败了。最后错误: ${lastError?.message || '未知错误'}`);
  }

  /**
   * 翻译文档
   * @param {string} text - 要翻译的文档内容
   * @param {string} sourceLang - 源语言代码
   * @param {string} targetLang - 目标语言代码
   * @param {object} options - 翻译选项
   * @returns {Promise<object>} 翻译结果
   */
  async translateDocumentation(text, sourceLang, targetLang, options = {}) {
    // 优先使用微软翻译的文档翻译功能
    const microsoftEngine = this.engines.find(engine => engine.getName() === 'Microsoft Translator');
    
    if (microsoftEngine && await microsoftEngine.isAvailable()) {
      try {
        return await microsoftEngine.translateDocumentation(text, sourceLang, targetLang, options);
      } catch (error) {
        // 回退到普通翻译
      }
    }

    // 回退到普通翻译
    return await this.translate(text, sourceLang, targetLang, options);
  }

  /**
   * 翻译HTML文档
   * @param {string} htmlContent - 要翻译的HTML内容
   * @param {string} sourceLang - 源语言代码
   * @param {string} targetLang - 目标语言代码
   * @param {object} options - 翻译选项
   * @returns {Promise<object>} 翻译结果
   */
  async translateHtml(htmlContent, sourceLang, targetLang, options = {}) {
    let lastError = null;
    
    // 按优先级尝试各个引擎
    for (const engine of this.engines) {
      try {
        if (!(await engine.isAvailable())) {
          continue;
        }

        const result = await engine.translateHtml(htmlContent, sourceLang, targetLang, options);

        if (result && result.success) {
          return result;
        }
      } catch (error) {
        lastError = error;

        if (error.message.includes('内容过长') || error.message.includes('Content too long')) {
          throw error;
        }
      }
    }

    // 所有引擎都失败了
    throw new Error(`所有翻译引擎都失败了。最后错误: ${lastError?.message || '未知错误'}`);
  }

  /**
   * 获取所有支持的语言
   * @returns {Promise<Array>} 支持的语言列表
   */
  async getSupportedLanguages() {
    const allLanguages = new Set();
    
    for (const engine of this.engines) {
      try {
        const languages = await engine.getSupportedLanguages();
        languages.forEach(lang => allLanguages.add(lang));
      } catch (error) {
        // 获取失败不影响其他引擎
      }
    }

    return Array.from(allLanguages).sort();
  }

  /**
   * 获取引擎状态
   * @returns {Promise<Array>} 引擎状态列表
   */
  async getEngineStatus() {
    const status = [];
    
    for (const engine of this.engines) {
      try {
        const isAvailable = await engine.isAvailable();
        status.push({
          name: engine.getName(),
          priority: engine.getPriority(),
          available: isAvailable,
          status: isAvailable ? '可用' : '不可用'
        });
      } catch (error) {
        status.push({
          name: engine.getName(),
          priority: engine.getPriority(),
          available: false,
          status: `错误: ${error.message}`
        });
      }
    }

    return status.sort((a, b) => a.priority - b.priority);
  }

}

module.exports = TranslationService;
