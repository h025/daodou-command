/**
 * 主翻译服务调度器
 * 支持多引擎调度和配置管理
 */
const { getEnginesByPriority, getEnabledEngines } = require('./engines');
const { ConfigManager } = require('../utils/config');
const chalk = require('chalk');

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
        console.log(chalk.blue(`尝试使用 ${engine.getName()} 翻译...`));
        
        // 检查引擎是否可用
        const isAvailable = await engine.isAvailable();
        if (!isAvailable) {
          console.log(chalk.yellow(`${engine.getName()} 不可用，跳过`));
          continue;
        }

        // 执行翻译
        const result = await engine.translate(text, sourceLang, targetLang, options);
        
        if (result.success) {
          console.log(chalk.green(`翻译成功，使用引擎: ${engine.getName()}`));
          return result;
        }
      } catch (error) {
        console.log(chalk.red(`${engine.getName()} 翻译失败: ${error.message}`));
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
        console.log(chalk.blue('使用微软翻译文档功能...'));
        return await microsoftEngine.translateDocumentation(text, sourceLang, targetLang, options);
      } catch (error) {
        console.log(chalk.yellow('微软文档翻译失败，回退到普通翻译'));
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
        console.log(chalk.blue(`尝试使用 ${engine.getName()} 翻译HTML...`));
        
        // 检查引擎是否可用
        if (!(await engine.isAvailable())) {
          console.log(chalk.yellow(`引擎 ${engine.getName()} 不可用，跳过`));
          continue;
        }
        
        // 执行HTML翻译
        const result = await engine.translateHtml(htmlContent, sourceLang, targetLang, options);
        
        if (result && result.success) {
          console.log(chalk.green(`HTML翻译成功，使用引擎: ${engine.getName()}`));
          return result;
        }
        
      } catch (error) {
        lastError = error;
        console.log(chalk.red(`引擎 ${engine.getName()} HTML翻译失败: ${error.message}`));
        
        // 如果是内容长度限制错误，直接抛出，不尝试其他引擎
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
        console.log(chalk.yellow(`获取 ${engine.getName()} 支持语言失败: ${error.message}`));
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

  /**
   * 获取代理统计信息（已禁用）
   * @returns {object} 代理统计信息
   */
  getProxyStats() {
    return {
      totalProxies: 0,
      currentIndex: 0,
      hasProxies: false,
      message: '代理功能已禁用，直接使用微软翻译'
    };
  }

  /**
   * 重置代理列表（已禁用）
   */
  async resetProxies() {
    console.log(chalk.yellow('代理功能已禁用，直接使用微软翻译'));
  }
}

module.exports = TranslationService;
