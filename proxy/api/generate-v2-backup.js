/**
 * Modified generate.js for bltcy.ai support
 * 支持：Kling / Runway / Wan / 便宜图像 / 便宜视频
 * 新增：Reference 模式 + 高级参数
 */

const { generateKlingVideo, checkKlingStatus, KLING_MODELS } = require("../generate-kling");
const { generateRunwayVideo, checkRunwayStatus, RUNWAY_MODELS } = require("../generate-runway");
const { generateWanVideo, checkWanStatus, WAN_MODELS } = require("../generate-wan");
const { generateCheapImage, CHEAP_IMAGE_MODELS } = require("../generate-cheap-image");
const { generateCheapVideo, checkCheapVideoStatus, CHEAP_VIDEO_MODELS } = require("../generate-cheap-video");
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
};

const VIDEO_MODELS = ["kling", "runway", "wan", "cheap-video"];
const IMAGE_MODELS = ["cheap-image"];

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

function isVideoModel(provider) {
  return VIDEO_MODELS.includes(provider);
}

function isImageModel(provider) {
  return IMAGE_MODELS.includes(provider);
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();

  // Health check
  if (req.method === "GET") {
    return json(res, 200, {
      service: "videoagent-video-studio-proxy (bltcy.ai edition)",
      version: "2.4.0-bltcy",
      status: "ok",
      modes: ["text-to-video", "image-to-video", "text-to-image", "reference-to-video"],
      features: ["reference-mode", "advanced-params", "style-presets"],
      videoModels: [...Object.keys(KLING_MODELS), ...Object.keys(RUNWAY_MODELS), ...Object.keys(WAN_MODELS)],
      imageModels: Object.keys(CHEAP_IMAGE_MODELS),
      stylePresets: Object.keys(STYLE_PRESETS),
      referenceModes: ["character", "style", "scene", "motion"],
      note: "Using bltcy.ai API - set BLTCY_API_KEY env var",
    });
  }

  if (req.method !== "POST") return err(res, 405, "Method not allowed");

  // Auth check
  const token = getBearerToken(req);
  if (!token && !BLTCY_API_KEY) {
    return err(res, 401, "Missing API key. Set BLTCY_API_KEY env var or provide Bearer token.");
  }
  const apiKey = token || BLTCY_API_KEY;

  // 解析请求
  const body = req.body || {};
  const mode = (body.mode || "text-to-video").toLowerCase();
  const isImageMode = mode === "text-to-image" || mode === "image-generation";
  const isI2V = mode === "image-to-video";
  const isReferenceMode = mode === "reference-to-video" || body.referenceMode || body.reference_image;

  // 验证输入
  if (!body.prompt) {
    return err(res, 400, "Missing prompt");
  }
  if (isI2V && !body.imageUrl && !body.image_url) {
    return err(res, 400, "Missing imageUrl for image-to-video");
  }

  // 处理 Reference 模式
  let referenceParams = {};
  let enhancedPrompt = body.prompt;
  if (isReferenceMode) {
    const references = processReferenceInput(body);
    referenceParams = generateReferenceParams(detectProvider(body.model) || 'kling', references);
    enhancedPrompt = enhancePromptWithReference(body.prompt, references);
  }

  // 处理高级参数
  const advancedParams = parseAdvancedParams(body);
  const styleEnhancedPrompt = applyStylePreset(enhancedPrompt, advancedParams.style);

  // 确定模型和提供商
  const modelId = (body.model || "auto").toLowerCase().trim();
  
  let resolvedModel, provider;
  
  if (modelId === "auto") {
    if (isImageMode) {
      resolvedModel = "flux";
      provider = "cheap-image";
    } else if (isReferenceMode) {
      resolvedModel = "kling-v2-6"; // Reference 模式用 Kling（支持最好）
      provider = "kling";
    } else {
      resolvedModel = "wan2.2-flash";
      provider = "wan";
    }
  } else {
    provider = detectProvider(modelId);
    if (!provider) {
      return err(res, 400, `Unsupported model: ${modelId}`);
    }
    resolvedModel = modelId;
  }

  // 验证模式匹配
  if (isImageMode && !isImageModel(provider)) {
    return err(res, 400, `Model ${resolvedModel} is not an image model`);
  }
  if (!isImageMode && !isVideoModel(provider)) {
    return err(res, 400, `Model ${resolvedModel} is not a video model`);
  }

  // 构建参数
  const providerAdvancedParams = generateProviderAdvancedParams(provider, advancedParams);

  try {
    let result;
    
    const params = {
      mode: isI2V ? "image-to-video" : "text-to-video",
      prompt: styleEnhancedPrompt,
      originalPrompt: body.prompt,
      imageUrl: body.imageUrl || body.image_url,
      duration: parseInt(body.duration, 10) || 5,
      aspectRatio: body.aspectRatio || "16:9",
      model: resolvedModel,
      size: body.size || "1024x1024",
      quality: advancedParams.quality,
      n: body.n || 1,
      // Reference 参数
      ...referenceParams,
      // 高级参数
      ...providerAdvancedParams,
      seed: advancedParams.seed,
      negativePrompt: advancedParams.negativePrompt,
      motionStrength: advancedParams.motionStrength,
      cameraMotion: advancedParams.cameraMotion,
    };

    switch (provider) {
      case "kling":
        result = await generateKlingVideo(params, apiKey);
        break;
      case "runway":
        result = await generateRunwayVideo(params, apiKey);
        break;
      case "wan":
        result = await generateWanVideo(params, apiKey);
        break;
      case "cheap-image":
        result = await generateCheapImage(params, apiKey);
        break;
      case "cheap-video":
        result = await generateCheapVideo(params, apiKey);
        break;
      default:
        return err(res, 500, "Unknown provider");
    }

    // 添加使用的参数信息
    result.advancedParams = {
      style: advancedParams.style,
      quality: advancedParams.quality,
      seed: advancedParams.seed,
      referenceMode: isReferenceMode ? (body.referenceMode || 'character') : null,
    };

    return json(res, 200, result);
  } catch (e) {
    console.error(`[bltcy-proxy] ${provider} error:`, e.message);
    return err(res, 500, e.message || "Generation failed");
  }
};

// 状态查询处理器
async function statusHandler(req, res) {
  const taskId = req.query.jobId || req.query.task_id;
  const model = req.query.model || req.query.provider;
  
  if (!taskId) {
    return err(res, 400, "Missing jobId");
  }

  const token = getBearerToken(req);
  const apiKey = token || BLTCY_API_KEY;

  if (!apiKey) {
    return err(res, 401, "Missing API key");
  }

  let provider = model;
  if (!provider) {
    provider = detectProvider(req.query.model);
  }

  try {
    let result;
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
      case "cheap-video":
        result = await checkCheapVideoStatus(taskId, req.query.model, apiKey);
        break;
      default:
        // 尝试所有适配器
        const errors = [];
        for (const [name, fn] of [['kling', checkKlingStatus], ['runway', checkRunwayStatus], ['wan', checkWanStatus]]) {
          try {
            result = await fn(taskId, apiKey);
            if (result.success) break;
          } catch (e) {
            errors.push(`${name}: ${e.message}`);
          }
        }
        if (!result) throw new Error(`All status checks failed: ${errors.join(', ')}`);
    }
    return json(res, 200, result);
  } catch (e) {
    return err(res, 500, e.message);
  }
}

module.exports.statusHandler = statusHandler;
