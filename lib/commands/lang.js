const chalk = require('chalk');
const ora = require('ora');
const path = require('path');
const fs = require('fs');
const { ConfigManager } = require('../utils/config');
const { LangFileManager } = require('../utils/lang-file-manager');
const TranslationService = require('../utils/translation');

class LangCommand {
  constructor() {
    this.configManager = new ConfigManager();
    this.langFileManager = new LangFileManager();
    this.translationService = new TranslationService();
    this.config = this.configManager.getLangConfig();
  }

  /**
   * 执行 add 命令（支持自动翻译）
   */
  async add(key, value, options = {}) {
    if (!key) {
      console.error(chalk.red('❌ 请提供键名'));
      process.exit(1);
    }

    // 如果没有指定 value，则使用 key 作为 value
    const finalValue = value || key;

    const defaultLang = this.config.defaultLang || 'en';
    const dir = options.dir || this.config.defaultDir || './public/locales';
    const fileName = this.config.fileName || 'common.json';

    console.log(chalk.blue('🔧 多语言文件管理工具启动中...\n'));

    try {
      // 获取语言列表
      const languages = await this.getLanguages(dir, options.lang);
      
      if (languages.length === 0) {
        console.log(chalk.yellow('⚠️ 未找到任何语言目录'));
        return;
      }

      console.log(chalk.green(`✅ 发现语言: ${languages.join(', ')}\n`));

      // 开始翻译流程
      console.log(chalk.blue('🌐 开始翻译流程...'));
      console.log(chalk.blue(`📊 进度: 0/${languages.length} 语言完成\n`));

      // 统计变量
      let successCount = 0;
      let skipCount = 0;
      let failCount = 0;
      const results = {};

      // 顺序处理每个语言
      for (let i = 0; i < languages.length; i++) {
        const langCode = languages[i];
        const filePath = path.join(dir, langCode, fileName);
        
        // 显示分隔线
        console.log(chalk.gray('────────────────────────────────────────'));
        
        // 显示当前处理的语言
        const isDefault = this.translationService.isDefaultLanguage(langCode, defaultLang);
        const langDisplay = isDefault ? `${langCode} (默认语言)` : langCode;
        console.log(chalk.blue(`📝 正在处理语言: ${langDisplay}`));

        try {
          // 步骤 1: 检查 key 是否存在
          console.log(chalk.blue(`  🔍 步骤 1/${isDefault ? '3' : '4'}: 检查 key "${key}" 是否存在...`));
          
          if (fs.existsSync(filePath)) {
            const fileContent = fs.readFileSync(filePath, 'utf8');
            const data = JSON.parse(fileContent);
            
            if (data[key] !== undefined) {
              console.log(chalk.yellow(`  ⚠️ key "${key}" 已存在，跳过该语言`));
              console.log(chalk.gray(`  📄 结果: 跳过`));
              results[langCode] = { status: 'skipped', reason: 'key 已存在' };
              skipCount++;
              continue;
            }
          } else {
            console.log(chalk.yellow(`  ⚠️ 文件 ${filePath} 不存在，跳过该语言`));
            console.log(chalk.gray(`  📄 结果: 跳过`));
            results[langCode] = { status: 'skipped', reason: '文件不存在' };
            skipCount++;
            continue;
          }

          console.log(chalk.green(`  ✅ key "${key}" 不存在，可以添加`));

          let translatedValue = finalValue;

          if (isDefault) {
            // 默认语言直接写入
            console.log(chalk.blue(`  ⚡ 步骤 2/3: 默认语言直接写入...`));
            console.log(chalk.green(`  ✅ 步骤 3/3: 成功写入文件`));
            console.log(chalk.gray(`  📄 结果: "${key}": "${translatedValue}"`));
          } else {
            // 其他语言需要翻译
            const translationResult = await this.translationService.translateText(finalValue, langCode, defaultLang);
            
            if (translationResult.success) {
              translatedValue = translationResult.result;
              console.log(chalk.green(`  ✅ 步骤 4/4: 成功写入文件`));
              console.log(chalk.gray(`  📄 结果: "${key}": "${translatedValue}"`));
            } else {
              console.log(chalk.gray(`  📄 结果: 跳过`));
              results[langCode] = { status: 'skipped', reason: '翻译失败' };
              skipCount++;
              continue;
            }
          }

          // 写入文件
          await this.langFileManager.addKey(filePath, key, translatedValue);
          
          results[langCode] = { 
            status: 'success', 
            value: translatedValue,
            originalValue: finalValue
          };
          successCount++;

        } catch (error) {
          console.log(chalk.red(`  ❌ 处理失败: ${error.message}`));
          console.log(chalk.gray(`  📄 结果: 失败`));
          results[langCode] = { status: 'failed', error: error.message };
          failCount++;
        }

        // 显示进度
        console.log(chalk.blue(`📊 进度: ${i + 1}/${languages.length} 语言完成`));

        // 等待 0.5 秒后处理下一个语言（除了最后一个）
        if (i < languages.length - 1) {
          console.log(chalk.gray('\n⏳ 等待 0.5s 后处理下一个语言...\n'));
          await this.translationService.delay(500);
        }
      }

      // 显示最终结果
      console.log(chalk.gray('\n────────────────────────────────────────'));
      console.log(chalk.green('🎉 翻译流程完成！\n'));

      console.log(chalk.blue('📊 最终统计:'));
      console.log(chalk.green(`  ✅ 成功: ${successCount} 个语言`));
      console.log(chalk.yellow(`  ⏭️ 跳过: ${skipCount} 个语言`));
      console.log(chalk.red(`  ❌ 失败: ${failCount} 个语言`));

      // 显示代理统计信息
      this.translationService.showProxyStats();

      console.log(chalk.blue('\n📋 翻译结果汇总:'));
      for (const [lang, result] of Object.entries(results)) {
        if (result.status === 'success') {
          console.log(chalk.green(`  ${lang}: "${key}": "${result.value}"`));
        } else if (result.status === 'skipped') {
          console.log(chalk.yellow(`  ${lang}: 跳过 (${result.reason})`));
        } else {
          console.log(chalk.red(`  ${lang}: 失败 (${result.error})`));
        }
      }

    } catch (error) {
      console.error(chalk.red('❌ 操作失败:'), error.message);
      process.exit(1);
    }
  }

