# 修复 Vercel 环境变量

## 问题
videoagent-studio 返回 401 错误，因为 Vercel 没有设置 BLTCY_API_KEY

## 修复步骤

1. 登录 Vercel Dashboard: https://vercel.com/dashboard
2. 找到项目: videoagent-studio
3. 进入 Settings → Environment Variables
4. 添加:
   - Name: `BLTCY_API_KEY`
   - Value: `sk-84QZubvHau34LhDucT3sTKHrg1NDOmP1e0f8zpO5V1VHICpA`
5. 点击 Save
6. 重新部署 (Redeploy)

## 或者使用 Vercel CLI

```bash
vercel env add BLTCY_API_KEY
# 输入: sk-84QZubvHau34LhDucT3sTKHrg1NDOmP1e0f8zpO5V1VHICpA
vercel --prod
```

## 验证

curl -X POST https://videoagent-studio.vercel.app/api/generate \
  -H "Content-Type: application/json" \
  -d '{"mode":"text-to-image","prompt":"test","model":"flux"}'
