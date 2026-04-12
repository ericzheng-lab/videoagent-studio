/**
 * VideoAgent Studio Proxy v3.0
 * 完整功能：Kling/Wan/Runway + Midjourney + Multi-shot + Reference + Advanced Params
 */

// 核心适配器
const { generateKlingVideo, checkKlingStatus, KLING_MODELS } = require("../generate-kling");
const { generateRunwayVideo, checkRunwayStatus, RUNWAY_MODELS } = require("../generate-runway");
const { generateWanVideo, checkWanStatus, WAN_MODELS } = require("../generate-wan");
const { generateCheapImage, CHEAP_IMAGE_MODELS } = require("../generate-cheap-image");
const { generateCheapVideo, checkCheapVideoStatus, CHEAP_VIDEO_MODELS } = require("../generate-cheap-video");

// 新功能适配器
const { mjImagine, mjUpscale, mjVariation, mjBlend, mjDescribe, checkMJStatus } = require("../generate-midjourney");
const { mjEdits, mjZoom, mjPan, mjVaryRegion } = require("../generate-midjourney-edits");
const { nanoBananaGenerate, nanoBananaEdit } = require("../generate-nanobanana");
const { generateKlingImage, checkKlingImageStatus, KLING_IMAGE_MODELS } = require("../generate-kling-image");
const { 
  generateKlingVideo: klingStudioVideo,
  generateKlingImage: klingStudioImage, 
  generateKlingVideoToAudio,
  generateKlingLipSync,
  checkKlingStatus: klingStudioCheckStatus,
  KLING_VIDEO_MODELS,
  KLING_IMAGE_MODELS: KLING_STUDIO_IMAGE_MODELS,
  KLING_AUDIO_MODELS,
  KLING_AVATAR_MODELS
} = require("../kling-studio");
const { generateMultiShotVideo, generateSequentialShots } = require("../generate-multishot");

// 工具模块
const { processReferenceInput, generateReferenceParams, enhancePromptWithReference } = require("../reference-handler");
const { parseAdvancedParams, applyStylePreset, generateProviderAdvancedParams, STYLE_PRESETS } = require("../advanced-params");

const BLTCY_API_KEY = process.env.BLTCY_API_KEY || "";

// 模型注册表
const SUPPORTED_MODELS = {
  // Kling 视频
  ...Object.keys(KLING_MODELS).reduce((acc, k) => ({ ...acc, [k]: "kling" }), {}),
  "kling-video-v2-6": "kling",
  "kling-video-v2-5-turbo": "kling",
  "kling-video-o1": "kling",
  
  // Runway 视频
  ...Object.keys(RUNWAY_MODELS).reduce((acc, k) => ({ ...acc, [k]: "runway" }), {}),
  "runwayml-gen3a_turbo": "runway",
  "runwayml-gen4_turbo": "runway",
  
  // Wan 视频
  ...Object.keys(WAN_MODELS).reduce((acc, k) => ({ ...acc, [k]: "wan" }), {}),
  "wan2.2-flash": "wan",
  "wan2.2-t2v-plus": "wan",
  "wanx2.1-turbo": "wan",
  
  // 便宜图像
  ...Object.keys(CHEAP_IMAGE_MODELS).reduce((acc, k) => ({ ...acc, [k]: "cheap-image" }), {}),
  
  // 便宜视频
  ...Object.keys(CHEAP_VIDEO_MODELS).reduce((acc, k) => ({ ...acc, [k]: "cheap-video" }), {}),
  
  // Midjourney
  "midjourney": "midjourney",
  "mj": "midjourney",
  "mj-fast": "midjourney",
  "mj-turbo": "midjourney",

  // Kling Image
  "kling-image": "kling-image",
  "kling-image-v1": "kling-image",
  "kling-image-v1-5": "kling-image",
  "kling-image-v2": "kling-image",
  "kling-image-v2-1": "kling-image",
  "kling-image-2-1": "kling-image",
  "kling-image-expend": "kling-image",

  // Kling Audio
  "kling-video-to-audio": "kling-audio",
  "kling-text-to-audio": "kling-audio",
  "kling-sound": "kling-audio",

  // Kling Avatar/Lip-sync
  "kling-lip-sync": "kling-avatar",
  "kling-meta-human": "kling-avatar",

  // NanoBanana
  "nano-banana-pro-4k": "nanobanana",
};

const VIDEO_MODELS = ["kling", "runway", "wan", "cheap-video"];
const IMAGE_MODELS = ["cheap-image", "midjourney", "nanobanana", "kling-image"];

// 工具函数
function json(res, status, data) {
  res.setHeader("Content-Type", "application/json");
  res.status(status).json(data);
}

function err(res, status, message, details = null) {
  json(res, status, { success: false, error: message, ...(details && { details }) });
}

