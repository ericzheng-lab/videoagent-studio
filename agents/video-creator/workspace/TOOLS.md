# TOOLS.md - 视频创作专家工具箱

## VideoAgent Studio API

**代理地址**: `https://proxy-roan-eight.vercel.app`

---

## 1. 图像生成

### 快速生成 (Flux - ¥0.01)
```bash
curl -s -X POST https://proxy-roan-eight.vercel.app/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "text-to-image",
    "prompt": "一只可爱的猫咪，阳光下的窗台，柔和光线，高清细节",
    "model": "flux",
    "size": "1024x1024"
  }' | jq -r '.images[0].url'
```

### 带风格生成
```bash
curl -s -X POST https://proxy-roan-eight.vercel.app/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "text-to-image",
    "prompt": "未来城市",
    "model": "flux",
    "style": "cyberpunk",
    "quality": "high",
    "seed": 12345
  }' | jq -r '.images[0].url'
```

### 可用参数
| 参数 | 类型 | 说明 |
|------|------|------|
| `model` | string | flux, grok-4.1-image, seedream-3.0 |
| `size` | string | 1024x1024, 1024x1536, 1536x1024 |
| `style` | string | cinematic, anime, realistic, watercolor, cyberpunk, minimal |
| `quality` | string | draft, standard, high, ultra |
| `seed` | number | 随机种子 |
| `negativePrompt` | string | 负面提示 |

---

## 2. 视频生成

### 文生视频 (推荐 Kling-o1 ¥0.80)
```bash
curl -s -X POST https://proxy-roan-eight.vercel.app/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "text-to-video",
    "prompt": "一只猫在雨中行走，霓虹灯反射，电影感",
    "model": "kling-o1",
    "duration": 5,
    "aspectRatio": "16:9",
    "style": "cinematic"
  }' | jq -r '.jobId'
```

### 图生视频
```bash
curl -s -X POST https://proxy-roan-eight.vercel.app/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "image-to-video",
    "prompt": "缓慢平移镜头，微风拂动",
    "imageUrl": "https://example.com/image.jpg",
    "model": "kling-o1",
    "duration": 5
  }' | jq -r '.jobId'
```

### 查询状态
```bash
# 替换 xxx 为实际的 jobId
curl -s "https://proxy-roan-eight.vercel.app/api/status?jobId=xxx&model=kling-o1" | jq
```

### 可用参数
| 参数 | 类型 | 说明 |
|------|------|------|
| `model` | string | kling-o1, kling-v2-6, wan2.2-flash |
| `duration` | number | 4-10 秒 |
| `aspectRatio` | string | 16:9, 9:16, 1:1, 4:3, 3:4 |
| `style` | string | 同上 |
| `quality` | string | draft, standard, high, ultra |
| `cameraMotion` | string | pan_left, pan_right, zoom_in, zoom_out, orbit |
| `motionStrength` | number | 0.0-1.0 |

---

## 3. Reference 模式 (角色一致性)

### 使用参考图生成视频
```bash
curl -s -X POST https://proxy-roan-eight.vercel.app/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "reference-to-video",
    "prompt": "角色在奔跑，背景是城市街道",
    "referenceImage": "https://example.com/character.jpg",
    "referenceMode": "character",
    "characterName": "小明",
    "model": "kling-v2-6",
    "duration": 5
  }' | jq -r '.jobId'
```

### Reference 模式类型
- `character` - 角色一致性
- `style` - 风格迁移
- `scene` - 场景一致性
- `motion` - 动作迁移

---

## 4. 批量/自动化脚本

### 生成多张图像
```bash
for i in {1..3}; do
  curl -s -X POST https://proxy-roan-eight.vercel.app/api/generate \
    -H "Content-Type: application/json" \
    -d "{\"mode\":\"text-to-image\",\"prompt\":\"猫咪 $i\",\"model\":\"flux\",\"seed\":$i}" | jq -r '.images[0].url'
done
```

### 轮询视频状态直到完成
```bash
JOB_ID="xxx"
MODEL="kling-o1"

while true; do
  STATUS=$(curl -s "https://proxy-roan-eight.vercel.app/api/status?jobId=$JOB_ID&model=$MODEL" | jq -r '.status')
  echo "Status: $STATUS"
  if [ "$STATUS" = "completed" ]; then
    curl -s "https://proxy-roan-eight.vercel.app/api/status?jobId=$JOB_ID&model=$MODEL" | jq -r '.videoUrl'
    break
  fi
  sleep 5
done
```

---

## 5. Web UI

可视化界面: https://proxy-roan-eight.vercel.app

---

## 价格参考

| 服务 | 最便宜 | 推荐 | 最高质量 |
|------|--------|------|----------|
| 图像 | Flux ¥0.01 | Flux ¥0.01 | Grok ¥0.10 |
| 视频 | Kling-o1 ¥0.80 | Kling-o1 ¥0.80 | Kling-v2-6 ¥2.50 |
| Reference | - | Kling-v2-6 ¥2.50 | - |
