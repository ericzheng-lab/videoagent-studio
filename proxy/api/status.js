/**
 * GET /api/status?jobId=&model= — Async job status for bltcy.ai
 * Supports Kling, Runway, Wan, Midjourney, and NanoBanana
 */

const { checkKlingStatus } = require("../generate-kling");
const { checkRunwayStatus } = require("../generate-runway");
const { checkCheapVideoStatus } = require("../generate-cheap-video");
const { checkMJStatus } = require("../generate-midjourney");
const { checkNanoBananaStatus } = require("../generate-nanobanana");

const BLTCY_API_KEY = process.env.BLTCY_API_KEY || "";

function json(res, status, data) {
  res.setHeader("Content-Type", "application/json");
  res.status(status).json(data);
}

function getBearerToken(req) {
  const h = req.headers.authorization;
  return h && h.startsWith("Bearer ") ? h.slice(7).trim() : null;
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });

  const jobId = (req.query?.jobId || req.query?.job_id || "").trim();
  const model = (req.query?.model || "").trim();
  
  if (!jobId) {
    return json(res, 400, {
      success: false,
      error: "Missing jobId",
      hint: "Use GET /api/status?jobId=your-job-id&model=kling",
    });
  }

  const token = getBearerToken(req);
  const apiKey = token || BLTCY_API_KEY;

  if (!apiKey) {
    return json(res, 401, {
      success: false,
      error: "Missing API key",
    });
  }

  // 根据模型路由到对应的检查函数
  try {
    let result;
    
    if (model.includes("midjourney") || model === "mj" || req.query?.type === "mj") {
      result = await checkMJStatus(jobId, apiKey);
      if (result && result.success && result.status === "completed") {
        result.price = "¥1.00";
      }
    } else if (model.includes("nano-banana") || model.includes("nanobanana") || req.query?.type === "nanobanana") {
      result = await checkNanoBananaStatus(jobId, apiKey);
      if (result && result.success && result.status === "completed") {
        result.price = "¥2.00";
      }
    } else if (model.includes("kling")) {
      result = await checkKlingStatus(jobId, apiKey);
    } else if (model.includes("runway")) {
      result = await checkRunwayStatus(jobId, apiKey);
    } else if (model.includes("wan")) {
      result = await checkCheapVideoStatus(jobId, model, apiKey);
    } else {
      // 尝试所有适配器
      try {
        result = await checkKlingStatus(jobId, apiKey);
      } catch {
        try {
          result = await checkRunwayStatus(jobId, apiKey);
        } catch {
          try {
            result = await checkMJStatus(jobId, apiKey);
            if (result && result.success && result.status === "completed") {
              result.price = "¥1.00";
            }
          } catch {
            try {
              result = await checkNanoBananaStatus(jobId, apiKey);
              if (result && result.success && result.status === "completed") {
                result.price = "¥2.00";
              }
            } catch {
              result = await checkCheapVideoStatus(jobId, model, apiKey);
            }
          }
        }
      }
    }

    return json(res, 200, result);
  } catch (e) {
    return json(res, 500, {
      success: false,
      error: e.message || "Status check failed",
    });
  }
};