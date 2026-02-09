# 刀豆命令行工具 (Daodou CLI)

用于 Jenkins 构建触发、多语言文案维护、版本升级与配置管理的 CLI。

## 安装

```bash
npm install -g daodou-command
```

本地开发调试：

```bash
npm install
npm link
```

## 3 分钟上手

1. 初始化全局配置：

```bash
dao config init
```

2. 按需创建项目配置（推荐）：

```bash
cp .daodourc.example .daodourc
```

3. 运行命令：

```bash
dao build
dao lang add "hello.world" "Hello World"
dao upgrade --check
```

## 配置规则

- 全局配置：`~/.daodou/config.json`
- 项目配置：`./.daodourc`
- 优先级：项目配置覆盖全局配置
- `build.jobName` 建议放在项目配置中（不同项目通常不同）

最小配置示例（JSON5）：

```json5
{
  build: {
    jenkinsUrl: "https://jenkins.example.com/",
    jenkinsBase: "https://jenkins.example.com/job",
    jenkinsToken: "your-token",
    jenkinsUsername: "your-username",
    jenkinsPassword: "your-password",
    jobName: "your-job-name",
    buildParams: {
      token: "your-token",
      BUILD_ENV: "test"
    }
  },
  lang: {
    defaultLang: "en",
    defaultDir: "./public/locales",
    fileName: "common.json"
  }
}
```

## 命令速览

```bash
# 构建
dao build
dao build -b feature/my-branch
dao build -j https://jenkins.example.com -n your-job-name

# 配置
dao config init
dao config show
dao config edit
dao config clear

# 多语言
dao lang add "key" "value"
dao lang add "key" --lang zh
dao lang remove "key"

# 更新
dao upgrade --check
dao upgrade
dao upgrade --force
```

`build` 常用参数：

- `-j, --jenkins-url <url>`
- `-n, --job-name <name>`
- `-b, --branch <branch>`
- `-p, --parameters <json>`

## 多语言目录约定

```text
public/locales/{lang}/common.json
```

例如：

```text
public/locales/en/common.json
public/locales/zh/common.json
public/locales/ja/common.json
```

## 常见问题

- 提示配置缺失：先执行 `dao config init` 并补全 Jenkins 参数。
- 提示不是 Git 仓库：在项目根目录执行，或显式传 `-b/--branch`。
- 目录不存在：`lang` 命令不会自动创建 `public/locales` 目录结构。

## 安全说明

配置中可能包含 Jenkins 凭据，请勿提交 `~/.daodou/config.json` 和 `./.daodourc` 到仓库。
