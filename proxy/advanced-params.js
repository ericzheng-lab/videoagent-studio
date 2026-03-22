/**
 * Advanced Parameters Support
 * 种子值、负面提示、风格控制、质量设置等
 */

// 默认配置
const DEFAULT_ADVANCED_PARAMS = {
  seed: null,              // 随机种子
  negativePrompt: '',      // 负面提示
  quality: 'standard',     // 质量: draft, standard, high, ultra
  style: null,             // 风格预设
  cfgScale: 7.5,          // CFG Scale (分类器自由引导)
  steps: null,            // 推理步数
  motionStrength: 0.5,    // 运动强度 (视频)
  cameraMotion: null,     // 相机运动
  fps: 24,                // 帧率
};

// 风格预设
const STYLE_PRESETS = {
  cinematic: {
    prompt_suffix: ', cinematic lighting, film grain, 35mm lens, shallow depth of field',
    cfg_scale: 8.0,
  },
  anime: {
    prompt_suffix: ', anime style, cel shaded, vibrant colors, detailed line art',
    cfg_scale: 7.0,
  },
  realistic: {
    prompt_suffix: ', photorealistic, 8k uhd, highly detailed, professional photography',
    cfg_scale: 7.5,
  },
  watercolor: {
    prompt_suffix: ', watercolor painting, soft edges, artistic, flowing colors',
    cfg_scale: 6.5,
  },
  cyberpunk: {
    prompt_suffix: ', cyberpunk style, neon lights, futuristic, high tech low life',
    cfg_scale: 8.0,
  },
  minimal: {
    prompt_suffix: ', minimalist, clean composition, simple background, elegant',
    cfg_scale: 6.0,
  },
};

// 相机运动预设
const CAMERA_MOTIONS = {
  static: { motion: 'none' },
  pan_left: { motion: 'pan', direction: 'left', speed: 'medium' },
  pan_right: { motion: 'pan', direction: 'right', speed: 'medium' },
  pan_up: { motion: 'pan', direction: 'up', speed: 'medium' },
  pan_down: { motion: 'pan', direction: 'down', speed: 'medium' },
  zoom_in: { motion: 'zoom', direction: 'in', speed: 'slow' },
  zoom_out: { motion: 'zoom', direction: 'out', speed: 'slow' },
  orbit: { motion: 'orbit', direction: 'clockwise', speed: 'medium' },
  dolly_in: { motion: 'dolly', direction: 'in', speed: 'medium' },
  dolly_out: { motion: 'dolly', direction: 'out', speed: 'medium' },
};

/**
 * 解析和验证高级参数
 * @param {Object} params - 输入参数
 * @returns {Object} - 规范化的高级参数
 */
function parseAdvancedParams(params) {
  const advanced = {
    ...DEFAULT_ADVANCED_PARAMS,
  };

  // 种子值
  if (params.seed !== undefined && params.seed !== null) {
    const seed = parseInt(params.seed, 10);
    if (!isNaN(seed) && seed >= 0) {
      advanced.seed = seed;
    }
  }

  // 负面提示
  if (params.negativePrompt || params.negative_prompt) {
    advanced.negativePrompt = String(params.negativePrompt || params.negative_prompt).trim();
  }

  // 质量设置
  const validQualities = ['draft', 'standard', 'high', 'ultra'];
  if (params.quality && validQualities.includes(params.quality.toLowerCase())) {
    advanced.quality = params.quality.toLowerCase();
  }

  // 风格预设
  if (params.style && STYLE_PRESETS[params.style.toLowerCase()]) {
    advanced.style = params.style.toLowerCase();
  }

  // CFG Scale
  if (params.cfgScale || params.cfg_scale) {
    const cfg = parseFloat(params.cfgScale || params.cfg_scale);
    if (!isNaN(cfg) && cfg >= 1 && cfg <= 20) {
      advanced.cfgScale = cfg;
    }
  }

  // 推理步数
  if (params.steps) {
    const steps = parseInt(params.steps, 10);
    if (!isNaN(steps) && steps >= 10 && steps <= 100) {
      advanced.steps = steps;
    }
  }

  // 运动强度 (视频)
  if (params.motionStrength !== undefined || params.motion_strength !== undefined) {
    const strength = parseFloat(params.motionStrength || params.motion_strength);
    if (!isNaN(strength) && strength >= 0 && strength <= 1) {
      advanced.motionStrength = strength;
    }
  }

  // 相机运动
  if (params.cameraMotion || params.camera_motion) {
    const motion = params.cameraMotion || params.camera_motion;
    if (CAMERA_MOTIONS[motion.toLowerCase()]) {
      advanced.cameraMotion = motion.toLowerCase();
    }
  }

  // 帧率
  if (params.fps) {
    const fps = parseInt(params.fps, 10);
    if (!isNaN(fps) && [24, 30, 60].includes(fps)) {
      advanced.fps = fps;
    }
  }

  return advanced;
}