function getBearerToken(req) {
  const h = req.headers.authorization;
  return h && h.startsWith("Bearer ") ? h.slice(7).trim() : null;
}

function detectProvider(modelId) {
  return SUPPORTED_MODELS[modelId] || null;
}

// 主处理器
module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();

  // Health check
  if (req.method === "GET") {
    return json(res, 200, {
      service: "videoagent-video-studio-proxy",
      version: "3.0.0-bltcy",
      status: "ok",
      modes: ["text-to-video", "image-to-video", "text-to-image", "reference-to-video", "multi-shot", "mj-imagine", "mj-upscale", "mj-blend", "mj-edits", "mj-zoom", "mj-pan", "mj-vary-region", "nano-banana-generate", "nano-banana-edit"],
      features: ["reference-mode", "advanced-params", "style-presets", "multi-shot", "midjourney", "midjourney-edits", "nano-banana"],
      videoModels: [...Object.keys(KLING_MODELS), ...Object.keys(RUNWAY_MODELS), ...Object.keys(WAN_MODELS)],
      imageModels: [...Object.keys(CHEAP_IMAGE_MODELS), "midjourney", "nano-banana-pro-4k"],
      stylePresets: Object.keys(STYLE_PRESETS),
      note: "Full-featured video/image generation via bltcy.ai",
    });
  }

  if (req.method !== "POST") return err(res, 405, "Method not allowed");

  // Auth
  const token = getBearerToken(req);
  const apiKey = token || BLTCY_API_KEY;
  if (!apiKey) {
    return err(res, 401, "Missing API key");
  }

  const body = req.body || {};
  const mode = (body.mode || "text-to-video").toLowerCase();

  try {
    let result;

    // 路由到不同处理器
    switch (mode) {
      // 图像生成
      case "text-to-image":
      case "image-generation":
        result = await handleImageGeneration(body, apiKey);
        break;

      // Midjourney 专用
      case "mj-imagine":
        result = await mjImagine(body, apiKey);
        break;
      case "mj-upscale":
        result = await mjUpscale(body, apiKey);
        break;
      case "mj-variation":
        result = await mjVariation(body, apiKey);
        break;
      case "mj-blend":
        result = await mjBlend(body, apiKey);
        break;
      case "mj-describe":
        result = await mjDescribe(body, apiKey);
        break;

      // 多镜头视频
      case "multi-shot":
      case "multishot":
        result = await handleMultiShot(body, apiKey);
        break;

      // Midjourney 编辑功能
      case "mj-edits":
        result = await mjEdits(body, apiKey);
        break;
      case "mj-zoom":
        result = await mjZoom(body, apiKey);
        break;
      case "mj-pan":
        result = await mjPan(body, apiKey);
        break;
      case "mj-vary-region":
        result = await mjVaryRegion(body, apiKey);
        break;

      // Kling Studio
      case "kling-video-generate":
        result = await klingStudioVideo(body, apiKey);
        break;
      case "kling-image-generate":
        result = await klingStudioImage(body, apiKey);
        break;
      case "kling-video-to-audio":
        result = await generateKlingVideoToAudio(body, apiKey);
        break;
      case "kling-lip-sync":
        result = await generateKlingLipSync(body, apiKey);
        break;

      // NanoBanana
      case "nano-banana-generate":
        result = await nanoBananaGenerate(body, apiKey);
        break;
      case "nano-banana-edit":
        result = await nanoBananaEdit(body, apiKey);
        break;

      // 标准视频生成
      case "text-to-video":
      case "image-to-video":
      case "reference-to-video":
        result = await handleVideoGeneration(body, apiKey, mode);
        break;

      default:
        return err(res, 400, `Unknown mode: ${mode}`);
    }

    return json(res, 200, result);
  } catch (e) {
    console.error(`[proxy] Error:`, e.message);
    return err(res, 500, e.message || "Generation failed");
  }
};

// 图像生成处理器
async function handleImageGeneration(body, apiKey) {
  const model = body.model || "flux";
  
  // Midjourney 图像
  if (model.startsWith("mj") || model === "midjourney") {
    return await mjImagine({
      prompt: body.prompt,
      aspect: body.aspectRatio || body.aspect || "1:1",
      mode: body.mjMode || "fast",
    }, apiKey);
  }

  // Kling Image (via Kling Studio)
  if (model.startsWith("kling-image")) {
    return await klingStudioImage({
      prompt: body.prompt,
      model: model,
      size: body.size || "1024x1024",
      n: body.n || 1,
      seed: body.seed,
      negativePrompt: body.negativePrompt,
      quality: body.quality,
    }, apiKey);
  }
  
  // 其他图像模型 (Flux/Grok/Seedream)
  const advancedParams = parseAdvancedParams(body);
  const enhancedPrompt = applyStylePreset(body.prompt, advancedParams.style);
  
  return await generateCheapImage({
    prompt: enhancedPrompt,
    model: model,
    size: body.size || "1024x1024",
    quality: advancedParams.quality,
    seed: advancedParams.seed,
    negativePrompt: advancedParams.negativePrompt,
  }, apiKey);
}

