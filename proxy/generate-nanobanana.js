/**
 * NanoBanana Pro Adapter - 简化版
 * 直接返回图片，不走 taskId 轮询
 * 使用 bltcy.ai API
 */

const MJ_BASE_URL = "https://api.bltcy.ai";
const { uploadImage } = require('./image-upload');

/**
 * NanoBanana Generate - 文生图 (同步返回)
 */
async function nanoBananaGenerate(params, apiKey) {
  const { prompt, aspect = "1:1" } = params;

  const endpoint = `${MJ_BASE_URL}/v1/images/generation`;

  const body = {
    model: "nano-banana-pro-4k",
    prompt,
    aspect_ratio: aspect,
  };

  console.log('[NanoBanana] Request:', endpoint, JSON.stringify(body));

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  console.log('[NanoBanana] Response:', JSON.stringify(data).slice(0, 1000));

  // 提取图片 URL 或 base64
  let imageUrl = data.url || data.imageUrl || data.image_url;
  let base64Data = null;
  
  // OpenAI 格式
  if (!imageUrl && data.data && data.data[0]) {
    imageUrl = data.data[0].url;
    base64Data = data.data[0].b64_json;
  }
  
  // 嵌套 result
  if (!imageUrl && data.result) {
    if (typeof data.result === 'string') {
      imageUrl = data.result;
    } else if (typeof data.result === 'object') {
      imageUrl = data.result.url || data.result.imageUrl || data.result.image_url;
      base64Data = data.result.b64_json || base64Data;
    }
  }

  // 有 base64 但没有 URL，直接返回 data URL
  if (!imageUrl && base64Data) {
    return {
      success: true,
      images: [{
        url: `data:image/png;base64,${base64Data}`,
      }],
      price: "¥2.00",
      model: "nano-banana-pro-4k",
    };
  }

  // 有 URL，尝试上传到 OSS
  if (imageUrl) {
    try {
      const imgRes = await fetch(imageUrl);
      const imgBuf = await imgRes.arrayBuffer();
      const b64 = Buffer.from(imgBuf).toString('base64');
      const ossUrl = await uploadImage(b64, `nanobanana-${Date.now()}.png`);
      return {
        success: true,
        images: [{ url: ossUrl }],
        price: "¥2.00",
        model: "nano-banana-pro-4k",
      };
    } catch (e) {
      console.error('[NanoBanana] OSS upload failed:', e.message);
      // 返回原始 URL
      return {
        success: true,
        images: [{ url: imageUrl }],
        price: "¥2.00",
        model: "nano-banana-pro-4k",
        warning: "OSS upload failed",
      };
    }
  }

  throw new Error(`No image in response: ${JSON.stringify(data).slice(0, 200)}`);
}

/**
 * NanoBanana Edit - 图生图 (同步返回)
 */
async function nanoBananaEdit(params, apiKey) {
  const { prompt, image, aspect = "1:1" } = params;

  const endpoint = `${MJ_BASE_URL}/v1/images/edits`;

  const body = {
    model: "nano-banana-pro-4k",
    prompt,
    image,
    ...(aspect && { aspect_ratio: aspect }),
  };

  console.log('[NanoBanana Edit] Request:', endpoint, JSON.stringify(body));

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  console.log('[NanoBanana Edit] Response:', JSON.stringify(data).slice(0, 1000));

  // 同样的提取逻辑
  let imageUrl = data.url || data.imageUrl || data.image_url;
  let base64Data = null;
  
  if (!imageUrl && data.data && data.data[0]) {
    imageUrl = data.data[0].url;
    base64Data = data.data[0].b64_json;
  }
  
  if (!imageUrl && data.result) {
    if (typeof data.result === 'string') {
      imageUrl = data.result;
    } else if (typeof data.result === 'object') {
      imageUrl = data.result.url || data.result.imageUrl || data.result.image_url;
      base64Data = data.result.b64_json || base64Data;
    }
  }

  if (!imageUrl && base64Data) {
    return {
      success: true,
      images: [{
        url: `data:image/png;base64,${base64Data}`,
      }],
      price: "¥2.00",
      model: "nano-banana-pro-4k",
    };
  }

  if (imageUrl) {
    try {
      const imgRes = await fetch(imageUrl);
      const imgBuf = await imgRes.arrayBuffer();
      const b64 = Buffer.from(imgBuf).toString('base64');
      const ossUrl = await uploadImage(b64, `nanobanana-edit-${Date.now()}.png`);
      return {
        success: true,
        images: [{ url: ossUrl }],
        price: "¥2.00",
        model: "nano-banana-pro-4k",
      };
    } catch (e) {
      return {
        success: true,
        images: [{ url: imageUrl }],
        price: "¥2.00",
        model: "nano-banana-pro-4k",
        warning: "OSS upload failed",
      };
    }
  }

  throw new Error(`No image in response: ${JSON.stringify(data).slice(0, 200)}`);
}

module.exports = {
  nanoBananaGenerate,
  nanoBananaEdit,
};
