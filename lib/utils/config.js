const fs = require('fs');
const path = require('path');
const os = require('os');
const JSON5 = require('json5');

class ConfigManager {
  constructor() {
    this.configDir = path.join(os.homedir(), '.daodou');
    this.configFile = path.join(this.configDir, 'config.json');
    this.projectConfigFile = path.join(process.cwd(), '.daodourc');
    this.config = this.loadConfig();
  }

  /**
   * 加载配置文件
   */
  loadConfig() {
    let projectConfig = {};
    let globalConfig = {};
    
    // 读取项目配置文件
    if (fs.existsSync(this.projectConfigFile)) {
      projectConfig = this.loadConfigFile(this.projectConfigFile);
    }
    
    // 读取全局配置文件
    if (fs.existsSync(this.configFile)) {
      globalConfig = this.loadConfigFile(this.configFile);
    }
    
    // 合并配置：项目配置优先，全局配置作为回退
    return this.mergeConfigs(projectConfig, globalConfig);
  }

  /**
   * 加载配置并创建默认配置（仅用于 build 命令）
   */
  loadConfigWithDefault() {
    let projectConfig = {};
    let globalConfig = {};
    
    // 读取项目配置文件
    if (fs.existsSync(this.projectConfigFile)) {
      projectConfig = this.loadConfigFile(this.projectConfigFile);
    } else {
      // 如果项目配置文件不存在，创建默认配置
      console.log('⚠️ 未找到项目配置文件，正在创建默认配置...');
      this.createDefaultConfig();
      console.log('✅ 默认配置文件已创建');
      console.log('📝 请编辑配置文件，取消注释并填写 Jenkins 相关配置后重新运行命令');
      console.log('🔄 修改完成后请重新运行命令');
      process.exit(0);
    }
    
    // 读取全局配置文件
    if (fs.existsSync(this.configFile)) {
      globalConfig = this.loadConfigFile(this.configFile);
    }
    
    // 合并配置：项目配置优先，全局配置作为回退
    return this.mergeConfigs(projectConfig, globalConfig);
  }

  /**
   * 加载单个配置文件
   */
  loadConfigFile(filePath) {
    try {
      const data = fs.readFileSync(filePath, 'utf8');
      return this.parseConfig(data);
    } catch (error) {
      console.warn(`加载配置文件失败 ${filePath}:`, error.message);
      return {};
    }
  }

  /**
   * 合并配置：项目配置优先，全局配置作为回退
   */
  mergeConfigs(projectConfig, globalConfig) {
    const merged = { ...globalConfig };
    
    // 合并每个命令的配置
    for (const [command, config] of Object.entries(projectConfig)) {
      if (typeof config === 'object' && config !== null) {
        // 对于 build 命令，某些参数只能从本地配置读取
        if (command === 'build') {
          merged[command] = this.mergeBuildConfig(globalConfig[command] || {}, config);
        } else {
          merged[command] = { ...globalConfig[command], ...config };
        }
      } else {
        merged[command] = config;
      }
    }
    
    return merged;
  }

  /**
   * 合并 build 命令配置，jobName 等参数只能从本地配置读取
   */
  mergeBuildConfig(globalBuildConfig, localBuildConfig) {
    const merged = { ...globalBuildConfig };
    
    // 合并所有本地配置
    Object.assign(merged, localBuildConfig);
    
    // 如果本地配置中有 jobName，则使用本地的；否则清空全局的
    if (localBuildConfig.jobName) {
      merged.jobName = localBuildConfig.jobName;
    } else {
      delete merged.jobName;
    }
    
    
    return merged;
  }

  /**
   * 解析配置文件（支持 JSON5 和 INI 格式）
   */
  parseConfig(content) {
    // 检测是否为 JSON5 格式
    if (this.isJson5Format(content)) {
      return JSON5.parse(content);
    }
    
    // 回退到 INI 格式解析
    return this.parseIniFormat(content);
  }

  /**
   * 检测是否为 JSON5 格式
   */
  isJson5Format(content) {
    const trimmed = content.trim();
    return trimmed.startsWith('{') && trimmed.endsWith('}');
  }

  /**
   * 解析 INI 格式配置
   */
  parseIniFormat(content) {
    const config = {};
    const lines = content.split(/\r?\n/);
    
    for (const line of lines) {
      if (!line.trim() || line.trim().startsWith('#')) continue;
      const idx = line.indexOf('=');
      if (idx > 0) {
        const key = line.slice(0, idx).trim();
        const value = line.slice(idx + 1).trim();
        config[key] = value;
      }
    }
    
    return config;
  }

