/**
 * 翻译引擎注册和导出
 */

// 导入所有翻译引擎
const MicrosoftTranslator = require('./microsoft/MicrosoftTranslator');
const GoogleTranslator = require('./google/GoogleTranslator');
const BaiduTranslator = require('./baidu/BaiduTranslator');
const AliTranslator = require('./ali/AliTranslator');
const YoudaoTranslator = require('./youdao/YoudaoTranslator');
const DeeplTranslator = require('./deepl/DeeplTranslator');
const OpenaiTranslator = require('./openai/OpenaiTranslator');

// 引擎注册表
const engines = {
  microsoft: MicrosoftTranslator,
  google: GoogleTranslator,
  baidu: BaiduTranslator,
  ali: AliTranslator,
  youdao: YoudaoTranslator,
  deepl: DeeplTranslator,
  openai: OpenaiTranslator
};

/**
 * 获取所有引擎
 * @returns {Array<BaseTranslator>} 所有引擎实例
 */
function getAllEngines() {
  return Object.values(engines).map(EngineClass => new EngineClass());
}

/**
 * 按优先级排序引擎
 * @returns {Array<BaseTranslator>} 按优先级排序的引擎列表
 */
function getEnginesByPriority() {
  return getAllEngines().sort((a, b) => a.getPriority() - b.getPriority());
}

/**
 * 根据配置获取启用的引擎
 * @param {Object} config 配置对象
 * @returns {Array<BaseTranslator>} 启用的引擎列表
 */
function getEnabledEngines(config = {}) {
  const langConfig = config.lang || {};
  const translationConfig = langConfig.translation || {};
  const enginesConfig = translationConfig.engines || {};
  const enginePriority = translationConfig.enginePriority || [];
  
  return enginePriority
    .filter(engineName => enginesConfig[engineName]?.enabled)
    .map(engineName => {
      const EngineClass = engines[engineName];
      if (!EngineClass) return null;
      
      const engineConfig = enginesConfig[engineName] || {};
      return new EngineClass(engineConfig);
    })
    .filter(engine => engine !== null);
}

module.exports = {
  engines,
  getAllEngines,
  getEnginesByPriority,
  getEnabledEngines
};
