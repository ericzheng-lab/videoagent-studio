/**
 * Wan Video Generator Adapter for bltcy.ai (阿里通义万相)
 * 最便宜的视频生成选项
 */

const WAN_BASE_URL = "https://api.bltcy.ai/v2";

// Wan 模型映射 - 基于 API 实际支持的模型
const WAN_MODELS = {
  // T2V (文生视频)
  "wan": "wan2.2-t2v-plus",
  "wan-flash": "wan2.2-t2v-plus",
  "wan2.2-flash": "wan2.2-t2v-plus",
  "wan-plus": "wan2.2-t2v-plus",
  "wan2.2-t2v-plus": "wan2.2-t2v-plus",
  "wan2.2-t2v": "wan2.2-t2v-plus",
  
  // 更便宜的选项 (如果有权限)
  "wan2.2-i2v-flash": "wan2.2-i2v-flash",
  "wan-turbo": "wanx2.1-t2v-turbo",
  "wanx2.1-turbo": "wanx2.1-t2v-turbo",
  "wanx2.1-t2v-turbo": "wanx2.1-t2v-turbo",
  
  // I2V (图生视频)
  "wan-i2v": "wan2.2-i2v-plus",
  "wan2.2-i2v": "wan2.2-i2v-plus",
  "wan2.2-i2v-plus": "wan2.2-i2v-plus",
  
  // 新版本 (可能更贵)
  "wan2.5": "wan2.5-t2v-preview",
  "wan2.5-t2v": "wan2.5-t2v-preview",
  "wan2.5-t2v-preview": "wan2.5-t2v-preview",
  "wan2.6": "wan2.6-t2v",
  "wan2.6-t2v": "wan2.6-t2v",
};

// 模型价格 (基于文档，实际以 API 返回为准)
const WAN_PRICES = {
  "wan2.2-t2v-plus": "¥0.8",
  "wan2.2-i2v-plus": "¥0.8",
  "wan2.2-i2v-flash": "¥0.5",  // 估计更便宜
  "wanx2.1-t2v-turbo": "¥0.96",
  "wanx2.1-t2v-plus": "¥2.8",
  "wan2.5-t2v-preview": "¥4",
  "wan2.6-t2v": "¥4",
};

async function generateWanVideo(params, apiKey) {
  const {
    mode,
    prompt,
    imageUrl,
    duration = 5,
    aspectRatio = "16:9",
    model = "wan2.2-flash",
    // 高级参数
    seed,
    num_inference_steps,
    // Reference 参数
    image_url,
    style,
  } = params;

  const wanModel = WAN_MODELS[model] || model;

  // Wan 使用 /videos/generations 端点
  const endpoint = `${WAN_BASE_URL}/videos/generations`;

  const body = {
    model: wanModel,
    prompt: prompt,
  };

  // 尺寸映射
  const arMap = {
    "16:9": { width: 1280, height: 720 },
    "9:16": { width: 720, height: 1280 },
    "1:1": { width: 720, height: 720 },
    "4:3": { width: 960, height: 720 },
    "3:4": { width: 720, height: 960 },
  };
  
  if (arMap[aspectRatio]) {
    body.width = arMap[aspectRatio].width;
    body.height = arMap[aspectRatio].height;
  }

  // 时长 (Wan 默认 5s)
  const dur = parseInt(duration) || 5;
  if (dur !== 5) {
    body.duration = dur;
  }

  // 图生视频
  if (mode === "image-to-video" && imageUrl) {
    body.image_url = imageUrl;
    // I2V 使用 i2v 版本
    if (wanModel === "wan2.2-t2v-plus") {
      body.model = "wan2.2-i2v-plus";
    } else if (wanModel === "wanx2.1-t2v-turbo") {
      body.model = "wanx2.1-i2v-turbo";
    }
  }

  // 添加高级参数
  if (seed !== undefined && seed !== null) {
    body.seed = seed;
  }
  if (num_inference_steps) {
    body.num_inference_steps = num_inference_steps;
  }

  // 添加 Reference 参数
  if (image_url) {
    body.image_url = image_url;
  }
  if (style) {
    body.style = style;
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  // 处理响应 - Wan 直接返回 task_id
  if (data.task_id) {
    return {
      success: true,
      mode,
      model: wanModel,
      price: WAN_PRICES[wanModel] || "unknown",
      jobId: data.task_id,
      status: "pending",
      message: `Video generation started (${WAN_PRICES[wanModel]}/次). Poll for result.`,
    };
  }

  if (data.error) {
    throw new Error(`Wan API error: ${data.error.message || JSON.stringify(data.error)}`);
  }

  throw new Error(`Unexpected Wan API response`);
}

async function checkWanStatus(taskId, apiKey) {
  const endpoint = `${WAN_BASE_URL}/videos/generations/${taskId}`;
  
  const response = await fetch(endpoint, {
    headers: {
      "Authorization": `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to check Wan status: ${response.status}`);
  }

  const data = await response.json();

  // 处理 Wan 状态响应
  const task = data.data || data;
  const status = task.task_status || task.status;

  if (status === "completed" || status === "succeeded") {
    return {
      success: true,
      status: "completed",
      videoUrl: task.video_url || task.task_result?.video?.url || task.url,
    };
  }

  return {
    success: true,
    status: status,
    message: task.task_status_msg || task.message || `Task ${status}`,
  };
}

module.exports = {
  generateWanVideo,
  checkWanStatus,
  WAN_MODELS,
  WAN_PRICES,
};