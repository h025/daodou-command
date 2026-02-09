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
      console.error(chalk.red('  ✖ 请提供键名'));
      process.exit(1);
    }

    const finalValue = value || key;
    const defaultLang = this.config.defaultLang || 'en';
    const dir = options.dir || this.config.defaultDir || './public/locales';
    const fileName = this.config.fileName || 'common.json';

    console.log('');
    console.log(chalk.bold('  🌐 多语言管理工具'));
    console.log(chalk.dim('  ─────────────────────────'));

    try {
      const languages = await this.getLanguages(dir, options.lang);

      if (languages.length === 0) {
        console.log(chalk.yellow('  ⚠ 未找到任何语言目录'));
        return;
      }

      console.log('  ' + chalk.dim('键名') + '  ' + chalk.cyan(key));
      console.log('  ' + chalk.dim('原文') + '  ' + chalk.cyan(finalValue));
      console.log('  ' + chalk.dim('语言') + '  ' + chalk.cyan(languages.join(', ')));
      console.log(chalk.dim('  ─────────────────────────'));
      console.log('');

      let successCount = 0;
      let skipCount = 0;
      let failCount = 0;
      const results = {};

      for (let i = 0; i < languages.length; i++) {
        const langCode = languages[i];
        const filePath = path.join(dir, langCode, fileName);
        const isDefault = this.translationService.isDefaultLanguage(langCode, defaultLang);
        const langLabel = isDefault ? `${langCode} ${chalk.dim('(默认)')}` : langCode;
        const spinner = ora({ text: `${langLabel} 处理中...`, indent: 2 }).start();

        try {
          if (!fs.existsSync(filePath)) {
            spinner.warn(`${langLabel} ${chalk.dim('文件不存在，跳过')}`);
            results[langCode] = { status: 'skipped', reason: '文件不存在' };
            skipCount++;
            continue;
          }

          const fileContent = fs.readFileSync(filePath, 'utf8');
          const data = JSON.parse(fileContent);

          if (data[key] !== undefined) {
            spinner.warn(`${langLabel} ${chalk.dim('key 已存在，跳过')}`);
            results[langCode] = { status: 'skipped', reason: 'key 已存在' };
            skipCount++;
            continue;
          }

          let translatedValue = finalValue;

          if (!isDefault) {
            spinner.text = `${langLabel} 翻译中...`;
            const translationResult = await this.translationService.translateText(finalValue, langCode, defaultLang);
            if (translationResult.success) {
              translatedValue = translationResult.result;
            } else {
              spinner.fail(`${langLabel} ${chalk.dim('翻译失败')}`);
              results[langCode] = { status: 'skipped', reason: '翻译失败' };
              skipCount++;
              continue;
            }
          }

          await this.langFileManager.addKey(filePath, key, translatedValue);
          spinner.succeed(`${langLabel} ${chalk.dim(translatedValue)}`);

          results[langCode] = { status: 'success', value: translatedValue, originalValue: finalValue };
          successCount++;
        } catch (error) {
          spinner.fail(`${langLabel} ${chalk.dim(error.message)}`);
          results[langCode] = { status: 'failed', error: error.message };
          failCount++;
        }

        if (i < languages.length - 1 && !isDefault) {
          await this.translationService.delay(500);
        }
      }

      // 统计
      console.log('');
      console.log(chalk.dim('  ─────────────────────────'));
      const parts = [];
      if (successCount > 0) parts.push(chalk.green(`${successCount} 成功`));
      if (skipCount > 0) parts.push(chalk.yellow(`${skipCount} 跳过`));
      if (failCount > 0) parts.push(chalk.red(`${failCount} 失败`));
      console.log('  ' + parts.join(chalk.dim(' / ')));
      console.log('');

    } catch (error) {
      console.error(chalk.red('  ✖ ' + error.message));
      process.exit(1);
    }
  }

  /**
   * 执行 remove 命令
   */
  async remove(key, options = {}) {
    if (!key) {
      console.error(chalk.red('  ✖ 请提供键名'));
      process.exit(1);
    }

    const dir = options.dir || this.config.defaultDir || './public/locales';
    const fileName = this.config.fileName || 'common.json';

    console.log('');
    console.log(chalk.bold('  🌐 多语言管理工具'));
    console.log(chalk.dim('  ─────────────────────────'));
    console.log('  ' + chalk.dim('操作') + '  ' + chalk.cyan('删除'));
    console.log('  ' + chalk.dim('键名') + '  ' + chalk.cyan(key));

    try {
      const languages = await this.getLanguages(dir, options.lang);

      if (languages.length === 0) {
        console.log(chalk.yellow('  ⚠ 未找到任何语言目录'));
        return;
      }

      console.log('  ' + chalk.dim('语言') + '  ' + chalk.cyan(languages.join(', ')));
      console.log(chalk.dim('  ─────────────────────────'));
      console.log('');

      let successCount = 0;
      let skipCount = 0;

      for (const langCode of languages) {
        const filePath = path.join(dir, langCode, fileName);
        const spinner = ora({ text: `${langCode} 处理中...`, indent: 2 }).start();

        try {
          const result = await this.langFileManager.removeKey(filePath, key);
          if (result.success) {
            spinner.succeed(`${langCode} ${chalk.dim('已删除')}`);
            successCount++;
          } else if (result.notFound) {
            spinner.warn(`${langCode} ${chalk.dim('未找到，跳过')}`);
            skipCount++;
          }
        } catch (error) {
          if (error.message.includes('目录不存在') || error.message.includes('文件不存在')) {
            spinner.warn(`${langCode} ${chalk.dim('文件不存在，跳过')}`);
          } else {
            spinner.fail(`${langCode} ${chalk.dim(error.message)}`);
          }
        }
      }

      console.log('');
      console.log(chalk.dim('  ─────────────────────────'));
      const parts = [];
      if (successCount > 0) parts.push(chalk.green(`${successCount} 删除`));
      if (skipCount > 0) parts.push(chalk.yellow(`${skipCount} 跳过`));
      console.log('  ' + parts.join(chalk.dim(' / ')));
      console.log('');

    } catch (error) {
      console.error(chalk.red('  ✖ ' + error.message));
      process.exit(1);
    }
  }

  /**
   * 获取语言列表
   */
  async getLanguages(dir, specifiedLang) {
    if (specifiedLang) {
      return [specifiedLang];
    }

    try {
      if (!fs.existsSync(dir)) {
        console.log(chalk.yellow(`  ⚠ 目录不存在: ${dir}`));
        return [];
      }

      const items = fs.readdirSync(dir);
      return items.filter(item => {
        const itemPath = path.join(dir, item);
        return fs.statSync(itemPath).isDirectory();
      });
    } catch (error) {
      console.log(chalk.red(`  ✖ 扫描目录失败: ${error.message}`));
      return [];
    }
  }
}

module.exports = new LangCommand();
