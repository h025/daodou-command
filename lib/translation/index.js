/**
 * 翻译服务统一入口
 */
const TranslationService = require('./TranslationService');

module.exports = {
  TranslationService,
  // 便捷方法
  createTranslationService: (config = {}) => new TranslationService(config)
};
