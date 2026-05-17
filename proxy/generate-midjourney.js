/**
 * Midjourney Image Generator Adapter
 * 支持 imagine, upscale, variation, blend, describe 等
 * 使用 bltcy.ai API - Relax 模式
 */

const MJ_BASE_URL = "https://api.bltcy.ai/mj-relax";

const { uploadImage } = require('./image-upload');

/**
 * MJ Imagine - 文生图 / 参考图+文生图 (Relax 模式)
 */
async function mjImagine(params, apiKey) {
  const {
    prompt,
    aspect = "1:1",  // 1:1, 16:9, 9:16, 4:3, etc.
    noWait = false,
    images = [],       // 参考图 URL 数组（最多 4 张）
  } = params;

  const endpoint = `${MJ_BASE_URL}/mj/submit/imagine`;

  const body = {
    prompt: prompt,
    aspect_ratio: aspect,
  };

  // 参考图 base64 数组
  if (images && images.length > 0) {
    const base64Array = [];
    for (const img of images.slice(0, 4)) {
      if (img.startsWith('data:image')) {
        // 已经是 base64
        base64Array.push(img);
      } else {
        // URL，下载转 base64
        try {
          const imgRes = await fetch(img);
          const imgBuf = await imgRes.arrayBuffer();
          const b64 = Buffer.from(imgBuf).toString('base64');
          // 检测 MIME type
          const mime = img.includes('.png') || img.includes('png') ? 'image/png' : 'image/jpeg';
          base64Array.push(`data:${mime};base64,${b64}`);
        } catch (e) {
          console.error('[MJ] Failed to download reference image:', img, e.message);
        }
      }
    }
    if (base64Array.length > 0) {
      body.base64Array = base64Array;
    }
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
  const result = await waitForMJTask(taskId, apiKey);
  
  // 上传到 OSS
  if (result.success && result.imageUrl) {
    try {
      const imageResponse = await fetch(result.imageUrl);
      const imageBuffer = await imageResponse.arrayBuffer();
      const base64Data = Buffer.from(imageBuffer).toString('base64');

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
    buttons, // 从 checkMJStatus 返回的 buttons 数组
  } = params;

  const endpoint = `${MJ_BASE_URL}/mj/submit/action`;

  // 从 buttons 数组中找到对应的 customId
  let customId;
  if (buttons && Array.isArray(buttons)) {
    const btn = buttons.find(b => b.label === button);
    if (btn && btn.customId) {
      customId = btn.customId;
    }
  }
  
  // 如果没找到，使用备用格式
  if (!customId) {
    customId = `MJ::JOB::upsample::${button.replace('U', '')}::${taskId}`;
  }

  const body = {
    taskId: taskId,
    customId: customId,
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
    buttons, // 从 checkMJStatus 返回的 buttons 数组
  } = params;

  const endpoint = `${MJ_BASE_URL}/mj/submit/action`;

  // 从 buttons 数组中找到对应的 customId
  let customId;
  if (buttons && Array.isArray(buttons)) {
    const btn = buttons.find(b => b.label === button);
    if (btn && btn.customId) {
      customId = btn.customId;
    }
  }
  
  // 如果没找到，使用备用格式
  if (!customId) {
    customId = `MJ::JOB::variation::${button.replace('V', '')}::${taskId}`;
  }

  const body = {
    taskId: taskId,
    customId: customId,
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
  } = params;

  const endpoint = `${MJ_BASE_URL}/mj/submit/blend`;

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
  } = params;

  const endpoint = `${MJ_BASE_URL}/mj/submit/describe`;

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
async function checkMJStatus(taskId, apiKey) {
  const endpoint = `${MJ_BASE_URL}/mj/task/${taskId}/fetch`;

  const response = await fetch(endpoint, {
    headers: {
      "Authorization": `Bearer ${apiKey}`,
    },
  });

  const data = await response.json();

  // bltcy.ai 查询接口直接返回任务对象，不是 {code, description, result} 包装
  // 检查是否有 id 字段来判断是否是任务对象
  if (data.id) {
    // 直接是任务对象
    const status = data.status;  // NOT_START, SUBMITTED, MODAL, IN_PROGRESS, SUCCESS, FAILURE

    if (status === "SUCCESS") {
      return {
        success: true,
        status: "completed",
        action: data.action,
        imageUrl: data.imageUrl,
        originalUrl: data.imageUrl, // 保留原始 Midjourney 链接
        buttons: data.buttons,
        seed: data.seed,
      };
    }

    return {
      success: true,
      status: status.toLowerCase(),
      message: `Task ${status}`,
    };
  }

  // 如果是 {code, description, result} 格式
  if (data.code !== 1) {
    throw new Error(`Failed to check status: ${data.description}`);
  }

  const result = data.result;
  const status = result.status;

  if (status === "SUCCESS") {
    return {
      success: true,
      status: "completed",
      action: result.action,
      imageUrl: result.imageUrl,
      originalUrl: result.imageUrl, // 保留原始 Midjourney 链接
      buttons: result.buttons,
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
async function waitForMJTask(taskId, apiKey, maxAttempts = 60) {
  for (let i = 0; i < maxAttempts; i++) {
    const result = await checkMJStatus(taskId, apiKey);
    
    if (result.status === "completed") {
      return result;
    }
    
    if (result.status === "failure") {
      throw new Error("MJ task failed");
    }

    // 等待 20 秒（relax 模式生成慢，不着急）
    await new Promise(resolve => setTimeout(resolve, 20000));
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
