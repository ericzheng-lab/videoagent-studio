/**
 * 错误处理工具
 */

class APIError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'APIError';
    this.code = code;
    this.details = details;
  }
}

// 错误代码映射
const ERROR_CODES = {
  // 客户端错误
  400: 'Bad Request - 请求参数错误',
  401: 'Unauthorized - API Key 无效或过期',
  403: 'Forbidden - 没有权限访问此资源',
  404: 'Not Found - 模型或端点不存在',
  429: 'Too Many Requests - 请求过于频繁，请稍后再试',
  
  // 服务端错误
  500: 'Internal Server Error - 服务器内部错误',
  502: 'Bad Gateway - 网关错误',
  503: 'Service Unavailable - 服务暂时不可用',
  504: 'Gateway Timeout - 请求超时',
};

// bltcy.ai 特定错误
const BLTCY_ERRORS = {
  1201: '模型不支持 - 请检查模型 ID 是否正确',
  1202: '参数错误 - 请检查请求参数',
  1203: '余额不足 - 请充值账户',
  1204: '任务超时 - 请稍后重试',
};

function handleError(error, context = '') {
  // HTTP 状态码错误
  if (error.status || error.statusCode) {
    const code = error.status || error.statusCode;
    const message = ERROR_CODES[code] || `HTTP Error ${code}`;
    return {
      success: false,
      error: message,
      code: code,
      context: context,
      suggestion: getSuggestion(code),
    };
  }
  
  // bltcy.ai 业务错误
  if (error.code && BLTCY_ERRORS[error.code]) {
    return {
      success: false,
      error: BLTCY_ERRORS[error.code],
      code: error.code,
      context: context,
      suggestion: getSuggestion(error.code, 'bltcy'),
    };
  }
  
  // 网络错误
  if (error.message && error.message.includes('fetch')) {
    return {
      success: false,
      error: '网络连接失败 - 请检查网络连接',
      context: context,
      suggestion: '请检查网络连接，或稍后重试',
    };
  }
  
  // 默认错误
  return {
    success: false,
    error: error.message || '未知错误',
    context: context,
    suggestion: '请检查配置或联系管理员',
  };
}

function getSuggestion(code, type = 'http') {
  const suggestions = {
    // HTTP 错误建议
    400: '请检查模型 ID 和参数是否正确',
    401: '请检查 BLTCY_API_KEY 是否正确设置',
    404: '请检查模型 ID 是否在支持列表中',
    429: '请降低请求频率，或稍后重试',
    500: '服务器暂时不可用，请稍后重试',
    503: '服务暂时不可用，请稍后重试',
    
    // bltcy 错误建议
    1201: '请使用支持的模型 ID，如 flux, kling-video-v2-6 等',
    1202: '请检查请求参数格式是否正确',
    1203: '请前往 bltcy.ai 充值账户',
    1204: '任务处理时间较长，请稍后查询状态',
  };
  
  return suggestions[code] || '请检查配置或联系管理员';
}

// 重试机制
async function withRetry(fn, options = {}) {
  const {
    maxRetries = 3,
    delay = 1000,
    backoff = 2,
  } = options;
  
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // 不重试的错误
      if (error.code === 401 || error.code === 403 || error.code === 1203) {
        throw error;
      }
      
      // 等待后重试
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(backoff, i)));
      }
    }
  }
  
  throw lastError;
}

module.exports = {
  APIError,
  ERROR_CODES,
  BLTCY_ERRORS,
  handleError,
  withRetry,
};