  /**
   * 执行 remove 命令
   */
  async remove(key, options = {}) {
    if (!key) {
      console.error(chalk.red('❌ 请提供键名'));
      process.exit(1);
    }

    const lang = options.lang || this.config.defaultLang || 'en';
    const dir = options.dir || this.config.defaultDir || './public/locales';
    const fileName = this.config.fileName || 'common.json';

    console.log(chalk.blue('🔧 多语言文件管理工具启动中...\n'));

    try {
      // 获取语言列表
      const languages = await this.getLanguages(dir, options.lang);
      
      if (languages.length === 0) {
        console.log(chalk.yellow('⚠️ 未找到任何语言目录'));
        return;
      }

      console.log(chalk.green(`✅ 发现语言: ${languages.join(', ')}\n`));

      // 批量处理每个语言
      let successCount = 0;
      let skipCount = 0;

      for (const langCode of languages) {
        const filePath = path.join(dir, langCode, fileName);
        
        try {
          const result = await this.langFileManager.removeKey(filePath, key);
          if (result.success) {
            console.log(chalk.green(`✅ 成功删除 "${key}" 从 ${langCode}`));
            successCount++;
          } else if (result.notFound) {
            console.log(chalk.yellow(`⚠️ 跳过 "${key}" 在 ${langCode} (未找到)`));
            skipCount++;
          }
        } catch (error) {
          if (error.message.includes('目录不存在')) {
            console.log(chalk.yellow(`⚠️ 跳过 ${langCode} (目录不存在)`));
          } else if (error.message.includes('文件不存在')) {
            console.log(chalk.yellow(`⚠️ 跳过 ${langCode} (文件不存在)`));
          } else {
            console.log(chalk.red(`❌ 处理 ${langCode} 失败: ${error.message}`));
          }
        }
      }

      // 显示统计结果
      console.log(chalk.blue(`\n📊 处理完成: 成功 ${successCount} 个, 跳过 ${skipCount} 个`));

    } catch (error) {
      console.error(chalk.red('❌ 操作失败:'), error.message);
      process.exit(1);
    }
  }

  /**
   * 获取语言列表
   */
  async getLanguages(dir, specifiedLang) {
    // 如果指定了语言，只处理该语言
    if (specifiedLang) {
      return [specifiedLang];
    }

    // 否则扫描目录下的所有语言文件夹
    try {
      if (!fs.existsSync(dir)) {
        console.log(chalk.yellow(`⚠️ 目录不存在: ${dir}`));
        return [];
      }

      const items = fs.readdirSync(dir);
      const languages = items.filter(item => {
        const itemPath = path.join(dir, item);
        return fs.statSync(itemPath).isDirectory();
      });

      console.log(chalk.blue(`🔍 扫描目录 ${dir}: 发现 ${languages.length} 个语言`));
      return languages;
    } catch (error) {
      console.log(chalk.red(`❌ 扫描目录失败: ${error.message}`));
      return [];
    }
  }
}

module.exports = new LangCommand();
