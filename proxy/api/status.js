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

function setCorsHeaders(res) {
  const origin = process.env.ALLOWED_ORIGIN || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function getBearerToken(req) {
  const h = req.headers.authorization;
  return h && h.startsWith("Bearer ") ? h.slice(7).trim() : null;
}

module.exports = async function handler(req, res) {
  setCorsHeaders(res);
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
      // 尝试所有适配器，记录每次尝试
      const adapters = [
        { name: "kling", fn: () => checkKlingStatus(jobId, apiKey) },
        { name: "runway", fn: () => checkRunwayStatus(jobId, apiKey) },
        { name: "midjourney", fn: async () => {
          const r = await checkMJStatus(jobId, apiKey);
          if (r?.success && r.status === "completed") r.price = "¥1.00";
          return r;
        }},
        { name: "nano-banana", fn: async () => {
          const r = await checkNanoBananaStatus(jobId, apiKey);
          if (r?.success && r.status === "completed") r.price = "¥2.00";
          return r;
        }},
        { name: "wan", fn: () => checkCheapVideoStatus(jobId, model, apiKey) },
      ];

      for (const adapter of adapters) {
        try {
          result = await adapter.fn();
          break;
        } catch (e) {
          console.error(`[Status] ${adapter.name} failed: ${e.message}`);
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