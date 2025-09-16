# AI智能体快速参考卡片

> 为AI智能体提供项目快速理解和开发指导

## 🎯 项目核心信息

- **项目名称**: daodou-command (刀豆命令行工具)
- **主命令**: `dao`
- **当前版本**: 1.2.1
- **主要功能**: 构建、多语言管理、自动更新

## 📁 关键文件位置

```
bin/daodou.js                    # 主程序入口，命令注册
lib/commands/                    # 命令实现目录
├── build.js                    # 构建命令
├── lang.js                     # 多语言命令  
└── upgrade.js                  # 更新命令
lib/utils/                      # 工具模块
├── update-checker.js           # 后台更新检查
├── git.js                      # Git操作
└── ...                        # 其他工具
```

## ⚡ 快速添加新命令

### 1. 在 `bin/daodou.js` 中注册
```javascript
program
  .command('new-command')
  .description('新命令描述')
  .option('-o, --option <value>', '选项描述')
  .action(async (options) => {
    try {
      const commandModule = require('../lib/commands/new-command');
      await commandModule.execute(options);
    } catch (error) {
      console.error(chalk.red('执行失败:'), error.message);
      process.exit(1);
    }
  });
```

### 2. 创建命令文件 `lib/commands/new-command.js`
```javascript
const chalk = require('chalk');
const ora = require('ora');

async function execute(options) {
  const spinner = ora('执行中...').start();
  try {
    // 业务逻辑
    spinner.succeed('执行成功');
  } catch (error) {
    spinner.fail('执行失败');
    throw error;
  }
}

module.exports = { execute };
```

## 🔧 常用工具模块

### 更新检查器
```javascript
const updateChecker = require('../lib/utils/update-checker');
updateChecker.startBackgroundCheck(); // 启动后台检查
updateChecker.shouldRemindUpdate();   // 检查是否需要提醒
```

### Git工具
```javascript
const git = require('../lib/utils/git');
const branch = await git.getCurrentBranch();
const hasChanges = await git.hasUncommittedChanges();
```

## 📝 代码规范要点

### 必须遵循
- ✅ 使用 `async/await` 处理异步
- ✅ 使用 `chalk` 进行彩色输出
- ✅ 使用 `ora` 显示加载状态
- ✅ 统一的错误处理模式
- ✅ 详细的JSDoc注释

### 避免的做法
- ❌ 同步阻塞操作
- ❌ 未处理的Promise
- ❌ 硬编码的配置
- ❌ 缺少错误处理

## 🚨 错误处理模板

```javascript
async function execute(options) {
  try {
    // 参数验证
    if (!options.param) {
      throw new Error('缺少必需参数');
    }
    
    // 业务逻辑
    const result = await performAction(options);
    console.log(chalk.green('成功:'), result);
    
  } catch (error) {
    console.error(chalk.red('错误:'), error.message);
    throw error; // 重新抛出供上层处理
  }
}
```

## 📋 命令开发检查清单

- [ ] 在 `bin/daodou.js` 中注册命令
- [ ] 创建 `lib/commands/命令名.js` 文件
- [ ] 实现 `execute(options)` 函数
- [ ] 添加参数验证
- [ ] 添加错误处理
- [ ] 使用彩色输出
- [ ] 添加加载状态
- [ ] 更新帮助信息
- [ ] 更新 README.md
- [ ] 更新 CHANGELOG.md

## 🔄 发布流程

1. 更新版本号: `npm version patch/minor/major`
2. 更新 CHANGELOG.md
3. 提交代码: `git commit -m "描述"`
4. 发布: `npm publish`

## 💡 开发提示

- 新命令会自动获得后台更新检查功能
- 使用 `--help` 查看命令帮助
- 错误信息要用户友好
- 长时间操作要显示进度
- 网络请求要设置超时

## 🎨 输出样式

```javascript
// 成功信息
console.log(chalk.green('✅ 操作成功'));

// 错误信息  
console.error(chalk.red('❌ 操作失败'));

// 警告信息
console.log(chalk.yellow('⚠️ 警告信息'));

// 信息提示
console.log(chalk.blue('ℹ️ 提示信息'));
```

## 🔍 调试技巧

- 使用 `console.log` 输出调试信息
- 检查 `~/.daodou-update-state.json` 更新状态
- 使用 `node bin/daodou.js 命令名` 直接测试
- 检查网络连接和npm registry状态
