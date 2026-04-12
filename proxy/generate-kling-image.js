/**
 * Kling Image Generator Adapter for bltcy.ai
 * 支持 Kling Image 2.1 等图像生成模型
 */

const KLING_IMAGE_BASE_URL = "https://api.bltcy.ai/kling/v1";

// Kling Image 模型映射
const KLING_IMAGE_MODELS = {
  "kling-image": "kling-image",
  "kling-image-v1": "kling-image-v1",
  "kling-image-v1-5": "kling-image-v1-5",
  "kling-image-v2": "kling-image-v2",
  "kling-image-v2-1": "kling-image-v2-1",
  "kling-image-2-1": "kling-image-v2-1",
  "kling-image-expend": "kling-image-expend",
};

/**
 * Kling Image 生成
 * @param {Object} params
 * @param {string} params.prompt - 提示词
 * @param {string} params.model - 模型名 (默认 kling-image-v2-1)
 * @param {string} params.size - 尺寸 (1024x1024, 1024x1536, 1536x1024)
 * @param {number} params.n - 生成数量 (1-4)
 * @param {string} apiKey
 */
async function generateKlingImage(params, apiKey) {
  const {
    prompt,
    model = "kling-image-v2-1",
    size = "1024x1024",
    n = 1,
    // 高级参数
    seed,
    negativePrompt,
    quality,
  } = params;

  // 映射模型 ID
  const klingModel = KLING_IMAGE_MODELS[model] || model;

  // 端点
  const endpoint = `${KLING_IMAGE_BASE_URL}/images/generations`;

  const body = {
    model: klingModel,
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

  // 质量
  if (quality === "hd" || quality === "high") {
    body.quality = "hd";
  }

  // 高级参数
  if (seed !== undefined && seed !== null) {
    body.seed = seed;
  }
  if (negativePrompt) {
    body.negative_prompt = negativePrompt;
  }

  console.log('[Kling Image] Request:', endpoint, JSON.stringify(body));

  // 调用 Kling Image API
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Kling Image] Error:', errorText);
    throw new Error(`Kling Image API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  console.log('[Kling Image] Response:', JSON.stringify(data).slice(0, 500));

  // Kling Image 返回异步任务
  if (data.code === 0 && data.data && data.data.task_id) {
    return {
      success: true,
      model: klingModel,
      taskId: data.data.task_id,
      status: data.data.task_status || "pending",
      message: "Image generation started. Poll for result.",
    };
  }

  // 错误处理
  if (data.code !== 0) {
    throw new Error(data.message || `Kling Image API error: code ${data.code}`);
  }

  throw new Error("Unexpected Kling Image API response");
}

/**
 * 查询 Kling Image 任务状态
 */
async function checkKlingImageStatus(taskId, apiKey) {
  const endpoint = `${KLING_IMAGE_BASE_URL}/images/generations/${taskId}`;

  const response = await fetch(endpoint, {
    headers: {
      "Authorization": `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to check status: ${response.status}`);
  }

  const data = await response.json();
  console.log('[Kling Image Status]:', JSON.stringify(data).slice(0, 500));

  const status = data.data?.task_status || data.status;

  // 完成状态
  if (status === "completed" && data.data?.image_url) {
    return {
      success: true,
      status: "completed",
      imageUrl: data.data.image_url,
      images: [{ url: data.data.image_url }],
    };
  }

  // 如果返回了结果数组
  if (status === "completed" && data.data?.results && data.data.results.length > 0) {
    const images = data.data.results.map(r => ({ url: r.url || r.image_url }));
    return {
      success: true,
      status: "completed",
      imageUrl: images[0].url,
      images: images,
    };
  }

  return {
    success: true,
    status: status,
    message: data.message || `Task ${status}`,
  };
}

module.exports = {
  generateKlingImage,
  checkKlingImageStatus,
  KLING_IMAGE_MODELS,
};
