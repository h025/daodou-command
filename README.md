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
- 自动翻译功能（Google Translate API）
- 多代理轮换绕过API限制

## 快速开始

### 构建项目
```bash
# 在项目根目录下执行
cd your-project
dao build
```

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
    jobName: 'your-job-name'
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