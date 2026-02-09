/**
 * Edge浏览器认证服务
 * 模拟Edge浏览器的认证机制，获取免费的微软翻译API访问令牌
 */
const axios = require('axios');

class MicrosoftEdgeAuthService {
  constructor() {
    this.accessToken = null;
    this.expireAt = -1;
    this.tokenPromise = null;
    
    // 常量定义
    this.TIMEOUT = 60 * 1000; // 1分钟超时
    this.PRE_EXPIRATION = 2 * 60 * 1000; // 提前2分钟刷新
    this.DEFAULT_EXPIRATION = 10 * 60 * 1000; // 默认10分钟过期
    this.AUTH_URL = 'https://edge.microsoft.com/translate/auth';
    this.JWT_REGEX = /^[a-zA-Z0-9\-_]+(\.[a-zA-Z0-9\-_]+){2}$/;
  }

  /**
   * 获取有效的访问令牌
   * @returns {Promise<string>} 访问令牌
   */
  async getAccessToken() {
    // 检查当前令牌是否仍然有效
    const validToken = this.getValidAccessToken();
    if (validToken) {
      return validToken;
    }

    // 获取新的令牌
    const promise = this.getTokenPromise();
    try {
      const token = await promise;
      if (!token) {
        throw new Error('无法获取访问令牌');
      }
      return token;
    } catch (error) {
      this.clearTokenPromise(promise);
      throw new Error(`认证失败: ${error.message}`);
    }
  }

  /**
   * 获取有效的访问令牌（同步检查）
   * @returns {string|null} 有效的访问令牌或null
   */
  getValidAccessToken() {
    if (this.accessToken && Date.now() < this.expireAt) {
      return this.accessToken;
    }
    return null;
  }

  /**
   * 更新访问令牌
   * @param {string} token 新的访问令牌
   */
  updateAccessToken(token) {
    const expirationTime = this.getExpirationTimeFromToken(token);
    this.accessToken = token;
    this.expireAt = expirationTime - this.PRE_EXPIRATION;
    this.tokenPromise = null;
  }

  /**
   * 获取令牌Promise
   * @returns {Promise<string>} 令牌Promise
   */
  getTokenPromise() {
    if (this.tokenPromise) {
      return this.tokenPromise;
    }

    const promise = this.fetchAccessToken();
    this.tokenPromise = promise;
    return promise;
  }

  /**
   * 从Edge认证服务获取访问令牌
   * @returns {Promise<string>} 访问令牌
   */
  async fetchAccessToken() {
    try {
      const response = await axios.get(this.AUTH_URL, {
        headers: {
          'Accept': '*/*',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0'
        },
        timeout: this.TIMEOUT
      });

      const token = response.data;
      
      // 验证JWT格式
      if (!this.JWT_REGEX.test(token)) {
        throw new Error('认证失败: 无效的令牌格式');
      }

      this.updateAccessToken(token);
      return token;
    } catch (error) {
      console.warn('获取访问令牌失败:', error.message);
      throw error;
    }
  }

  /**
   * 清除令牌Promise
   * @param {Promise} whosePromise 要清除的Promise
   */
  clearTokenPromise(whosePromise) {
    if (whosePromise === this.tokenPromise) {
      this.tokenPromise = null;
    }
  }

  /**
   * 从JWT令牌中提取过期时间
   * @param {string} token JWT令牌
   * @returns {number} 过期时间戳（毫秒）
   */
  getExpirationTimeFromToken(token) {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('无效的JWT格式');
      }

      const payload = parts[1];
      const decoded = Buffer.from(payload, 'base64url').toString('utf-8');
      const parsed = JSON.parse(decoded);
      
      // JWT的exp字段是秒，需要转换为毫秒
      return parsed.exp * 1000;
    } catch (error) {
      console.warn('解析JWT令牌失败:', error.message);
      // 返回默认过期时间
      return Date.now() + this.DEFAULT_EXPIRATION - this.PRE_EXPIRATION / 2;
    }
  }
}

// 单例实例
let instance = null;

/**
 * 获取MicrosoftEdgeAuthService单例实例
 * @returns {MicrosoftEdgeAuthService} 服务实例
 */
function getAuthService() {
  if (!instance) {
    instance = new MicrosoftEdgeAuthService();
  }
  return instance;
}

module.exports = {
  MicrosoftEdgeAuthService,
  getAuthService
};