  /**
   * 保存配置文件
   */
  saveConfig() {
    try {
      // 确保配置目录存在
      if (!fs.existsSync(this.configDir)) {
        fs.mkdirSync(this.configDir, { recursive: true });
      }
      
      // 保存为 JSON5 格式
      const content = JSON5.stringify(this.config, null, 2);
      fs.writeFileSync(this.configFile, content);
    } catch (error) {
      console.error('保存配置文件失败:', error.message);
    }
  }

  /**
   * 创建默认配置文件
   */
  createDefaultConfig() {
    // 创建带注释的配置文件内容
    const configContent = `{
  // build 命令配置
  build: {
    // Jenkins 基础配置
    // jenkinsUrl: "https://jenkins.example.com/",
    // jenkinsBase: "https://jenkins.example.com/job",
    // jenkinsToken: "your-jenkins-token",
    // jenkinsUsername: "your-username",
    // jenkinsPassword: "your-password",
    
    // 构建任务配置（必须配置）
    // jobName: "your-job-name",  // 必须配置的任务名称
    
    // 构建参数配置
    // buildParams: {
    //   token: "your-jenkins-token",
    //   BUILD_ENV: "test",
    //   version: "0.0.1"
    // }
  },
  
  // lang 命令配置
  lang: {
    defaultLang: "en",
    defaultDir: "./public/locales",
    fileName: "common.json"
  }
}`;

    fs.writeFileSync(this.projectConfigFile, configContent);
    
    // 返回解析后的配置对象（用于验证）
    const defaultConfig = {
      build: {},
      lang: {
        defaultLang: "en",
        defaultDir: "./public/locales",
        fileName: "common.json"
      }
    };
    
    return defaultConfig;
  }

  /**
   * 获取配置值
   * @param {string} key 配置键
   * @param {*} defaultValue 默认值
   */
  get(key, defaultValue = null) {
    const keys = key.split('.');
    let value = this.config;
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return defaultValue;
      }
    }
    
    return value;
  }

  /**
   * 设置配置值
   * @param {string} key 配置键
   * @param {*} value 配置值
   */
  set(key, value) {
    const keys = key.split('.');
    let current = this.config;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!current[k] || typeof current[k] !== 'object') {
        current[k] = {};
      }
      current = current[k];
    }
    
    current[keys[keys.length - 1]] = value;
    this.saveConfig();
  }

  /**
   * 删除配置值
   * @param {string} key 配置键
   */
  delete(key) {
    const keys = key.split('.');
    let current = this.config;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!current[k] || typeof current[k] !== 'object') {
        return;
      }
      current = current[k];
    }
    
    delete current[keys[keys.length - 1]];
    this.saveConfig();
  }

  /**
   * 获取所有配置
   */
  getAll() {
    return { ...this.config };
  }

  /**
   * 设置Jenkins配置
   * @param {Object} jenkinsConfig Jenkins配置
   */
  setJenkinsConfig(jenkinsConfig) {
    this.set('jenkins', jenkinsConfig);
  }

  /**
   * 获取命令配置
   */
  getCommandConfig(commandName) {
    return this.get(commandName, {});
  }

  /**
   * 获取 build 命令配置
   */
  getBuildConfig() {
    return this.getCommandConfig('build');
  }

  /**
   * 获取 build 命令配置（带默认配置创建）
   */
  getBuildConfigWithDefault() {
    const config = this.loadConfigWithDefault();
    return config.build || {};
  }

  /**
   * 获取 lang 命令配置
   */
  getLangConfig() {
    return this.getCommandConfig('lang');
  }

  /**
   * 获取Jenkins配置（向后兼容）
   */
  getJenkinsConfig() {
    return this.getBuildConfig();
  }

  /**
   * 验证Jenkins配置
   * @param {Object} config Jenkins配置
   */
  validateJenkinsConfig(config) {
    const required = ['jenkinsUrl', 'jenkinsUsername', 'jenkinsToken'];
    const missing = required.filter(key => !config[key]);
    
    if (missing.length > 0) {
      throw new Error(`缺少必要的Jenkins配置: ${missing.join(', ')}`);
    }
    
    return true;
  }
}

module.exports = {
  ConfigManager
}; 