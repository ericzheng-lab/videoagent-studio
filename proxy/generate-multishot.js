/**
 * Kling Multi-Shot Video Generator
 * 多镜头视频生成，支持分镜式创作
 */

const KLING_BASE_URL = "https://api.bltcy.ai/kling/v1";

/**
 * 多镜头视频生成
 * @param {Object} params - 参数
 * @param {string} params.project - 项目名称
 * @param {string} params.aspectRatio - 画面比例
 * @param {string} params.mode - std 或 pro
 * @param {Array} params.shots - 分镜数组
 * @param {string} apiKey - API Key
 */
async function generateMultiShotVideo(params, apiKey) {
  const {
    project = "untitled",
    aspectRatio = "16:9",
    mode = "std",
    shots = [],  // [{ index, prompt, duration, camera, mood }]
  } = params;

  if (shots.length === 0) {
    throw new Error("No shots provided");
  }

  // 构建多镜头提示词
  // Kling 3.0 Omni 支持 multi-shot 参数
  const multiPrompt = shots.map((shot, idx) => {
    let text = shot.prompt;
    if (shot.camera) text += `, ${shot.camera}`;
    if (shot.mood) text += `, ${shot.mood}`;
    return text;
  }).join(" | ");

  const endpoint = `${KLING_BASE_URL}/videos/omni-video`;

  const body = {
    model_name: "kling-video-v2-6",  // 多镜头用高质量模型
    prompt: multiPrompt,
    aspect_ratio: aspectRatio,
    mode: mode,
    duration: shots.reduce((sum, s) => sum + (parseInt(s.duration) || 5), 0),
    multi_shot: true,
    shot_type: "customize",  // customize 或 intelligence
    multi_prompt: shots.map(s => s.prompt),
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `Multi-shot API error: ${response.status}`);
  }

  const data = await response.json();

  if (data.code === 0 && data.data && data.data.task_id) {
    return {
      success: true,
      mode: "multi-shot",
      project: project,
      shots: shots.length,
      totalDuration: body.duration,
      jobId: data.data.task_id,
      status: data.data.task_status || "pending",
      message: `Multi-shot video (${shots.length} shots, ${body.duration}s) started.`,
    };
  }

  throw new Error("Unexpected multi-shot API response");
}

/**
 * 顺序生成多个单镜头视频（备选方案）
 * 如果多镜头 API 不稳定，可以逐个生成
 */
async function generateSequentialShots(params, apiKey) {
  const {
    project = "untitled",
    aspectRatio = "16:9",
    mode = "std",
    shots = [],
  } = params;

  const results = [];
  const jobIds = [];

  // 逐个提交生成任务
  for (let i = 0; i < shots.length; i++) {
    const shot = shots[i];
    
    const endpoint = `${KLING_BASE_URL}/videos/text2video`;
    
    const body = {
      model_name: mode === "pro" ? "kling-video-v2-6" : "kling-video-o1",
      prompt: shot.prompt,
      aspect_ratio: aspectRatio,
      duration: shot.duration || 5,
    };

    // 添加运镜控制
    if (shot.camera) {
      body.camera_control = { type: shot.camera };
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

    if (data.code === 0 && data.data?.task_id) {
      jobIds.push({
        index: i + 1,
        jobId: data.data.task_id,
        prompt: shot.prompt,
      });
    }
  }

  return {
    success: true,
    mode: "sequential-shots",
    project: project,
    shots: shots.length,
    jobIds: jobIds,
    status: "pending",
    message: `${shots.length} shots submitted. Check status for each jobId.`,
  };
}

/**
 * 构建分镜 JSON 的辅助函数
 */
function buildShotsFromScript(script) {
  // 从自然语言描述解析分镜
  // 例如："镜头1: 女孩走进咖啡厅 | 镜头2: 她坐下看菜单 | 镜头3: 服务员过来"
  
  const shots = [];
  const parts = script.split(/[|｜]/);
  
  parts.forEach((part, idx) => {
    const match = part.match(/(?:镜头\s*(\d+)[:：]\s*)?(.+)/);
    if (match) {
      shots.push({
        index: parseInt(match[1]) || idx + 1,
        prompt: match[2].trim(),
        duration: 5,
      });
    }
  });

  return shots;
}

module.exports = {
  generateMultiShotVideo,
  generateSequentialShots,
  buildShotsFromScript,
};
