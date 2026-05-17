/**
 * Kling Studio - 统一适配器
 * 支持：视频生成、图像生成、视频转音频、对口型、数字人
 */

const KLING_BASE_URL = "https://api.bltcy.ai/kling/v1";
const { uploadImage } = require('./image-upload');

// ==================== 模型映射 ====================

const KLING_VIDEO_MODELS = {
  "kling-o1": "kling-video-o1",
  "kling-v2-6": "kling-video-v2-6",
  "kling-v2-5-turbo": "kling-video-v2-5-turbo",
  "kling-v2-1": "kling-video-v2-1",
  "kling-v2-1-master": "kling-video-v2-1-master",
  "kling-v3": "kling-video-v3",
  "kling-v3-omni": "kling-video-v3-omni",
};

const KLING_IMAGE_MODELS = {
  "kling-image": "kling-image",
  "kling-image-v1": "kling-image-v1",
  "kling-image-v1-5": "kling-image-v1-5",
  "kling-image-v2": "kling-image-v2",
  "kling-image-v2-1": "kling-image-v2-1",
  "kling-image-expend": "kling-image-expend",
};

const KLING_AUDIO_MODELS = {
  "kling-video-to-audio": "kling-video-to-audio",
  "kling-text-to-audio": "kling-text-to-audio",
  "kling-sound": "kling-text-to-audio",
};

const KLING_AVATAR_MODELS = {
  "kling-lip-sync": "kling-lip-sync",
  "kling-meta-human": "kling-meta-human",
};

// ==================== 视频生成 ====================

async function generateKlingVideo(params, apiKey) {
  const {
    mode = "text-to-video",
    prompt,
    imageUrl,
    videoUrl, // 用于视频延长或参考
    duration = 5,
    aspectRatio = "16:9",
    model = "kling-video-v2-6",
    // 高级参数
    seed,
    negativePrompt,
    cfg_scale,
    camera_motion,
    // Reference 参数
    reference_image,
    keyframe_images,
    reference_video,
    motion_transfer,
    character_consistency,
  } = params;

  const klingModel = KLING_VIDEO_MODELS[model] || model;

  // 确定端点
  let endpoint;
  if (mode === "image-to-video") {
    endpoint = `${KLING_BASE_URL}/videos/image2video`;
  } else if (mode === "video-extend") {
    endpoint = `${KLING_BASE_URL}/videos/extend`;
  } else {
    endpoint = `${KLING_BASE_URL}/videos/text2video`;
  }

  const body = {
    model: klingModel,
    prompt: prompt,
    duration: Math.min(Math.max(parseInt(duration) || 5, 1), 10),
  };

  // 画面比例
  const arMap = {
    "16:9": "16:9", "9:16": "9:16", "1:1": "1:1",
    "4:3": "4:3", "3:4": "3:4", "21:9": "21:9",
  };
  if (arMap[aspectRatio]) {
    body.aspect_ratio = arMap[aspectRatio];
  }

  // 图生视频
  if (mode === "image-to-video" && imageUrl) {
    body.image_url = imageUrl;
  }

  // 视频延长
  if (mode === "video-extend" && videoUrl) {
    body.video_url = videoUrl;
  }

  // 高级参数
  if (seed !== undefined) body.seed = seed;
  if (negativePrompt) body.negative_prompt = negativePrompt;
  if (cfg_scale !== undefined) body.cfg_scale = cfg_scale;
  if (camera_motion) body.camera_motion = camera_motion;

  // Reference 参数
  if (reference_image) body.reference_image = reference_image;
  if (keyframe_images?.length > 0) body.keyframe_images = keyframe_images;
  if (reference_video) body.reference_video = reference_video;
  if (motion_transfer) body.motion_transfer = motion_transfer;
  if (character_consistency) body.character_consistency = character_consistency;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (data.code === 0 && data.data?.task_id) {
    return {
      success: true,
      mode,
      model: klingModel,
      jobId: data.data.task_id,
      status: data.data.task_status || "pending",
      message: "Video generation started.",
    };
  }

  if (data.code !== 0) {
    throw new Error(data.message || `Kling API error: code ${data.code}`);
  }

  throw new Error("Unexpected Kling API response");
}

// ==================== 图像生成 ====================

