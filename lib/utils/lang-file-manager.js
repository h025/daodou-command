const fs = require('fs');
const path = require('path');

class LangFileManager {
  /**
   * 添加键值对到 JSON 文件
   * @param {string} filePath 文件路径
   * @param {string} key 键名
   * @param {string} value 值
   * @returns {Object} 操作结果
   */
  async addKey(filePath, key, value) {
    try {
      // 检查目录是否存在
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        throw new Error(`目录不存在: ${dir}`);
      }

      // 检查文件是否存在
      if (!fs.existsSync(filePath)) {
        throw new Error(`文件不存在: ${filePath}`);
      }

      // 读取文件内容
      const content = fs.readFileSync(filePath, 'utf8');
      let data;

      try {
        data = JSON.parse(content);
      } catch (error) {
        throw new Error(`JSON 格式错误: ${error.message}`);
      }

      // 检查键是否已存在
      if (data.hasOwnProperty(key)) {
        return { success: false, skipped: true, message: '键已存在' };
      }

      // 添加键值对
      data[key] = value;

      // 写入文件
      const newContent = JSON.stringify(data, null, 2);
      fs.writeFileSync(filePath, newContent, 'utf8');

      return { success: true, message: '添加成功' };

    } catch (error) {
      throw error;
    }
  }

  /**
   * 从 JSON 文件删除键
   * @param {string} filePath 文件路径
   * @param {string} key 键名
   * @returns {Object} 操作结果
   */
  async removeKey(filePath, key) {
    try {
      // 检查目录是否存在
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        throw new Error(`目录不存在: ${dir}`);
      }

      // 检查文件是否存在
      if (!fs.existsSync(filePath)) {
        throw new Error(`文件不存在: ${filePath}`);
      }

      // 读取文件内容
      const content = fs.readFileSync(filePath, 'utf8');
      let data;

      try {
        data = JSON.parse(content);
      } catch (error) {
        throw new Error(`JSON 格式错误: ${error.message}`);
      }

      // 检查键是否存在
      if (!data.hasOwnProperty(key)) {
        return { success: false, notFound: true, message: '键不存在' };
      }

      // 删除键
      delete data[key];

      // 写入文件
      const newContent = JSON.stringify(data, null, 2);
      fs.writeFileSync(filePath, newContent, 'utf8');

      return { success: true, message: '删除成功' };

    } catch (error) {
      throw error;
    }
  }

  /**
   * 检查文件是否存在
   * @param {string} filePath 文件路径
   * @returns {boolean} 文件是否存在
   */
  fileExists(filePath) {
    return fs.existsSync(filePath);
  }

  /**
   * 检查目录是否存在
   * @param {string} dirPath 目录路径
   * @returns {boolean} 目录是否存在
   */
  dirExists(dirPath) {
    return fs.existsSync(dirPath);
  }

  /**
   * 读取 JSON 文件
   * @param {string} filePath 文件路径
   * @returns {Object} JSON 数据
   */
  readJsonFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`读取文件失败: ${error.message}`);
    }
  }

  /**
   * 写入 JSON 文件
   * @param {string} filePath 文件路径
   * @param {Object} data JSON 数据
   */
  writeJsonFile(filePath, data) {
    try {
      const content = JSON.stringify(data, null, 2);
      fs.writeFileSync(filePath, content, 'utf8');
    } catch (error) {
      throw new Error(`写入文件失败: ${error.message}`);
    }
  }
}

module.exports = {
  LangFileManager
};
