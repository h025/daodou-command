# 更新日志

所有重要的项目更改都将记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
并且此项目遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [未发布]

### 新增
### 更改
### 修复
### 移除

## [1.1.1] - 2025-09-16

### 修复
- 修复主程序版本号显示问题
- 主程序现在自动读取package.json中的版本号，无需手动维护

## [1.1.0] - 2025-09-16

### 新增
- 在package.json中添加git仓库信息
  - 添加repository字段，指向GitHub仓库
  - 添加bugs字段，指向GitHub issues页面
  - 添加homepage字段，指向项目主页

### 更改
- 版本号从1.0.0升级到1.1.0
- 更新了npm包信息，现在包含完整的仓库链接

## [1.0.0] - 2025-09-16

### 新增
- 初始版本发布
- 支持自动化构建功能
  - 自动检测Git分支
  - 一键触发Jenkins构建
  - 实时监听构建进度
- 支持多语言管理功能
  - 多语言文件管理
  - 自动翻译功能（Google Translate API）
  - 多代理轮换绕过API限制
- 命令行工具基础功能
  - 使用commander.js构建CLI
  - 支持help和version命令
  - 配置文件自动生成和管理

### 技术特性
- 基于Node.js开发
- 使用simple-git进行Git操作
- 集成Google Translate API
- 支持代理轮换
- 使用Puppeteer进行浏览器自动化
- 支持JSON5配置文件格式

---

## 版本说明

- **主版本号（MAJOR）**: 当你做了不兼容的API修改
- **次版本号（MINOR）**: 当你做了向下兼容的功能性新增
- **修订号（PATCH）**: 当你做了向下兼容的问题修正

## 链接

- [GitHub仓库](https://github.com/h025/daodou-command)
- [npm包页面](https://www.npmjs.com/package/daodou-command)
- [问题反馈](https://github.com/h025/daodou-command/issues)