async function generateKlingImage(params, apiKey) {
  const {
    prompt,
    model = "kling-image-v2-1",
    size = "1024x1024",
    n = 1,
    seed,
    negativePrompt,
    quality,
  } = params;

  const klingModel = KLING_IMAGE_MODELS[model] || model;
  const endpoint = `${KLING_BASE_URL}/images/generations`;

  const body = {
    model: klingModel,
    prompt: prompt,
    n: Math.min(Math.max(parseInt(n) || 1, 1), 4),
  };

  const sizeMap = {
    "1024x1024": "1024x1024",
    "1024x1536": "1024x1536",
    "1536x1024": "1536x1024",
    "512x512": "512x512",
    "768x768": "768x768",
  };
  if (sizeMap[size]) body.size = sizeMap[size];
  if (quality === "hd" || quality === "high") body.quality = "hd";
  if (seed !== undefined) body.seed = seed;
  if (negativePrompt) body.negative_prompt = negativePrompt;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (data.code === 0 && data.data?.task_id) {
    return {
      success: true,
      model: klingModel,
      jobId: data.data.task_id,
      status: data.data.task_status || "pending",
      message: "Image generation started.",
    };
  }

  if (data.code !== 0) {
    throw new Error(data.message || `Kling Image API error: code ${data.code}`);
  }

  throw new Error("Unexpected Kling Image API response");
}

// ==================== 视频转音频 ====================

async function generateKlingVideoToAudio(params, apiKey) {
  const {
    videoUrl,
    prompt = "generate matching sound effects",
    model = "kling-video-to-audio",
  } = params;

  if (!videoUrl) {
    throw new Error("Video URL is required for video-to-audio");
  }

  const klingModel = KLING_AUDIO_MODELS[model] || model;
  const endpoint = `${KLING_BASE_URL}/audio/video-to-audio`;

  const body = {
    model: klingModel,
    video_url: videoUrl,
    prompt: prompt,
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (data.code === 0 && data.data?.task_id) {
    return {
      success: true,
      model: klingModel,
      jobId: data.data.task_id,
      status: data.data.task_status || "pending",
      message: "Video-to-audio generation started.",
    };
  }

  if (data.code !== 0) {
    throw new Error(data.message || `Kling Video-to-Audio API error: code ${data.code}`);
  }

  throw new Error("Unexpected Kling Video-to-Audio API response");
}

// ==================== 对口型 / 数字人 ====================

async function generateKlingLipSync(params, apiKey) {
  const {
    imageUrl,
    audioUrl,
    videoUrl, // 可选：用视频驱动
    model = "kling-lip-sync",
  } = params;

  if (!imageUrl && !videoUrl) {
    throw new Error("Image URL or Video URL is required for lip-sync");
  }
  if (!audioUrl) {
    throw new Error("Audio URL is required for lip-sync");
  }

  const klingModel = KLING_AVATAR_MODELS[model] || model;
  const endpoint = `${KLING_BASE_URL}/avatar/lip-sync`;

  const body = {
    model: klingModel,
    audio_url: audioUrl,
  };

  if (imageUrl) body.image_url = imageUrl;
  if (videoUrl) body.video_url = videoUrl;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (data.code === 0 && data.data?.task_id) {
    return {
      success: true,
      model: klingModel,
      jobId: data.data.task_id,
      status: data.data.task_status || "pending",
      message: "Lip-sync generation started.",
    };
  }

  if (data.code !== 0) {
    throw new Error(data.message || `Kling Lip-Sync API error: code ${data.code}`);
  }

  throw new Error("Unexpected Kling Lip-Sync API response");
}

// ==================== 状态查询 ====================

async function checkKlingStatus(taskId, apiKey, type = "video") {
  // 根据类型确定端点
  let endpoint;
  switch (type) {
    case "image":
      endpoint = `${KLING_BASE_URL}/images/generations/${taskId}`;
      break;
    case "audio":
      endpoint = `${KLING_BASE_URL}/audio/generations/${taskId}`;
      break;
    case "avatar":
      endpoint = `${KLING_BASE_URL}/avatar/generations/${taskId}`;
      break;
    case "video":
    default:
      endpoint = `${KLING_BASE_URL}/videos/generations/${taskId}`;
      break;
  }

  const response = await fetch(endpoint, {
    headers: {
      "Authorization": `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to check status: ${response.status}`);
  }

  const data = await response.json();

  // 统一响应格式
  const status = data.data?.task_status || data.status;
  const resultUrl = data.data?.video_url || data.data?.image_url || data.data?.audio_url;

  if (status === "completed" && resultUrl) {
    return {
      success: true,
      status: "completed",
      url: resultUrl,
      videoUrl: data.data?.video_url,
      imageUrl: data.data?.image_url,
      audioUrl: data.data?.audio_url,
    };
  }

  return {
    success: true,
    status: status,
    message: data.message || `Task ${status}`,
  };
}

// ==================== 导出 ====================

module.exports = {
  // 视频
  generateKlingVideo,
  // 图像
  generateKlingImage,
  // 音频
  generateKlingVideoToAudio,
  // 数字人
  generateKlingLipSync,
  // 状态查询
  checkKlingStatus,
  // 模型映射
  KLING_VIDEO_MODELS,
  KLING_IMAGE_MODELS,
  KLING_AUDIO_MODELS,
  KLING_AVATAR_MODELS,
};
