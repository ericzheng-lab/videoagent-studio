/**
 * Kling Video Generator Adapter for bltcy.ai
 * Converts Fal-style requests to Kling API format
 */

const KLING_BASE_URL = "https://api.bltcy.ai/kling/v1";

// Kling model mapping - 使用 bltcy.ai 支持的模型 ID
const KLING_MODELS = {
  "kling": "kling-video-v2-6",
  "kling-v2-6": "kling-video-v2-6",
  "kling-v2-5-turbo": "kling-video-v2-5-turbo",
  "kling-v2-1": "kling-video-v2-1",
  "kling-v2-1-master": "kling-video-v2-1-master",
  "kling-v3": "kling-video-v3",
  "kling-v3-omni": "kling-video-v3-omni",
  "kling-o1": "kling-video-v2-6",  // o1 映射到 v2-6，因为 o1 可能不支持
  "kling-video-o1": "kling-video-v2-6",
};

async function generateKlingVideo(params, apiKey) {
  const {
    mode,           // "text-to-video" or "image-to-video"
    prompt,
    imageUrl,       // for image-to-video
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

  // Map model ID
  const klingModel = KLING_MODELS[model] || model;

  // Build Kling API request
  const endpoint = mode === "image-to-video" 
    ? `${KLING_BASE_URL}/videos/image2video`
    : `${KLING_BASE_URL}/videos/text2video`;

  const body = {
    model: klingModel,
    prompt: prompt,
    duration: Math.min(Math.max(parseInt(duration) || 5, 1), 10),
  };

  // Add aspect ratio
  const arMap = {
    "16:9": "16:9",
    "9:16": "9:16",
    "1:1": "1:1",
    "4:3": "4:3",
    "3:4": "3:4",
  };
  if (arMap[aspectRatio]) {
    body.aspect_ratio = arMap[aspectRatio];
  }

  // Add image for I2V
  if (mode === "image-to-video" && imageUrl) {
    body.image_url = imageUrl;
  }

  // 添加高级参数
  if (seed !== undefined && seed !== null) {
    body.seed = seed;
  }
  if (negativePrompt) {
    body.negative_prompt = negativePrompt;
  }
  if (cfg_scale !== undefined) {
    body.cfg_scale = cfg_scale;
  }
  if (camera_motion) {
    body.camera_motion = camera_motion;
  }

  // 添加 Reference 参数
  if (reference_image) {
    body.reference_image = reference_image;
  }
  if (keyframe_images && keyframe_images.length > 0) {
    body.keyframe_images = keyframe_images;
  }
  if (reference_video) {
    body.reference_video = reference_video;
  }
  if (motion_transfer) {
    body.motion_transfer = motion_transfer;
  }
  if (character_consistency) {
    body.character_consistency = character_consistency;
  }

  // Call Kling API via bltcy.ai
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
    throw new Error(error.message || `Kling API error: ${response.status}`);
  }

  const data = await response.json();

  // Kling returns async task - bltcy.ai 格式: { code: 0, data: { task_id } }
  if (data.code === 0 && data.data && data.data.task_id) {
    return {
      success: true,
      mode,
      model: klingModel,
      jobId: data.data.task_id,
      status: data.data.task_status || "pending",
      message: "Video generation started. Poll for result.",
    };
  }

  // 错误处理
  if (data.code !== 0) {
    throw new Error(data.message || `Kling API error: code ${data.code}`);
  }

  throw new Error("Unexpected Kling API response");
}

async function checkKlingStatus(taskId, apiKey) {
  const endpoint = `${KLING_BASE_URL}/videos/generations/${taskId}`;
  
  const response = await fetch(endpoint, {
    headers: {
      "Authorization": `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to check status: ${response.status}`);
  }

  const data = await response.json();

  // Map Kling status to unified format
  const status = data.status; // "pending", "processing", "completed", "failed"
  
  if (status === "completed" && data.video_url) {
    return {
      success: true,
      status: "completed",
      videoUrl: data.video_url,
    };
  }

  return {
    success: true,
    status: status,
    message: data.message || `Task ${status}`,
  };
}

module.exports = {
  generateKlingVideo,
  checkKlingStatus,
  KLING_MODELS,
};