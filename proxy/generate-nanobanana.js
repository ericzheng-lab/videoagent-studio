/**
 * NanoBanana Pro Adapter - 简化版
 * 直接返回图片，不走 taskId 轮询
 * 使用 bltcy.ai API
 */

const MJ_BASE_URL = "https://api.bltcy.ai";
const { uploadImage } = require('./image-upload');

/**
 * NanoBanana Generate - 文生图 / 参考图+文生图 (同步返回)
 */
async function nanoBananaGenerate(params, apiKey) {
  const { prompt, aspect = "1:1", images = [] } = params;

  const endpoint = `${MJ_BASE_URL}/v1/images/generations`;

  const body = {
    model: "nano-banana-pro",
    prompt,
    aspect_ratio: aspect,
    response_format: "url",
  };

  // 参考图数组（最多 4 张，url 或 b64_json）
  if (images && images.length > 0) {
    body.image = images.slice(0, 4);
  }

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
 * 使用 /v1/images/edits 端点 + multipart/form-data
 */
async function nanoBananaEdit(params, apiKey) {
  const { prompt, image, aspect = "1:1" } = params;

  if (!image) {
    throw new Error("Missing image for NanoBanana edit");
  }

  const endpoint = `${MJ_BASE_URL}/v1/images/edits`;

  // 下载图片并构建 FormData
  let imageBlob;
  let filename = "edit-image.png";

  if (image.startsWith("data:")) {
    // base64 data URL
    const match = image.match(/^data:(.*?);base64,(.*)$/);
    if (!match) throw new Error("Invalid base64 image format");
    const mime = match[1];
    const b64 = match[2];
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    imageBlob = new Blob([bytes], { type: mime });
    filename = `edit-image.${mime.split("/")[1] || "png"}`;
  } else if (image.startsWith("http")) {
    // URL — 下载图片
    const imgRes = await fetch(image);
    if (!imgRes.ok) throw new Error(`Failed to download image: ${imgRes.status}`);
    const arrayBuf = await imgRes.arrayBuffer();
    imageBlob = new Blob([arrayBuf], { type: "image/png" });
  } else {
    throw new Error("Invalid image format: must be data URL or http(s) URL");
  }

  const formData = new FormData();
  formData.append("prompt", prompt);
  formData.append("image", imageBlob, filename);
  formData.append("model", "nano-banana-pro");
  formData.append("aspect_ratio", aspect);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  const data = await response.json();

  // 提取图片 URL
  let imageUrl = data.url || data.imageUrl || data.image_url;

  if (!imageUrl && data.data && data.data[0]) {
    imageUrl = data.data[0].url;
  }

  if (!imageUrl && data.result) {
    imageUrl = typeof data.result === "string" ? data.result : data.result.url;
  }

  if (imageUrl) {
    return {
      success: true,
      images: [{ url: imageUrl }],
      price: "¥2.00",
      model: "nano-banana-pro-4k",
    };
  }

  throw new Error(`No image in edit response: ${JSON.stringify(data).slice(0, 200)}`);
}

module.exports = {
  nanoBananaGenerate,
  nanoBananaEdit,
};
