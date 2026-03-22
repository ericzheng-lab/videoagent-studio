/**
 * Reference Mode Support for Video Generation
 * 角色一致性、风格参考、多图参考
 */

/**
 * 处理参考图像/视频输入
 * @param {Object} params - 原始参数
 * @returns {Object} - 处理后的参考参数
 */
function processReferenceInput(params) {
  const {
    referenceImage,      // 单张参考图
    referenceImages,     // 多张参考图数组
    referenceVideo,      // 参考视频
    referenceMode,       // 'character', 'style', 'scene', 'motion'
    characterName,       // 角色名称（用于一致性）
    stylePrompt,         // 风格描述
    motionStrength = 0.5, // 运动强度 0-1
  } = params;

  const references = {
    images: [],
    video: null,
    mode: referenceMode || 'character',
    config: {},
  };

  // 处理单张参考图
  if (referenceImage) {
    references.images.push({
      url: referenceImage,
      type: 'character',
      weight: 1.0,
    });
  }

  // 处理多张参考图
  if (referenceImages && Array.isArray(referenceImages)) {
    references.images = referenceImages.map((img, idx) => ({
      url: typeof img === 'string' ? img : img.url,
      type: img.type || 'character',
      weight: img.weight || (1.0 - idx * 0.1), // 递减权重
    }));
  }

  // 处理参考视频
  if (referenceVideo) {
    references.video = {
      url: referenceVideo,
      mode: referenceMode === 'motion' ? 'motion_transfer' : 'style_transfer',
    };
  }

  // 根据模式设置配置
  switch (references.mode) {
    case 'character':
      references.config = {
        face_swap: true,
        consistency_strength: 0.8,
        character_name: characterName,
      };
      break;
    case 'style':
      references.config = {
        style_prompt: stylePrompt,
        style_strength: 0.7,
        preserve_structure: true,
      };
      break;
    case 'scene':
      references.config = {
        background_preserve: true,
        lighting_match: true,
      };
      break;
    case 'motion':
      references.config = {
        motion_strength: motionStrength,
        motion_transfer: true,
      };
      break;
  }

  return references;
}

/**
 * 为不同模型生成参考参数
 * @param {string} provider - 模型提供商
 * @param {Object} references - 参考对象
 * @returns {Object} - 模型特定的参考参数
 */
function generateReferenceParams(provider, references) {
  const params = {};

  switch (provider) {
    case 'kling':
      // Kling 支持多元素参考和关键帧
      if (references.images.length > 0) {
        params.reference_image = references.images[0].url;
        if (references.images.length > 1) {
          params.keyframe_images = references.images.slice(1).map(i => i.url);
        }
      }
      if (references.video) {
        params.reference_video = references.video.url;
        params.motion_transfer = references.config.motion_transfer || false;
      }
      if (references.mode === 'character') {
        params.character_consistency = true;
      }
      break;

    case 'wan':
      // Wan 支持 I2V 和风格参考
      if (references.images.length > 0) {
        params.image_url = references.images[0].url;
      }
      if (references.mode === 'style' && references.config.style_prompt) {
        params.style = references.config.style_prompt;
      }
      break;

    case 'runway':
      // Runway 支持 image reference 和 motion brush
      if (references.images.length > 0) {
        params.reference_image = references.images.map(i => i.url);
      }
      if (references.video) {
        params.motion_reference = references.video.url;
      }
      params.motion_strength = references.config.motion_strength || 0.5;
      break;

    default:
      // 默认只支持单张参考图
      if (references.images.length > 0) {
        params.image_url = references.images[0].url;
      }
  }

  return params;
}

/**
 * 增强提示词（用于参考模式）
 * @param {string} prompt - 原始提示词
 * @param {Object} references - 参考对象
 * @returns {string} - 增强后的提示词
 */
function enhancePromptWithReference(prompt, references) {
  let enhanced = prompt;

  switch (references.mode) {
    case 'character':
      if (references.config.character_name) {
        enhanced = `[Character: ${references.config.character_name}] ${prompt}`;
      }
      enhanced += ', consistent character appearance, same face';
      break;
    case 'style':
      if (references.config.style_prompt) {
        enhanced = `${prompt}, in the style of ${references.config.style_prompt}`;
      }
      break;
    case 'scene':
      enhanced += ', consistent scene, matching lighting and environment';
      break;
    case 'motion':
      enhanced += `, ${Math.round(references.config.motion_strength * 100)}% motion intensity`;
      break;
  }

  return enhanced;
}

module.exports = {
  processReferenceInput,
  generateReferenceParams,
  enhancePromptWithReference,
};
