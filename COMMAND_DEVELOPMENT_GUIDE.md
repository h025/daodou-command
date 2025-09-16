# 刀豆命令行工具 - 命令开发规范

> 本文档为AI智能体提供详细的命令开发指南，确保新命令符合项目规范和最佳实践。

## 📋 目录

- [项目架构](#项目架构)
- [命令开发规范](#命令开发规范)
- [文件结构规范](#文件结构规范)
- [代码规范](#代码规范)
- [错误处理规范](#错误处理规范)
- [测试规范](#测试规范)
- [发布规范](#发布规范)
- [常见问题](#常见问题)

## 🏗️ 项目架构

### 核心文件结构
```
daodou-command/
├── bin/
│   └── daodou.js              # 主程序入口，命令注册中心
├── lib/
│   ├── commands/              # 命令实现目录
│   │   ├── build.js           # 构建命令
│   │   ├── lang.js            # 多语言命令
│   │   └── upgrade.js         # 更新命令
│   └── utils/                 # 工具模块目录
│       ├── update-checker.js  # 更新检查器
│       ├── git.js            # Git工具
│       └── ...               # 其他工具模块
├── package.json              # 项目配置
├── CHANGELOG.md              # 更新日志
└── README.md                 # 项目说明
```

### 命令注册流程
1. 在 `bin/daodou.js` 中注册命令
2. 在 `lib/commands/` 中实现命令逻辑
3. 在 `lib/utils/` 中实现工具函数
4. 更新帮助信息和文档

## 📝 命令开发规范

### 1. 命令注册规范

#### 基本命令注册
```javascript
// 在 bin/daodou.js 中添加命令
program
  .command('command-name')
  .description('命令描述 - 简洁明了的功能说明')
  .option('-o, --option <value>', '选项描述')
  .action(async (options) => {
    try {
      const commandModule = require('../lib/commands/command-name');
      await commandModule.execute(options);
    } catch (error) {
      console.error(chalk.red('命令执行失败:'), error.message);
      process.exit(1);
    }
  });
```

#### 子命令注册
```javascript
// 子命令模式（如 lang 命令）
const subCmd = program
  .command('parent-command')
  .description('父命令描述');

subCmd
  .command('sub-command <param>')
  .description('子命令描述')
  .option('-o, --option <value>', '选项描述')
  .action(async (param, options) => {
    try {
      const commandModule = require('../lib/commands/parent-command');
      await commandModule.subCommand(param, options);
    } catch (error) {
      console.error(chalk.red('子命令执行失败:'), error.message);
      process.exit(1);
    }
  });
```

### 2. 命令实现规范

#### 命令模块结构
```javascript
// lib/commands/example.js
const chalk = require('chalk');
const ora = require('ora');

/**
 * 执行示例命令
 * @param {Object} options - 命令选项
 * @param {string} options.param - 参数值
 * @param {boolean} options.flag - 标志选项
 */
async function execute(options) {
  const spinner = ora('执行中...').start();
  
  try {
    // 1. 参数验证
    validateOptions(options);
    
    // 2. 业务逻辑
    const result = await performAction(options);
    
    // 3. 结果输出
    spinner.succeed('执行成功');
    console.log(chalk.green('结果:'), result);
    
  } catch (error) {
    spinner.fail('执行失败');
    throw error;
  }
}

/**
 * 验证命令选项
 * @param {Object} options - 命令选项
 */
function validateOptions(options) {
  if (!options.param) {
    throw new Error('缺少必需参数 --param');
  }
}

/**
 * 执行具体业务逻辑
 * @param {Object} options - 命令选项
 * @returns {Promise<any>} 执行结果
 */
async function performAction(options) {
  // 实现具体逻辑
  return '执行结果';
}

module.exports = {
  execute,
  validateOptions,
  performAction
};
```

### 3. 选项设计规范

#### 选项命名规范
- 短选项：单个字母，如 `-v`, `-h`
- 长选项：描述性名称，如 `--version`, `--help`
- 参数选项：使用尖括号，如 `--file <path>`
- 布尔选项：不使用参数，如 `--force`, `--verbose`

#### 常用选项模式
```javascript
// 帮助选项（自动添加）
.option('-h, --help', '显示帮助信息')

// 版本选项（自动添加）
.option('-v, --version', '显示版本号')

// 文件路径选项
.option('-f, --file <path>', '指定文件路径')

// 布尔标志选项
.option('--force', '强制执行，跳过确认')

// 多值选项
.option('-e, --env <environment>', '指定环境', 'development')

// 必需参数
.argument('<required-param>', '必需参数描述')
```

## 📁 文件结构规范

### 命令文件命名
- 文件名：使用小写字母和连字符，如 `build.js`, `upgrade.js`
- 目录名：使用小写字母和连字符，如 `commands/`, `utils/`

### 工具模块命名
- 功能模块：`功能名.js`，如 `git.js`, `config.js`
- 工具模块：`工具名-manager.js`，如 `proxy-manager.js`

### 文件组织原则
1. **单一职责**：每个文件只负责一个功能
2. **模块化**：相关功能组织在一起
3. **可复用**：工具函数独立成模块
4. **可测试**：每个函数都可以独立测试

## 💻 代码规范

### 1. 代码风格
```javascript
// ✅ 好的示例
const chalk = require('chalk');
const ora = require('ora');

/**
 * 执行命令的主要函数
 * @param {Object} options - 命令选项
 * @returns {Promise<void>}
 */
async function execute(options) {
  try {
    // 业务逻辑
    const result = await performAction(options);
    console.log(chalk.green('成功:'), result);
  } catch (error) {
    console.error(chalk.red('错误:'), error.message);
    throw error;
  }
}

// ❌ 避免的写法
function execute(options) {
  // 缺少注释
  // 没有错误处理
  // 没有类型说明
}
```

### 2. 注释规范
```javascript
/**
 * 函数描述
 * @param {类型} 参数名 - 参数描述
 * @param {类型} [可选参数] - 可选参数描述
 * @returns {类型} 返回值描述
 * @throws {Error} 可能抛出的错误
 * @example
 * // 使用示例
 * await functionName(options);
 */
```

### 3. 错误处理规范
```javascript
// ✅ 统一的错误处理
try {
  await riskyOperation();
} catch (error) {
  // 记录详细错误信息
  console.error(chalk.red('操作失败:'), error.message);
  
  // 提供解决建议
  if (error.code === 'ENOENT') {
    console.log(chalk.yellow('建议: 检查文件路径是否正确'));
  }
  
  // 重新抛出错误供上层处理
  throw error;
}
```

### 4. 异步操作规范
```javascript
// ✅ 使用 async/await
async function performAsyncOperation() {
  try {
    const result = await someAsyncFunction();
    return result;
  } catch (error) {
    throw new Error(`异步操作失败: ${error.message}`);
  }
}

// ✅ 并行操作
async function performParallelOperations() {
  const [result1, result2] = await Promise.all([
    operation1(),
    operation2()
  ]);
  return { result1, result2 };
}
```

## 🚨 错误处理规范

### 1. 错误类型分类
```javascript
// 参数错误
class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

// 网络错误
class NetworkError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NetworkError';
  }
}

// 业务逻辑错误
class BusinessError extends Error {
  constructor(message) {
    super(message);
    this.name = 'BusinessError';
  }
}
```

### 2. 错误处理模式
```javascript
async function execute(options) {
  try {
    // 参数验证
    if (!options.param) {
      throw new ValidationError('缺少必需参数');
    }
    
    // 业务逻辑
    const result = await performAction(options);
    return result;
    
  } catch (error) {
    // 根据错误类型处理
    if (error instanceof ValidationError) {
      console.error(chalk.red('参数错误:'), error.message);
      console.log(chalk.yellow('使用 --help 查看正确用法'));
    } else if (error instanceof NetworkError) {
      console.error(chalk.red('网络错误:'), error.message);
      console.log(chalk.yellow('请检查网络连接'));
    } else {
      console.error(chalk.red('未知错误:'), error.message);
    }
    
    throw error;
  }
}
```

## 🧪 测试规范

### 1. 测试文件结构
```
tests/
├── commands/
│   ├── build.test.js
│   ├── lang.test.js
│   └── upgrade.test.js
├── utils/
│   ├── git.test.js
│   └── update-checker.test.js
└── fixtures/
    └── test-data.json
```

### 2. 测试用例规范
```javascript
// tests/commands/example.test.js
const { execute } = require('../../lib/commands/example');

describe('Example Command', () => {
  test('应该成功执行命令', async () => {
    const options = { param: 'test' };
    const result = await execute(options);
    expect(result).toBeDefined();
  });
  
  test('应该处理参数错误', async () => {
    const options = {};
    await expect(execute(options)).rejects.toThrow('缺少必需参数');
  });
});
```

## 📦 发布规范

### 1. 版本更新流程
1. 更新 `package.json` 版本号
2. 更新 `CHANGELOG.md` 记录变更
3. 更新 `README.md` 文档（如需要）
4. 提交代码并创建标签
5. 发布到 npm

### 2. 变更日志规范
```markdown
## [版本号] - 日期

### 新增
- 新功能描述

### 更改
- 功能改进描述

### 修复
- 问题修复描述

### 移除
- 移除功能描述
```

## ❓ 常见问题

### Q1: 如何添加新的命令选项？
A: 在命令注册时添加 `.option()` 调用，在命令实现中处理该选项。

### Q2: 如何处理异步操作？
A: 使用 `async/await` 语法，确保错误被正确捕获和处理。

### Q3: 如何添加子命令？
A: 使用 `program.command()` 创建父命令，然后使用 `.command()` 添加子命令。

### Q4: 如何确保命令的向后兼容性？
A: 避免删除现有选项，使用弃用警告而不是直接删除。

### Q5: 如何处理网络请求？
A: 使用 `axios` 库，设置合理的超时时间，添加错误处理。

## 🔧 开发工具推荐

### 代码质量工具
- ESLint: 代码风格检查
- Prettier: 代码格式化
- Jest: 单元测试

### 调试工具
- Node.js 内置调试器
- VS Code 调试配置
- 日志输出工具

## 📚 参考资源

- [Commander.js 文档](https://github.com/tj/commander.js)
- [Node.js 最佳实践](https://github.com/goldbergyoni/nodebestpractices)
- [语义化版本规范](https://semver.org/lang/zh-CN/)

---

**注意**: 本文档会随着项目发展持续更新，请确保使用最新版本。
