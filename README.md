# 刀豆命令行工具 (Daodou CLI)

一个功能强大的命令行工具，支持自动化构建和多语言管理。

## 安装

```bash
npm install -g daodou-command
```

## 功能特性

### 🚀 构建功能
- 自动检测Git分支
- 一键触发Jenkins构建
- 实时监听构建进度

### 🌐 多语言管理
- 支持多语言文件管理
- 多引擎翻译支持（微软、Google、百度、阿里云、有道、DeepL、OpenAI）
- HTML文档翻译支持，保持标签结构
- 智能引擎调度和故障转移
- 灵活的引擎配置和优先级设置

### 🔄 自动更新
- 智能版本检查和更新
- 一键升级到最新版本
- 支持强制更新和仅检查模式

### ⚙️ 配置管理
- 全局配置和项目配置支持
- 交互式配置向导
- 配置文件编辑和管理

## 快速开始

### 构建项目
```bash
# 在项目根目录下执行
cd your-project
dao build
```

### 检查更新
```bash
# 检查是否有新版本
dao upgrade --check

# 更新到最新版本
dao upgrade

# 强制更新
dao upgrade --force
```

### 配置管理
```bash
# 初始化全局配置
dao config init

# 查看当前配置
dao config show

# 编辑配置文件
dao config edit

# 清除配置文件
dao config clear
```

### 翻译引擎配置
支持7种翻译引擎，可在lang命令配置中灵活配置：

```json
{
  "lang": {
    "defaultLang": "en",
    "defaultDir": "./public/locales",
    "fileName": "common.json",
    "translation": {
      "defaultEngine": "microsoft",
      "enginePriority": ["microsoft", "google", "baidu", "ali", "youdao", "deepl", "openai"],
      "engines": {
        "microsoft": { "enabled": true },
        "google": { "enabled": true },
        "baidu": { "enabled": false, "appId": "", "appKey": "" },
        "ali": { "enabled": false, "accessKeyId": "", "accessKeySecret": "" },
        "youdao": { "enabled": false, "appId": "", "appKey": "" },
        "deepl": { "enabled": false, "apiKey": "" },
        "openai": { "enabled": false, "apiKey": "", "model": "gpt-3.5-turbo" }
      }
    }
  }
}
```

**支持的翻译引擎：**
- **微软翻译**: 免费，无需配置，支持HTML翻译
- **Google翻译**: 免费，无需配置，支持HTML翻译
- **百度翻译**: 需要App ID和App Key
- **阿里云翻译**: 需要AccessKey ID和AccessKey Secret，支持HTML翻译
- **有道翻译**: 需要App ID和App Key
- **DeepL翻译**: 需要API Key
- **OpenAI翻译**: 需要API Key和模型配置，支持HTML翻译

**HTML翻译支持：**
- 微软翻译：原生支持HTML格式，保持标签结构
- Google翻译：支持HTML格式翻译
- 阿里云翻译：支持HTML格式翻译
- OpenAI翻译：智能识别HTML标签，保持结构完整

### 多语言管理
```bash
# 添加多语言项（自动翻译）
dao lang add "hello world"

# 添加多语言项（指定值）
dao lang add "welcome" "欢迎"

# 删除多语言项
dao lang remove "hello world"
```

## 配置

首次运行会自动生成 `.daodourc` 配置文件：

```json5
{
  build: {
    jenkinsUrl: 'your-jenkins-url',
    jenkinsBase: 'your-jenkins-base',
    jenkinsToken: 'your-jenkins-token',
    jenkinsUsername: 'your-username',
    jenkinsPassword: 'your-password',
    jobName: 'your-job-name',

    buildParams: {
      token: 'your-jenkins-token',
      BUILD_ENV: 'test',
      version: '0.0.1'
    }
  },
  
  lang: {
    defaultLang: 'en',
    defaultDir: './public/locales',
    fileName: 'common.json'
  }
}
```

## 命令用法

### 构建命令
```bash
dao build                    # 自动检测分支并构建
dao build --branch feature   # 指定分支构建
dao build --help            # 查看帮助
```

### 更新命令
```bash
dao upgrade                  # 检查并更新到最新版本
dao upgrade --check         # 仅检查是否有新版本
dao upgrade --force         # 强制更新到最新版本
dao upgrade --help          # 查看帮助
```

### 配置命令
```bash
dao config                   # 配置管理向导
dao config init             # 初始化全局配置
dao config show             # 显示当前配置
dao config edit             # 编辑配置文件
dao config clear            # 清除配置文件
dao config --help           # 查看帮助
```

### 多语言命令
```bash
dao lang add "key" "value"   # 添加多语言项
dao lang remove "key"        # 删除多语言项
dao lang add "key" --lang zh # 只处理特定语言
dao lang --help             # 查看帮助
```

## 多语言文件结构

工具会自动扫描 `/public/locales/[lang]/common.json` 文件：

```
public/
└── locales/
    ├── en/
    │   └── common.json
    ├── zh/
    │   └── common.json
    └── ja/
        └── common.json
```

## 常见问题

- **Jenkins配置**: 请编辑 `.daodourc` 文件，填写真实的Jenkins配置
- **多语言目录**: 工具会提示目录不存在，不会自动创建
- **翻译失败**: 工具会自动重试和切换代理

## 开发

```bash
git clone <repository-url>
cd daodou-command
npm install
npm link
```

---

**刀豆团队** - 让开发更简单 🚀