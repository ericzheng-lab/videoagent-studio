/**
 * 便宜视频生成适配器
 * Wan2.2-flash / Kling-o1 / Runway-gen4_turbo
 * 价格: ¥0.8/次左右
 */

const BASE_URL = "https://api.bltcy.ai";

// 便宜视频模型映射
const CHEAP_VIDEO_MODELS = {
  // Kling 经济版
  "kling-o1": "kling-video-o1",
  "kling-video-o1": "kling-video-o1",
  
  // Runway 快速版
  "runway-turbo": "runwayml-gen4_turbo",
  "runway-gen4-turbo": "runwayml-gen4_turbo",
};

// 模型价格 (用于日志/提示)
const MODEL_PRICES = {
  "kling-video-o1": "¥0.8",
  "runwayml-gen4_turbo": "¥0.8",
};

async function generateCheapVideo(params, apiKey) {
  const {
    mode,
    prompt,
    imageUrl,
    duration = 5,
    aspectRatio = "16:9",
    model = "wan2.2-flash",
  } = params;

  // 映射模型 ID
  const videoModel = CHEAP_VIDEO_MODELS[model] || model;

  // 根据模型选择端点
  let endpoint, body;

  if (videoModel.startsWith("wan")) {
    // 阿里万相格式
    endpoint = `${BASE_URL}/v2/videos/generations`;
    body = buildWanRequest(videoModel, mode, prompt, imageUrl, duration, aspectRatio);
  } else if (videoModel.startsWith("kling")) {
    // Kling 格式
    const { generateKlingVideo } = require("./generate-kling");
    return generateKlingVideo({ ...params, model: videoModel }, apiKey);
  } else if (videoModel.startsWith("runway")) {
    // Runway 格式
    const { generateRunwayVideo } = require("./generate-runway");
    return generateRunwayVideo({ ...params, model: videoModel }, apiKey);
  } else {
    throw new Error(`Unknown cheap video model: ${videoModel}`);
  }

  // 调用 API
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
    throw new Error(error.message || `Video API error: ${response.status}`);
  }

  const data = await response.json();

  // 处理异步任务返回
  if (data.task_id || data.id) {
    return {
      success: true,
      mode,
      model: videoModel,
      price: MODEL_PRICES[videoModel] || "unknown",
      jobId: data.task_id || data.id,
      status: "pending",
      message: `Video generation started (${MODEL_PRICES[videoModel]}/次). Poll for result.`,
    };
  }

  // 直接返回 URL
  if (data.video_url || data.url) {
    return {
      success: true,
      mode,
      model: videoModel,
      price: MODEL_PRICES[videoModel] || "unknown",
      videoUrl: data.video_url || data.url,
      duration: parseInt(duration),
      aspectRatio,
    };
  }

  throw new Error("Unexpected video API response");
}

function buildWanRequest(model, mode, prompt, imageUrl, duration, aspectRatio) {
  const body = {
    model: model,
    prompt: prompt,
  };

  // 万相尺寸映射
  const arMap = {
    "16:9": "1280x720",
    "9:16": "720x1280",
    "1:1": "720x720",
    "4:3": "960x720",
    "3:4": "720x960",
  };
  
  if (arMap[aspectRatio]) {
    const [width, height] = arMap[aspectRatio].split("x");
    body.width = parseInt(width);
    body.height = parseInt(height);
  }

  // 时长 (万相默认 5s)
  const dur = parseInt(duration) || 5;
  if (dur > 5) {
    body.duration = dur; // 部分模型支持更长
  }

  // 图生视频
  if (mode === "image-to-video" && imageUrl) {
    body.image_url = imageUrl;
    // 万相 i2v 模型名可能需要调整
    if (model === "wan2.2-flash") {
      body.model = "wan2.2-i2v"; // 假设有 i2v 版本
    }
  }

  return body;
}

async function checkCheapVideoStatus(taskId, model, apiKey) {
  // 根据模型类型路由到不同的检查方法
  if (model.startsWith("wan")) {
    return checkWanStatus(taskId, apiKey);
  } else if (model.startsWith("kling")) {
    const { checkKlingStatus } = require("./generate-kling");
    return checkKlingStatus(taskId, apiKey);
  } else if (model.startsWith("runway")) {
    const { checkRunwayStatus } = require("./generate-runway");
    return checkRunwayStatus(taskId, apiKey);
  }
  
  throw new Error(`Unknown model for status check: ${model}`);
}

async function checkWanStatus(taskId, apiKey) {
  const endpoint = `${BASE_URL}/v2/videos/generations/${taskId}`;
  
  const response = await fetch(endpoint, {
    headers: {
      "Authorization": `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to check Wan status: ${response.status}`);
  }

  const data = await response.json();
  const status = data.status;

  if (status === "completed" || status === "succeeded") {
    return {
      success: true,
      status: "completed",
      videoUrl: data.video_url || data.output?.video?.url || data.url,
    };
  }

  return {
    success: true,
    status: status,
    message: data.message || `Task ${status}`,
  };
}

module.exports = {
  generateCheapVideo,
  checkCheapVideoStatus,
  CHEAP_VIDEO_MODELS,
  MODEL_PRICES,
};