// 视频生成处理器
async function handleVideoGeneration(body, apiKey, mode) {
  const modelId = (body.model || "kling-o1").toLowerCase();
  const provider = detectProvider(modelId) || "kling";
  
  // 处理 Reference 模式
  let referenceParams = {};
  let enhancedPrompt = body.prompt;
  
  if (mode === "reference-to-video" || body.referenceImage) {
    const references = processReferenceInput(body);
    referenceParams = generateReferenceParams(provider, references);
    enhancedPrompt = enhancePromptWithReference(body.prompt, references);
  }
  
  // 处理高级参数
  const advancedParams = parseAdvancedParams(body);
  const styleEnhancedPrompt = applyStylePreset(enhancedPrompt, advancedParams.style);
  const providerAdvancedParams = generateProviderAdvancedParams(provider, advancedParams);
  
  const params = {
    mode: mode === "image-to-video" ? "image-to-video" : "text-to-video",
    prompt: styleEnhancedPrompt,
    imageUrl: body.imageUrl || body.image_url,
    duration: parseInt(body.duration, 10) || 5,
    aspectRatio: body.aspectRatio || "16:9",
    model: modelId,
    ...referenceParams,
    ...providerAdvancedParams,
    seed: advancedParams.seed,
    negativePrompt: advancedParams.negativePrompt,
    motionStrength: advancedParams.motionStrength,
    cameraMotion: advancedParams.cameraMotion,
  };
  
  // 路由到对应适配器
  switch (provider) {
    case "kling":
      return await generateKlingVideo(params, apiKey);
    case "runway":
      return await generateRunwayVideo(params, apiKey);
    case "wan":
      return await generateWanVideo(params, apiKey);
    case "cheap-video":
      return await generateCheapVideo(params, apiKey);
    default:
      throw new Error(`Unknown video provider: ${provider}`);
  }
}

// 多镜头处理器
async function handleMultiShot(body, apiKey) {
  const shots = body.shots || [];
  
  if (shots.length === 0) {
    throw new Error("No shots provided for multi-shot generation");
  }
  
  return await generateMultiShotVideo({
    project: body.project || "untitled",
    aspectRatio: body.aspectRatio || "16:9",
    mode: body.mode || "std",
    shots: shots,
  }, apiKey);
}

// 状态查询处理器 (扩展版)
module.exports.statusHandler = async function(req, res) {
  const taskId = req.query.jobId || req.query.task_id;
  const model = req.query.model || req.query.provider;
  const type = req.query.type || "video";  // video, mj
  
  if (!taskId) {
    return err(res, 400, "Missing jobId");
  }

  const token = getBearerToken(req);
  const apiKey = token || BLTCY_API_KEY;

  if (!apiKey) {
    return err(res, 401, "Missing API key");
  }

  try {
    let result;
    
    // Midjourney 状态查询
    if (type === "mj" || model?.startsWith("mj") || model === "midjourney") {
      result = await checkMJStatus(taskId, apiKey);
      if (result && result.success && result.status === "completed") {
        result.price = "¥1.00";
      }
    } else {
      // 视频状态查询
      const provider = detectProvider(model) || model;
      switch (provider) {
        case "kling":
          result = await checkKlingStatus(taskId, apiKey);
          break;
        case "runway":
          result = await checkRunwayStatus(taskId, apiKey);
          break;
        case "wan":
          result = await checkWanStatus(taskId, apiKey);
          break;
        case "kling-image":
          result = await klingStudioCheckStatus(taskId, apiKey, "image");
          break;
        case "kling-audio":
          result = await klingStudioCheckStatus(taskId, apiKey, "audio");
          break;
        case "kling-avatar":
          result = await klingStudioCheckStatus(taskId, apiKey, "avatar");
          break;
        default:
          // 尝试所有适配器
          const adapters = [
            ['kling', checkKlingStatus],
            ['kling-image', () => klingStudioCheckStatus(taskId, apiKey, "image")],
            ['kling-audio', () => klingStudioCheckStatus(taskId, apiKey, "audio")],
            ['kling-avatar', () => klingStudioCheckStatus(taskId, apiKey, "avatar")],
            ['runway', checkRunwayStatus],
            ['wan', checkWanStatus]
          ];
          for (const [name, fn] of adapters) {
            try {
              result = await fn(taskId, apiKey);
              if (result.success) break;
            } catch (e) {
              // 继续尝试下一个
            }
          }
      }
    }
    
    return json(res, 200, result || { success: false, error: "Status check failed" });
  } catch (e) {
    return err(res, 500, e.message);
  }
};
