/**
 * Midjourney Image Generator Adapter
 * 支持 imagine, upscale, variation, blend, describe 等
 */

const MJ_BASE_URL = "https://api.bltcy.ai/mj-relax";

// MJ 模式映射
const MJ_MODES = {
  "fast": "mj-fast",
  "turbo": "mj-turbo", 
  "relax": "mj-relax",
};

// 图片代理模式
const MJ_RELAY = {
  "relay": "-relay",      // 服务转发 (国内快)
  "origin": "-origin",    // Discord 原生 (国外快)
  "proxy": "-proxy",      // 自定义代理
};

const { uploadImage } = require('./image-upload');

/**
 * MJ Imagine - 文生图 (Relax 模式)
 */
async function mjImagine(params, apiKey) {
  const {
    prompt,
    aspect = "1:1",  // 1:1, 16:9, 9:16, 4:3, etc.
    mode = "relax",  // 默认 relax 模式
    relay = "relay",
    noWait = false,
  } = params;

  const endpoint = `${MJ_BASE_URL}${MJ_RELAY[relay] || '-relay'}/mj/submit/imagine`;

  const body = {
    prompt: prompt,
    aspect_ratio: aspect,
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

  if (data.code !== 1) {
    throw new Error(`MJ Imagine failed: ${data.description || JSON.stringify(data)}`);
  }

  const taskId = data.result;

  if (noWait) {
    return {
      success: true,
      taskId,
      status: "submitted",
      message: "Task submitted. Use status endpoint to check.",
    };
  }

  // 等待完成
  const result = await waitForMJTask(taskId, apiKey, relay);
  
  // 上传到 OSS
  if (result.success && result.imageUrl) {
    try {
      console.log('[MJ] Downloading image from Discord...');
      const imageResponse = await fetch(result.imageUrl);
      const imageBuffer = await imageResponse.arrayBuffer();
      const base64Data = Buffer.from(imageBuffer).toString('base64');
      
      console.log('[MJ] Uploading to OSS...');
      const ossUrl = await uploadImage(base64Data, `mj-${Date.now()}.png`);
      
      return {
        ...result,
        imageUrl: ossUrl,
        originalUrl: result.imageUrl,
        price: "¥1.00",
      };
    } catch (e) {
      console.error('[MJ] OSS upload failed:', e.message);
      // OSS 失败，返回原始 Discord 链接
      return {
        ...result,
        price: "¥1.00",
        warning: "OSS upload failed, returning temporary Discord link",
      };
    }
  }
  
  return result;
}

/**
 * MJ Upscale - 放大图片
 */
async function mjUpscale(params, apiKey) {
  const {
    taskId,
    button,  // U1, U2, U3, U4
    relay = "relay",
  } = params;

  const endpoint = `${MJ_BASE_URL}${MJ_RELAY[relay] || '-relay'}/mj/submit/action`;

  const customId = `MJ::JOB::upsample::${button.replace('U', '')}::${taskId}`;

  const body = {
    task_id: taskId,
    custom_id: customId,
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

  if (data.code !== 1) {
    throw new Error(`MJ Upscale failed: ${data.description || JSON.stringify(data)}`);
  }

  return {
    success: true,
    taskId: data.result,
    status: "submitted",
    message: `Upscale ${button} submitted.`,
  };
}

/**
 * MJ Variation - 变体
 */
async function mjVariation(params, apiKey) {
  const {
    taskId,
    button,  // V1, V2, V3, V4
    relay = "relay",
  } = params;

  const endpoint = `${MJ_BASE_URL}${MJ_RELAY[relay] || '-relay'}/mj/submit/action`;

  const customId = `MJ::JOB::variation::${button.replace('V', '')}::${taskId}`;

  const body = {
    task_id: taskId,
    custom_id: customId,
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

  if (data.code !== 1) {
    throw new Error(`MJ Variation failed: ${data.description || JSON.stringify(data)}`);
  }

  return {
    success: true,
    taskId: data.result,
    status: "submitted",
    message: `Variation ${button} submitted.`,
  };
}

/**
 * MJ Blend - 多图融合
 */
async function mjBlend(params, apiKey) {
  const {
    images,  // 图片 URL 数组
    dimensions = "SQUARE",  // SQUARE, PORTRAIT, LANDSCAPE
    relay = "relay",
  } = params;

  const endpoint = `${MJ_BASE_URL}${MJ_RELAY[relay] || '-relay'}/mj/submit/blend`;

  const body = {
    image_urls: Array.isArray(images) ? images : images.split(','),
    dimensions: dimensions,
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

  if (data.code !== 1) {
    throw new Error(`MJ Blend failed: ${data.description || JSON.stringify(data)}`);
  }

  return {
    success: true,
    taskId: data.result,
    status: "submitted",
    message: "Blend task submitted.",
  };
}

/**
 * MJ Describe - 图生文
 */
async function mjDescribe(params, apiKey) {
  const {
    imageUrl,
    relay = "relay",
  } = params;

  const endpoint = `${MJ_BASE_URL}${MJ_RELAY[relay] || '-relay'}/mj/submit/describe`;

  const body = {
    image_url: imageUrl,
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

  if (data.code !== 1) {
    throw new Error(`MJ Describe failed: ${data.description || JSON.stringify(data)}`);
  }

  // Describe 返回的是文本描述
  return {
    success: true,
    taskId: data.result,
    status: "submitted",
    message: "Describe task submitted.",
  };
}

/**
 * 查询 MJ 任务状态
 */
async function checkMJStatus(taskId, apiKey, relay = "relay") {
  const endpoint = `${MJ_BASE_URL}${MJ_RELAY[relay] || '-relay'}/mj/task/${taskId}/fetch`;

  const response = await fetch(endpoint, {
    headers: {
      "Authorization": `Bearer ${apiKey}`,
    },
  });

  const data = await response.json();

  if (data.code !== 1) {
    throw new Error(`Failed to check status: ${data.description}`);
  }

  const result = data.result;
  const status = result.status;  // NOT_START, SUBMITTED, MODAL, IN_PROGRESS, SUCCESS, FAILURE

  if (status === "SUCCESS") {
    return {
      success: true,
      status: "completed",
      imageUrl: result.imageUrl,
      buttons: result.buttons,  // U1, U2, U3, U4, V1, V2, V3, V4
      seed: result.seed,
    };
  }

  return {
    success: true,
    status: status.toLowerCase(),
    message: `Task ${status}`,
  };
}

/**
 * 等待 MJ 任务完成
 */
async function waitForMJTask(taskId, apiKey, relay = "relay", maxAttempts = 60) {
  for (let i = 0; i < maxAttempts; i++) {
    const result = await checkMJStatus(taskId, apiKey, relay);
    
    if (result.status === "completed") {
      return result;
    }
    
    if (result.status === "failure") {
      throw new Error("MJ task failed");
    }

    // 等待 5 秒
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  throw new Error("Timeout waiting for MJ task");
}

module.exports = {
  mjImagine,
  mjUpscale,
  mjVariation,
  mjBlend,
  mjDescribe,
  checkMJStatus,
};
