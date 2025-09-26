/**
 * 微软翻译API客户端
 * 处理与微软翻译API的所有HTTP通信
 */
const axios = require('axios');
const { getAuthService } = require('./EdgeAuthService');

class MicrosoftHttpClient {
  constructor() {
    this.baseURL = 'https://api.cognitive.microsofttranslator.com';
    this.apiVersion = '3.0';
    this.authService = getAuthService();
  }

  /**
   * 发送POST请求到微软翻译API
   * @param {string} endpoint API端点
   * @param {any} data 请求数据
   * @param {Object} options 请求选项
   * @returns {Promise<any>} API响应
   */
  async post(endpoint, data, options = {}) {
    try {
      const token = await this.authService.getAccessToken();
      const url = `${this.baseURL}${endpoint}?api-version=${this.apiVersion}`;
      
      const response = await axios.post(url, data, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        params: {
          ...options.params
        },
        timeout: 30000,
        ...options
      });

      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * 处理API错误
   * @param {Error} error 错误对象
   */
  handleError(error) {
    if (error.response) {
      const status = error.response.status;
      const statusText = error.response.statusText;
      const errorData = error.response.data;
      
      console.error(`API请求失败: ${status} ${statusText}`, errorData);
      
      let message = `${status} ${statusText}`;
      let code = status;
      
      if (errorData && errorData.error) {
        message += ` - ${errorData.error.message || errorData.error}`;
        code = errorData.error.code || status;
      }
      
      throw new Error(`微软翻译API错误: ${message} (代码: ${code})`);
    } else if (error.request) {
      console.error('网络请求失败:', error.message);
      throw new Error(`网络请求失败: ${error.message}`);
    } else {
      console.error('请求配置错误:', error.message);
      throw new Error(`请求配置错误: ${error.message}`);
    }
  }

  /**
   * 构建查询参数
   * @param {Object} params 参数对象
   * @returns {string} 查询字符串
   */
  buildQueryString(params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, value);
      }
    });
    return searchParams.toString();
  }
}

module.exports = MicrosoftHttpClient;
