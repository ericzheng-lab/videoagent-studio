/**
 * NanoBanana Pro Adapter
 * 支持图像生成和编辑
 * 使用 bltcy.ai API
 */

const MJ_BASE_URL = "https://api.bltcy.ai";
const { uploadImage } = require('./image-upload');

/**
 * NanoBanana Generate - 文生图
 * @param {Object} params
 * @param {string} params.prompt - 提示词
 * @param {string} params.aspect - 比例 1:1, 16:9, 9:16, 4:3, 3:4
 * @param {string} apiKey
 */
async function nanoBananaGenerate(params, apiKey) {
  const { prompt, aspect = "1:1", noWait = false } = params;

  const endpoint = `${MJ_BASE_URL}/v1/images/generation`;

  const body = {
    model: "nano-banana-pro-4k",
    prompt,
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

  if (data.code !== 1 && data.code !== undefined) {
    throw new Error(`NanoBanana Generate failed: ${data.description || JSON.stringify(data)}`);
  }

  // 如果直接返回图片 URL
  if (data.imageUrl || data.url) {
    const imageUrl = data.imageUrl || data.url;
    // 上传到 OSS
    try {
      const imageResponse = await fetch(imageUrl);
      const imageBuffer = await imageResponse.arrayBuffer();
      const base64Data = Buffer.from(imageBuffer).toString('base64');
      const ossUrl = await uploadImage(base64Data, `nanobanana-${Date.now()}.png`);
      return {
        success: true,
        imageUrl: ossUrl,
        originalUrl: imageUrl,
        price: "¥2.00",
      };
    } catch (e) {
      return {
        success: true,
        imageUrl,
        price: "¥2.00",
        warning: "OSS upload failed",
      };
    }
  }

  // 如果返回 taskId，需要轮询
  const taskId = data.result || data.task_id || data.id;
  if (!taskId) {
    throw new Error("No taskId returned from NanoBanana");
  }

  if (noWait) {
    return {
      success: true,
      taskId,
      status: "submitted",
      message: "Task submitted. Use status endpoint to check.",
    };
  }

  // 等待完成
  const result = await waitForNanoBananaTask(taskId, apiKey);
  return result;
}

/**
 * NanoBanana Edit - 图生图/编辑
 * @param {Object} params
 * @param {string} params.prompt - 编辑提示词
 * @param {string} params.image - 原图 URL
 * @param {string} params.aspect - 可选，目标比例
 * @param {string} apiKey
 */
async function nanoBananaEdit(params, apiKey) {
  const { prompt, image, aspect = "1:1", noWait = false } = params;

  const endpoint = `${MJ_BASE_URL}/v1/images/edits`;

  const body = {
    model: "nano-banana-pro-4k",
    prompt,
    image,
    ...(aspect && { aspect_ratio: aspect }),
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

  if (data.code !== 1 && data.code !== undefined) {
    throw new Error(`NanoBanana Edit failed: ${data.description || JSON.stringify(data)}`);
  }

  // 如果直接返回图片 URL
  if (data.imageUrl || data.url) {
    const imageUrl = data.imageUrl || data.url;
    // 上传到 OSS
    try {
      const imageResponse = await fetch(imageUrl);
      const imageBuffer = await imageResponse.arrayBuffer();
      const base64Data = Buffer.from(imageBuffer).toString('base64');
      const ossUrl = await uploadImage(base64Data, `nanobanana-edit-${Date.now()}.png`);
      return {
        success: true,
        imageUrl: ossUrl,
        originalUrl: imageUrl,
        price: "¥2.00",
      };
    } catch (e) {
      return {
        success: true,
        imageUrl,
        price: "¥2.00",
        warning: "OSS upload failed",
      };
    }
  }

  // 如果返回 taskId，需要轮询
  const taskId = data.result || data.task_id || data.id;
  if (!taskId) {
    throw new Error("No taskId returned from NanoBanana Edit");
  }

  if (noWait) {
    return {
      success: true,
      taskId,
      status: "submitted",
      message: "Edit task submitted. Use status endpoint to check.",
    };
  }

  // 等待完成
  const result = await waitForNanoBananaTask(taskId, apiKey);
  return result;
}

/**
 * 查询 NanoBanana 任务状态
 */
async function checkNanoBananaStatus(taskId, apiKey) {
  const endpoint = `${MJ_BASE_URL}/v1/images/status/${taskId}`;

  const response = await fetch(endpoint, {
    headers: {
      "Authorization": `Bearer ${apiKey}`,
    },
  });

  const data = await response.json();

  // 直接返回图片 URL 表示完成
  if (data.imageUrl || data.url || (data.status === "completed" || data.status === "success")) {
    const imageUrl = data.imageUrl || data.url || data.result;
    return {
      success: true,
      status: "completed",
      imageUrl,
      originalUrl: imageUrl,
    };
  }

  // 还在处理中
  if (data.status === "pending" || data.status === "processing" || data.status === "in_progress") {
    return {
      success: true,
      status: "pending",
      message: "Task in progress",
    };
  }

  // 失败
  if (data.status === "failed" || data.status === "error") {
    throw new Error(data.message || data.error || "NanoBanana task failed");
  }

  // 未知状态，假设还在处理
  return {
    success: true,
    status: "pending",
    message: "Unknown status, treating as pending",
  };
}

/**
 * 等待 NanoBanana 任务完成
 */
async function waitForNanoBananaTask(taskId, apiKey, maxAttempts = 60) {
  for (let i = 0; i < maxAttempts; i++) {
    const result = await checkNanoBananaStatus(taskId, apiKey);
    
    if (result.status === "completed") {
      // 上传到 OSS
      if (result.imageUrl) {
        try {
          const imageResponse = await fetch(result.imageUrl);
          const imageBuffer = await imageResponse.arrayBuffer();
          const base64Data = Buffer.from(imageBuffer).toString('base64');
          const ossUrl = await uploadImage(base64Data, `nanobanana-${Date.now()}.png`);
          return {
            ...result,
            imageUrl: ossUrl,
            originalUrl: result.imageUrl,
            price: "¥2.00",
          };
        } catch (e) {
          return {
            ...result,
            price: "¥2.00",
            warning: "OSS upload failed",
          };
        }
      }
      return { ...result, price: "¥2.00" };
    }
    
    if (result.status === "failure") {
      throw new Error("NanoBanana task failed");
    }

    // 等待 10 秒
    await new Promise(resolve => setTimeout(resolve, 10000));
  }

  throw new Error("Timeout waiting for NanoBanana task");
}

module.exports = {
  nanoBananaGenerate,
  nanoBananaEdit,
  checkNanoBananaStatus,
};
