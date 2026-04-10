/**
 * Midjourney Edits Adapter
 * 支持图片编辑：加元素、扩图、改比例、局部修改
 * 使用 /mj/submit/edits 接口
 */

const MJ_BASE_URL = "https://api.bltcy.ai/mj-relax";
const { uploadImage } = require('./image-upload');

/**
 * MJ Edits - 图片编辑
 * @param {Object} params
 * @param {string} params.prompt - 编辑提示词
 * @param {string} params.image - 原图 URL
 * @param {string} params.maskBase64 - 可选，蒙版 base64
 * @param {string} params.aspect - 可选，目标比例 1:1, 2:3, 3:2, 9:16, 16:9
 * @param {string} apiKey
 */
async function mjEdits(params, apiKey) {
  const {
    prompt,
    image,
    maskBase64,
    aspect = "1:1",
    noWait = false,
  } = params;

  const endpoint = `${MJ_BASE_URL}/mj/submit/edits`;

  const body = {
    prompt: aspect && aspect !== "1:1" ? `${prompt} --ar ${aspect}` : prompt,
    image,
    ...(maskBase64 && { maskBase64 }),
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
    throw new Error(`MJ Edits failed: ${data.description || JSON.stringify(data)}`);
  }

  const taskId = data.result;

  if (noWait) {
    return {
      success: true,
      taskId,
      status: "submitted",
      message: "Edit task submitted. Use status endpoint to check.",
    };
  }

  // 等待完成
  const result = await waitForMJTask(taskId, apiKey);
  
  // 上传到 OSS
  if (result.success && result.imageUrl) {
    try {
      console.log('[MJ Edits] Downloading image from Discord...');
      const imageResponse = await fetch(result.imageUrl);
      const imageBuffer = await imageResponse.arrayBuffer();
      const base64Data = Buffer.from(imageBuffer).toString('base64');
      
      console.log('[MJ Edits] Uploading to OSS...');
      const ossUrl = await uploadImage(base64Data, `mj-edit-${Date.now()}.png`);
      
      return {
        ...result,
        imageUrl: ossUrl,
        originalUrl: result.imageUrl,
        price: "¥1.00",
      };
    } catch (e) {
      console.error('[MJ Edits] OSS upload failed:', e.message);
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
 * MJ Zoom - 图片变焦（通过 action）
 * @param {Object} params
 * @param {string} params.taskId - 原任务 ID
 * @param {string} params.button - ZOOM_1.5, ZOOM_2, CUSTOM_ZOOM
 * @param {string} apiKey
 */
async function mjZoom(params, apiKey) {
  const { taskId, button, zoomLevel = "1.5" } = params;

  // Zoom 按钮的 customId 格式
  const customIdMap = {
    "ZOOM_1.5": `MJ::JOB::zoom::1.5::${taskId}`,
    "ZOOM_2": `MJ::JOB::zoom::2::${taskId}`,
    "CUSTOM_ZOOM": `MJ::JOB::custom_zoom::${taskId}`,
  };

  const customId = customIdMap[button] || customIdMap["ZOOM_1.5"];

  const endpoint = `${MJ_BASE_URL}/mj/submit/action`;

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
    throw new Error(`MJ Zoom failed: ${data.description || JSON.stringify(data)}`);
  }

  // Zoom 可能需要 modal 确认
  if (data.code === 21) {
    return {
      success: true,
      taskId: data.result,
      status: "modal",
      message: "Zoom requires modal confirmation",
      requiresModal: true,
    };
  }

  return {
    success: true,
    taskId: data.result,
    status: "submitted",
    message: `Zoom ${button} submitted.`,
  };
}

/**
 * MJ Pan - 焦点移动
 * @param {Object} params
 * @param {string} params.taskId
 * @param {string} params.direction - UP, DOWN, LEFT, RIGHT
 * @param {string} apiKey
 */
async function mjPan(params, apiKey) {
  const { taskId, direction } = params;

  const directionMap = {
    "UP": "pan_up",
    "DOWN": "pan_down",
    "LEFT": "pan_left",
    "RIGHT": "pan_right",
  };

  const customId = `MJ::JOB::${directionMap[direction]}::${taskId}`;

  const endpoint = `${MJ_BASE_URL}/mj/submit/action`;

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
    throw new Error(`MJ Pan failed: ${data.description || JSON.stringify(data)}`);
  }

  return {
    success: true,
    taskId: data.result,
    status: "submitted",
    message: `Pan ${direction} submitted.`,
  };
}

/**
 * MJ Vary Region - 局部重绘
 * @param {Object} params
 * @param {string} params.taskId
 * @param {string} params.prompt - 新提示词
 * @param {string} params.maskBase64 - 蒙版
 * @param {string} apiKey
 */
async function mjVaryRegion(params, apiKey) {
  const { taskId, prompt, maskBase64 } = params;

  const endpoint = `${MJ_BASE_URL}/mj/submit/modal`;

  const body = {
    task_id: taskId,
    prompt,
    maskBase64,
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
    throw new Error(`MJ Vary Region failed: ${data.description || JSON.stringify(data)}`);
  }

  return {
    success: true,
    taskId: data.result,
    status: "submitted",
    message: "Vary Region submitted.",
  };
}

/**
 * 等待 MJ 任务完成（复用 generate-midjourney 里的）
 */
async function waitForMJTask(taskId, apiKey, maxAttempts = 60) {
  const { checkMJStatus } = require('./generate-midjourney');
  
  for (let i = 0; i < maxAttempts; i++) {
    const result = await checkMJStatus(taskId, apiKey);
    
    if (result.status === "completed") {
      return result;
    }
    
    if (result.status === "failure") {
      throw new Error("MJ task failed");
    }

    // 等待 20 秒
    await new Promise(resolve => setTimeout(resolve, 20000));
  }

  throw new Error("Timeout waiting for MJ task");
}

module.exports = {
  mjEdits,
  mjZoom,
  mjPan,
  mjVaryRegion,
};
