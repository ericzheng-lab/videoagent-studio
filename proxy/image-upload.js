/**
 * Image Upload Service - 阿里云 OSS 版本
 * 将 base64 图片上传到阿里云 OSS，返回可访问的 URL
 */

const OSS = require('ali-oss');

// 从环境变量读取配置
const OSS_CONFIG = {
  accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID,
  accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET,
  endpoint: process.env.ALIYUN_OSS_ENDPOINT || 'oss-cn-hangzhou.aliyuncs.com',
  bucket: process.env.ALIYUN_OSS_BUCKET || 'drs-88',
  region: process.env.ALIYUN_OSS_REGION || 'oss-cn-hangzhou',
};

// 创建 OSS 客户端
function createOSSClient() {
  if (!OSS_CONFIG.accessKeyId || !OSS_CONFIG.accessKeySecret) {
    throw new Error('OSS credentials not configured. Set ALIYUN_ACCESS_KEY_ID and ALIYUN_ACCESS_KEY_SECRET env vars.');
  }

  return new OSS({
    accessKeyId: OSS_CONFIG.accessKeyId,
    accessKeySecret: OSS_CONFIG.accessKeySecret,
    endpoint: OSS_CONFIG.endpoint,
    bucket: OSS_CONFIG.bucket,
    region: OSS_CONFIG.region,
  });
}

/**
 * 上传 base64 图片到阿里云 OSS
 * @param {string} base64Data - base64 编码的图片数据
 * @param {string} filename - 文件名
 * @returns {Promise<string>} - 图片 URL
 */
async function uploadToOSS(base64Data, filename) {
  const client = createOSSClient();
  
  // 清理 base64 数据
  const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(cleanBase64, 'base64');
  
  // 生成云端路径
  const date = new Date();
  const datePrefix = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
  const uniqueId = Math.random().toString(36).substring(2, 10);
  
  // 根据文件名前缀判断存储路径
  const isMJ = filename.startsWith('mj-');
  const folderPrefix = isMJ ? 'mj-images' : 'videoagent-images';
  const objectName = `${folderPrefix}/${datePrefix}/${uniqueId}_${filename}`;
  
  try {
    // 上传到 OSS
    const result = await client.put(objectName, buffer);
    
    // 生成公共访问 URL
    const publicUrl = `https://${OSS_CONFIG.bucket}.${OSS_CONFIG.endpoint}/${objectName}`;
    
    return publicUrl;
    
  } catch (error) {
    console.error('[OSS] Upload failed:', error.message);
    throw error;
  }
}

/**
 * 智能上传 - 优先使用 OSS
 * @param {string} base64Data - base64 图片
 * @param {string} filename - 文件名
 * @returns {Promise<string>} - 图片 URL
 */
async function uploadImage(base64Data, filename = 'image.jpg') {
  // 如果已经是 URL，直接返回
  if (base64Data.startsWith('http://') || base64Data.startsWith('https://')) {
    return base64Data;
  }
  
  // 尝试 OSS 上传
  try {
    const url = await uploadToOSS(base64Data, filename);
    return url;
  } catch (e) {
    console.warn('[Upload] OSS failed, falling back to base64:', e.message);
    // OSS 失败，返回 base64 (Discord 可能显示不了，但 Web UI 可以)
    return base64Data.startsWith('data:') ? base64Data : `data:image/jpeg;base64,${base64Data}`;
  }
}

module.exports = {
  uploadImage,
  uploadToOSS,
  OSS_CONFIG,
};
