#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const buildCommand = require('../lib/commands/build');
const langCommand = require('../lib/commands/lang');

const program = new Command();

// 设置程序信息
program
  .name('dao')
  .description('刀豆命令行工具 - 自动化构建和部署')
  .version('1.0.0', '-v, --version');

// 添加 build 命令
program
  .command('build')
  .description('构建项目 - 自动检测Git分支并调用Jenkins打包')
  .option('-j, --jenkins-url <url>', 'Jenkins服务器地址')
  .option('-u, --username <username>', 'Jenkins用户名')
  .option('-t, --token <token>', 'Jenkins API Token')
  .option('-j, --job-name <name>', 'Jenkins任务名称')
  .option('-b, --branch <branch>', '指定分支名称（默认从Git自动检测）')
  .option('-p, --parameters <params>', '额外的构建参数 (JSON格式)')
  .action(async (options) => {
    try {
      await buildCommand.execute(options);
    } catch (error) {
      console.error(chalk.red('构建失败:'), error.message);
      process.exit(1);
    }
  });

// 添加 lang 命令
const langCmd = program
  .command('lang')
  .description('多语言文件管理工具');

langCmd
  .command('add <key> [value]')
  .description('添加多语言项')
  .option('-l, --lang <language>', '指定语言（如 en、zh、ja）')
  .option('-d, --dir <directory>', '指定目录（默认为 ./public/locales）')
  .action(async (key, value, options) => {
    try {
      await langCommand.add(key, value, options);
    } catch (error) {
      console.error(chalk.red('添加失败:'), error.message);
      process.exit(1);
    }
  });

langCmd
  .command('remove <key>')
  .description('删除多语言项')
  .option('-l, --lang <language>', '指定语言（如 en、zh、ja）')
  .option('-d, --dir <directory>', '指定目录（默认为 ./public/locales）')
  .action(async (key, options) => {
    try {
      await langCommand.remove(key, options);
    } catch (error) {
      console.error(chalk.red('删除失败:'), error.message);
      process.exit(1);
    }
  });

// 添加帮助信息
program.addHelpText('after', `
示例:
  $ dao build                                    # 自动检测Git分支并构建
  $ dao build --branch feature/new-feature      # 指定分支构建
  $ dao build --jenkins-url http://jenkins.example.com
  $ dao build --parameters '{"param1":"value1"}'
  
  $ dao lang add "hello"
  $ dao lang add "hello" "Hello World"
  $ dao lang add "world" --lang en
  $ dao lang add "测试" --dir ./i18n
  $ dao lang remove "hello"
  $ dao lang remove "world" --lang en

注意:
  - build 命令会自动检测当前Git分支，无需手动指定
  - 如需指定特定分支，请使用 --branch 参数
  - 确保在Git仓库目录中运行 build 命令

环境变量:
  JENKINS_URL      Jenkins服务器地址
  JENKINS_USERNAME Jenkins用户名
  JENKINS_TOKEN    Jenkins API Token
  JENKINS_JOB_NAME Jenkins任务名称
`);

// 解析命令行参数
program.parse(); 