/**
 * Runway Video Generator Adapter for bltcy.ai
 */

const RUNWAY_BASE_URL = "https://api.bltcy.ai/runway/v1";

// Runway 模型映射
const RUNWAY_MODELS = {
  "runway": "runway-generate",
  "runway-generate": "runway-generate",
  "runway-gen3": "runwayml-gen3a_turbo",
  "runway-gen3-turbo": "runwayml-gen3a_turbo",
  "runway-gen4": "runwayml-gen4_turbo",
  "runway-gen4-turbo": "runwayml-gen4_turbo",
  "runway-turbo": "runwayml-gen4_turbo",
  "runway-aleph": "runway-aleph",
};

async function generateRunwayVideo(params, apiKey) {
  const {
    mode,
    prompt,
    imageUrl,
    duration = 5,
    aspectRatio = "16:9",
    model = "runway-generate",
  } = params;

  const runwayModel = RUNWAY_MODELS[model] || model;

  // Runway 使用 /pro/generate 端点
  const endpoint = `${RUNWAY_BASE_URL}/pro/generate`;

  const body = {
    model: runwayModel,
    prompt: prompt,
  };

  // 时长 (Runway 支持 1-10s)
  body.duration = Math.min(Math.max(parseInt(duration) || 5, 1), 10);

  // 比例
  const arMap = {
    "16:9": "16:9",
    "9:16": "9:16",
    "1:1": "1:1",
    "4:3": "4:3",
    "3:4": "3:4",
  };
  if (arMap[aspectRatio]) {
    body.aspect_ratio = arMap[aspectRatio];
  }

  // 图生视频
  if (mode === "image-to-video" && imageUrl) {
    body.image_url = imageUrl;
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

  // 处理响应
  if (data.code === 0 && data.data && data.data.task_id) {
    return {
      success: true,
      mode,
      model: runwayModel,
      jobId: data.data.task_id,
      status: data.data.task_status || "pending",
      message: "Video generation started. Poll for result.",
    };
  }

  if (data.code !== 0) {
    throw new Error(data.message || `Runway API error: code ${data.code}`);
  }

  throw new Error("Unexpected Runway API response");
}

async function checkRunwayStatus(taskId, apiKey) {
  // Runway 使用 runwayml 端点查询
  const endpoints = [
    `https://api.bltcy.ai/runwayml/v1/tasks/${taskId}`,
    `${RUNWAY_BASE_URL}/tasks/${taskId}`,
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        
        if (data.code === 0 && data.data) {
          const task = data.data;
          
          if (task.task_status === "completed" || task.task_status === "succeeded") {
            return {
              success: true,
              status: "completed",
              videoUrl: task.task_result?.video?.url || task.video_url,
            };
          }

          return {
            success: true,
            status: task.task_status,
            message: task.task_status_msg || `Task ${task.task_status}`,
          };
        }
      }
    } catch (e) {
      continue;
    }
  }

  throw new Error("Failed to check Runway status");
}

module.exports = {
  generateRunwayVideo,
  checkRunwayStatus,
  RUNWAY_MODELS,
};