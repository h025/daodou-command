# 刀豆命令行工具 (Daodou CLI)

用于 Jenkins 构建触发、多语言文案维护、版本检查升级与配置管理的命令行工具。

## 安装

全局安装：

```bash
npm install -g daodou-command
```

本地开发：

```bash
git clone <repository-url>
cd daodou-command
npm install
npm link
```

## 快速开始

1. 初始化全局配置：

```bash
dao config init
```

2. 执行常用命令：

```bash
dao build
dao lang add "hello.world" "Hello World"
dao upgrade --check
```

说明：

- 当全局配置和项目配置都不存在时，首次执行 `dao build` 会自动生成默认项目配置 `./.daodourc`。

## 配置说明

配置来源：

- 全局配置：`~/.daodou/config.json`
- 项目配置：`./.daodourc`
- 合并规则：项目配置覆盖全局配置

建议：

- `build.jobName` 放在项目配置中（不同项目通常不同）。
- Jenkins 账号和 Token 放在全局配置中（减少重复）。

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
    fileName: "common.json",
    translation: {
      defaultEngine: "microsoft",
      enginePriority: ["microsoft", "google", "baidu", "ali", "youdao", "deepl", "openai"]
    }
  }
}
```

## 命令详解

### `dao build`

用途：

- 读取配置并触发 Jenkins 构建。
- 默认自动检测当前 Git 分支。
- 构建后轮询 Jenkins 队列与构建状态，输出进度日志。

常用写法：

```bash
# 自动读取当前分支并构建
dao build

# 指定分支构建
dao build -b feature/new-login

# 显式传入 Jenkins 地址与任务名（推荐仍在配置文件中维护）
dao build -j https://jenkins.example.com -n web-build
```

参数含义：

- `-b, --branch <branch>`：指定构建分支；不传时自动读取当前 Git 分支。
- `-j, --jenkins-url <url>`：Jenkins 服务器地址。
- `-n, --job-name <name>`：Jenkins 任务名称。
- `-u, --username <username>`：Jenkins 用户名。
- `-t, --token <token>`：Jenkins API Token。
- `-p, --parameters <json>`：额外构建参数（JSON 字符串）。

前置条件：

- 当前目录是 Git 仓库（未传 `--branch` 时）。
- Jenkins 配置已填写且不是模板值。
- 首次构建前建议先运行 `dao config show` 检查合并配置是否正确。

### `dao config`

用途：

- 管理全局配置与项目配置。
- 查看“全局 / 项目 / 合并结果”三类配置视图。
- 直接执行 `dao config` 可进入交互式配置向导。

交互模式：

- 命令：`dao config`
- 作用：以菜单方式引导你选择 `init / show / edit / clear`，适合不记子命令时使用。

子命令：

- `dao config init`：初始化全局配置文件 `~/.daodou/config.json`。
- `dao config show`：显示当前配置与合并结果。
- `dao config edit`：打开编辑器修改配置。
- `dao config clear`：删除指定配置（全局/项目/全部）。

常用写法：

```bash
dao config
dao config init
dao config show
dao config edit
dao config clear
```

### `dao lang`

用途：

- 在多语言 JSON 文件中批量新增或删除 key。
- 新增时会以默认语言为源文，其他语言自动翻译。

目录约定：

```text
public/locales/{lang}/common.json
```

例如：

```text
public/locales/en/common.json
public/locales/zh/common.json
public/locales/ja/common.json
```

子命令：

- `dao lang add <key> [value]`：添加 key。
- `dao lang remove <key>`：删除 key。

参数含义：

- `-l, --lang <language>`：只处理指定语言（如 `en`、`zh`、`ja`）。
- `-d, --dir <directory>`：指定语言目录，默认读取 `lang.defaultDir`。

常用写法：

```bash
# 默认以 key 作为默认语言文案，并自动翻译到其他语言
dao lang add "user.profile.title"

# 手动指定默认语言文案
dao lang add "user.profile.title" "Profile"

# 只处理 zh（默认 defaultLang=en 时，会先翻译再写入 zh）
dao lang add "user.profile.title" "Profile" --lang zh

# 删除 key
dao lang remove "user.profile.title"
```

说明：

- `lang` 命令不会自动创建 `public/locales` 目录结构。
- 若某语言文件不存在或 key 已存在，会跳过并给出提示。
- `add` 的 `value` 按 `defaultLang` 语义处理（默认通常是 `en`）。
- 当 `--lang` 指定语言不等于 `defaultLang` 时，会“翻译后写入”目标语言文件。
- 只有目标语言等于 `defaultLang` 时，才会“直接写入”你传入的 `value`。

### `dao upgrade`

用途：

- 检查 npm 上的最新版本并执行升级。

子命令参数：

- `--check`：仅检查是否有新版本，不安装。
- `--force`：即使当前版本已是最新，也强制重装最新版本。

常用写法：

```bash
dao upgrade --check
dao upgrade
dao upgrade --force
```

## 常见问题

- 提示缺少配置：先执行 `dao config init`，并补全 Jenkins 参数。
- 提示配置仍是模板值：将 `your-jenkins-*` 等占位值替换为真实值。
- 提示不是 Git 仓库：在仓库根目录执行，或显式传 `-b/--branch`。
- `lang` 扫描不到语言目录：确认 `public/locales/{lang}/common.json` 路径存在。

## 安全说明

配置中可能包含 Jenkins 凭据，请勿将以下文件提交到仓库：

- `~/.daodou/config.json`
- `./.daodourc`