/**
 * 应用风格预设到提示词
 * @param {string} prompt - 原始提示词
 * @param {string} style - 风格名称
 * @returns {string} - 增强后的提示词
 */
function applyStylePreset(prompt, style) {
  if (!style || !STYLE_PRESETS[style]) {
    return prompt;
  }

  const preset = STYLE_PRESETS[style];
  return prompt + preset.prompt_suffix;
}

/**
 * 获取质量对应的配置
 * @param {string} quality - 质量级别
 * @returns {Object} - 质量配置
 */
function getQualityConfig(quality) {
  const configs = {
    draft: {
      steps: 20,
      cfg_scale: 5.0,
      price_multiplier: 0.5,
    },
    standard: {
      steps: 30,
      cfg_scale: 7.5,
      price_multiplier: 1.0,
    },
    high: {
      steps: 50,
      cfg_scale: 8.0,
      price_multiplier: 1.5,
    },
    ultra: {
      steps: 80,
      cfg_scale: 9.0,
      price_multiplier: 2.0,
    },
  };

  return configs[quality] || configs.standard;
}

/**
 * 为不同提供商生成高级参数
 * @param {string} provider - 模型提供商
 * @param {Object} advanced - 高级参数对象
 * @returns {Object} - 提供商特定的参数
 */
function generateProviderAdvancedParams(provider, advanced) {
  const params = {};

  switch (provider) {
    case 'kling':
      if (advanced.seed !== null) {
        params.seed = advanced.seed;
      }
      if (advanced.negativePrompt) {
        params.negative_prompt = advanced.negativePrompt;
      }
      if (advanced.cfgScale !== 7.5) {
        params.cfg_scale = advanced.cfgScale;
      }
      if (advanced.cameraMotion) {
        const motion = CAMERA_MOTIONS[advanced.cameraMotion];
        if (motion) {
          params.camera_motion = motion;
        }
      }
      break;

    case 'wan':
      if (advanced.seed !== null) {
        params.seed = advanced.seed;
      }
      if (advanced.quality !== 'standard') {
        const qualityConfig = getQualityConfig(advanced.quality);
        params.num_inference_steps = qualityConfig.steps;
      }
      break;

    case 'runway':
      if (advanced.seed !== null) {
        params.seed = advanced.seed;
      }
      if (advanced.motionStrength !== 0.5) {
        params.motion_strength = advanced.motionStrength;
      }
      if (advanced.cameraMotion) {
        params.camera_motion = advanced.cameraMotion;
      }
      break;

    case 'cheap-image':
    case 'cheap-video':
      if (advanced.seed !== null) {
        params.seed = advanced.seed;
      }
      if (advanced.negativePrompt) {
        params.negative_prompt = advanced.negativePrompt;
      }
      if (advanced.quality !== 'standard') {
        params.quality = advanced.quality;
      }
      break;

    default:
      // 通用参数
      if (advanced.seed !== null) {
        params.seed = advanced.seed;
      }
      if (advanced.negativePrompt) {
        params.negative_prompt = advanced.negativePrompt;
      }
  }

  return params;
}

module.exports = {
  parseAdvancedParams,
  applyStylePreset,
  getQualityConfig,
  generateProviderAdvancedParams,
  STYLE_PRESETS,
  CAMERA_MOTIONS,
  DEFAULT_ADVANCED_PARAMS,
};
