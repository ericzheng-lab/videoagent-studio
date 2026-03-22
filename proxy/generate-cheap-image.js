/**
 * 便宜图像生成适配器 (Flux / Stable Diffusion / Wanx-turbo)
 * 支持 bltcy.ai 上的经济型图像模型
 */

const CHEAP_IMAGE_BASE_URL = "https://api.bltcy.ai/v1";

// 便宜图像模型映射 - 基于 BLTCY 文档
const CHEAP_IMAGE_MODELS = {
  // Flux 系列 (¥0.01-0.05)
  "flux": "flux",
  "flux-dev": "flux-dev",
  "flux-schnell": "flux-schnell",
  
  // Stable Diffusion (¥0.01)
  "sd": "stable-diffusion",
  "stable-diffusion": "stable-diffusion",
  "sd-xl": "stable-diffusion-xl",
  
  // Grok 图像 (¥0.1-0.12)
  "grok": "grok-4.1-image",
  "grok-4.1": "grok-4.1-image",
  "grok-4.1-image": "grok-4.1-image",
  "grok-4.2": "grok-4.2-image",
  "grok-4.2-image": "grok-4.2-image",
  
  // Recraft (¥0.12)
  "recraft": "recraftv3",
  "recraftv3": "recraftv3",
  
  // 即梦/Seedance (¥0.1-0.15)
  "seedream": "seedream-3.0",
  "seedream-3.0": "seedream-3.0",
  "doubao-seedream": "doubao-seedream-3-0-t2i-250415",
};

async function generateCheapImage(params, apiKey) {
  const {
    prompt,
    model = "flux",
    size = "1024x1024",
    quality = "standard",
    n = 1,
    // 高级参数
    seed,
    negativePrompt,
  } = params;

  // 映射模型 ID
  const imageModel = CHEAP_IMAGE_MODELS[model] || model;

  // 构建请求
  const endpoint = `${CHEAP_IMAGE_BASE_URL}/images/generations`;

  const body = {
    model: imageModel,
    prompt: prompt,
    n: Math.min(Math.max(parseInt(n) || 1, 1), 4),
  };

  // 尺寸映射
  const sizeMap = {
    "1024x1024": "1024x1024",
    "1024x1536": "1024x1536",
    "1536x1024": "1536x1024",
    "512x512": "512x512",
    "768x768": "768x768",
  };
  if (sizeMap[size]) {
    body.size = sizeMap[size];
  }

  // 质量 (部分模型支持)
  if (quality === "hd" || quality === "high") {
    body.quality = "hd";
  }

  // 添加高级参数
  if (seed !== undefined && seed !== null) {
    body.seed = seed;
  }
  if (negativePrompt) {
    body.negative_prompt = negativePrompt;
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `Image API error: ${response.status}`);
  }

const { uploadImage } = require('./image-upload');

// ... existing code ...

  const data = await response.json();

  // OpenAI 格式返回 (bltcy.ai 返回的是 base64 数据)
  if (data.data && data.data[0]) {
    const img = data.data[0];
    let imageUrl = img.url;
    
    // 如果没有 URL，只有 base64，上传到阿里云 OSS
    if (!imageUrl && img.b64_json) {
      try {
        console.log('[Image] Uploading base64 to OSS...');
        imageUrl = await uploadImage(img.b64_json, `flux-${Date.now()}.jpg`);
        console.log('[Image] OSS URL:', imageUrl);
      } catch (e) {
        console.error('[Image] OSS upload failed:', e.message);
        // 失败时返回 base64 (Web UI 可以显示，Discord 不行)
        imageUrl = `data:image/jpeg;base64,${img.b64_json}`;
      }
    }
    
    return {
      success: true,
      model: imageModel,
      images: [{
        url: imageUrl,
        revised_prompt: img.revised_prompt,
      }],
      count: data.data.length,
    };
  }

  // 其他格式兼容
  if (data.url || data.image_url) {
    return {
      success: true,
      model: imageModel,
      images: [{ url: data.url || data.image_url }],
      count: 1,
    };
  }

  throw new Error("Unexpected image API response");
}

module.exports = {
  generateCheapImage,
  CHEAP_IMAGE_MODELS,
};