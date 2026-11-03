# Frontend Integration Guide: Kling Video Generation

> This document is intended for the NeoSpark Canvas frontend team and explains how to call the backend `kling-3.0` / `kling-3.0-omni` video generation capabilities.

---

## 1. API Overview

| Interface | Method | Path | Description |
|------|------|------|------|
| Create video generation task | POST | `/api/v1/video/generations` | Create a Kling video generation task |
| Query task status | GET | `/api/v1/video/generations/{task_id}` | Sync upstream status and return the latest progress |
| Get task list | GET | `/api/v1/video/generations` | Get the current user's video generation task list |
| Delete task record | DELETE | `/api/v1/video/generations/{task_id}` | Delete a completed/failed task record |
| Get supported models | GET | `/api/v1/video/models` | Get model list, supported resolutions, prices, etc. |

All endpoints require authentication. The following methods are supported (in backend priority order):

- `Authorization: Bearer <token>`
- `X-API-Key: np_xxxx` or `Authorization: ApiKey np_xxxx`
- `neospark_session` Cookie (browser environments)

---

## 2. Create a Video Generation Task

### 2.1 Request Example

```bash
curl -X POST https://api.useneospark.com/api/v1/video/generations \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "一只橘猫在草地上悠闲地散步，阳光从树叶间洒下",
    "model": "kling-3.0",
    "duration": 5,
    "ratio": "16:9",
    "resolution": "720p",
    "generate_audio": true,
    "first_frame_url": "https://example.com/cat.jpg"
  }'
```

### 2.2 Request Field Descriptions

| Field | Type | Required | Default | Description |
|------|------|------|--------|------|
| `prompt` | string | Yes | - | Video generation prompt |
| `model` | string | Yes | - | Model ID: `kling-3.0` or `kling-3.0-omni` |
| `duration` | integer | No | 5 | Video duration (seconds), range 4~15 |
| `ratio` | string | No | `16:9` | Aspect ratio: `16:9`, `9:16`, `1:1`, `3:4`, `4:3`, `21:9` |
| `resolution` | string | No | `720p` | Resolution: `720p`, `1080p`, `2k`, `4k`. Note that Kling does not support `480p` |
| `generate_audio` | boolean | No | false | Whether to generate audio |
| `first_frame_url` | string | No | - | First-frame image URL (publicly accessible) |
| `first_frame_upload_id` | string | No | - | First-frame image upload_id obtained via the upload API |
| `first_frame_path` | string | No | - | First-frame image local/storage path |
| `last_frame_url` | string | No | - | Last-frame image URL; combined with the first frame for first-last-frame mode |
| `reference_image_urls` | string[] | No | [] | Reference image URL list (up to 9, including first/last frame) |
| `reference_video_urls` | string[] | No | [] | Reference video URL list (up to 3) |

> **Note**: `first_frame_url` / `last_frame_url` and `reference_image_urls` cannot be used simultaneously in non-real-person mode. To mix them, you can pass `real_person_mode: true` (the current Kling branch treats them as reference images).

### 2.3 Success Response

```json
{
  "code": 200,
  "data": {
    "task_id": "video_a1b2c3d4e5f6",
    "external_task_id": "1327234241-AigcVideoTask-xxxxxx",
    "status": "pending",
    "progress": 0,
    "model": "kling-3.0",
    "duration": 5,
    "ratio": "16:9",
    "resolution": "720p",
    "pricing": {
      "estimated_cost": 95,
      "currency": "credits"
    },
    "available_points_after": 99905,
    "created_at": "2026-06-23T10:30:00"
  }
}
```

### 2.4 Error Responses

```json
{
  "code": 402,
  "message": "积分不足，请充值",
  "data": null
}
```

```json
{
  "code": 400,
  "message": "Kling models do not support 480p resolution",
  "data": null
}
```

```json
{
  "code": 502,
  "message": "Tencent VOD task creation failed: [InvalidParameter] Invalid prompt",
  "data": {
    "error_type": "tencent_vod_task_creation_failed",
    "error": "[InvalidParameter] Invalid prompt"
  }
}
```

---

## 3. Query Task Status

### 3.1 Request Example

```bash
curl -X GET https://api.useneospark.com/api/v1/video/generations/video_a1b2c3d4e5f6 \
  -H "Authorization: Bearer <token>"
```

### 3.2 Response Examples

**Processing:**
```json
{
  "code": 200,
  "data": {
    "task_id": "video_a1b2c3d4e5f6",
    "external_task_id": "1327234241-AigcVideoTask-xxxxxx",
    "status": "processing",
    "progress": 50,
    "model": "kling-3.0",
    "duration": 5,
    "ratio": "16:9",
    "resolution": "720p",
    "video_url": null,
    "estimated_cost": 95,
    "actual_cost": null,
    "error_msg": null
  }
}
```

**Completed:**
```json
{
  "code": 200,
  "data": {
    "task_id": "video_a1b2c3d4e5f6",
    "external_task_id": "1327234241-AigcVideoTask-xxxxxx",
    "status": "completed",
    "progress": 100,
    "model": "kling-3.0",
    "video_url": "https://api.useneospark.com/uploads/videos/2026/06/xxx.mp4",
    "estimated_cost": 95,
    "actual_cost": 95,
    "error_msg": null,
    "completed_at": "2026-06-23T10:35:00"
  }
}
```

**Failed:**
```json
{
  "code": 200,
  "data": {
    "task_id": "video_a1b2c3d4e5f6",
    "status": "failed",
    "progress": 0,
    "video_url": null,
    "estimated_cost": 95,
    "actual_cost": 0,
    "error_msg": "Processing failed"
  }
}
```

### 3.3 Polling Strategy Recommendations

- Start polling immediately after creating the task, with an interval of **5 seconds**
- Tasks typically complete in **30 seconds to 3 minutes**
- Stop polling when `status` is `completed` / `failed` / `cancelled`
- For progress bar display, use the `progress` field (0 / 50 / 100)

---

## 4. Get Model List

### 4.1 Request Example

```bash
curl -X GET https://api.useneospark.com/api/v1/video/models \
  -H "Authorization: Bearer <token>"
```

### 4.2 Response Example

```json
{
  "code": 200,
  "data": {
    "models": [
      {
        "id": "kling-3.0",
        "name": "Kling 3.0",
        "description": "腾讯云 VOD Kling 3.0 视频生成，支持文生视频、首帧/首尾帧、多参考图",
        "price_per_second": 23
      },
      {
        "id": "kling-3.0-omni",
        "name": "Kling 3.0 Omni",
        "description": "腾讯云 VOD Kling 3.0 Omni 多模态版，综合画质与流畅度更优",
        "price_per_second": 35
      }
    ],
    "ratios": ["16:9", "4:3", "1:1", "3:4", "9:16", "21:9"],
    "resolutions": {
      "kling-3.0": ["720p", "1080p", "2k", "4k"],
      "kling-3.0-omni": ["720p", "1080p", "2k", "4k"]
    },
    "durations": {"min": 4, "max": 15, "default": 5},
    "capabilities": [
      "text_to_video",
      "image_to_video",
      "multi_modal_reference",
      "audio_generation"
    ]
  }
}
```

> The frontend can use `/video/models` to dynamically render the model selector, resolution selector, and price estimates.

---

## 5. Frontend Usage Examples (TypeScript / React)

### 5.1 Create a Task

```typescript
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

async function createKlingVideo(payload: {
  prompt: string;
  model: "kling-3.0" | "kling-3.0-omni";
  duration?: number;
  ratio?: string;
  resolution?: string;
  generate_audio?: boolean;
  first_frame_url?: string;
  last_frame_url?: string;
  reference_image_urls?: string[];
}) {
  const res = await fetch(`${API_BASE}/api/v1/video/generations`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${getAccessToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      duration: 5,
      ratio: "16:9",
      resolution: "720p",
      generate_audio: true,
      ...payload,
    }),
  });

  const data = await res.json();
  if (data.code !== 200) {
    throw new Error(data.message);
  }
  return data.data;
}
```

### 5.2 Poll Task Status

```typescript
async function pollVideoTask(taskId: string, onProgress?: (progress: number) => void) {
  while (true) {
    const res = await fetch(`${API_BASE}/api/v1/video/generations/${taskId}`, {
      headers: { "Authorization": `Bearer ${getAccessToken()}` },
    });
    const data = await res.json();
    if (data.code !== 200) throw new Error(data.message);

    const task = data.data;
    onProgress?.(task.progress);

    if (["completed", "failed", "cancelled"].includes(task.status)) {
      return task;
    }

    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
}
```

### 5.3 Complete Call Flow

```typescript
async function generateVideo() {
  const task = await createKlingVideo({
    prompt: "一只橘猫在草地上散步",
    model: "kling-3.0",
    first_frame_url: "https://example.com/cat.jpg",
    duration: 8,
    resolution: "1080p",
    generate_audio: true,
  });

  const result = await pollVideoTask(task.task_id, (progress) => {
    console.log("Progress:", progress);
  });

  if (result.status === "completed") {
    console.log("Video URL:", result.video_url);
  } else {
    console.error("Failed:", result.error_msg);
  }
}
```

---

## 6. Pricing

Kling models are converted from Tencent Cloud VOD's official USD pricing and are affected by `generate_audio`:

| Model | 720p (No Audio) | 720p (With Audio) | 1080p (No Audio) | 1080p (With Audio) | 2k (No Audio) | 2k (With Audio) | 4k |
|------|---------------|---------------|----------------|----------------|-------------|-------------|----|
| `kling-3.0` | ~23 credits/sec | ~35 credits/sec | ~31 credits/sec | ~46 credits/sec | ~58 credits/sec | ~86 credits/sec | ~115 credits/sec |
| `kling-3.0-omni` | ~28 credits/sec | ~41 credits/sec | ~37 credits/sec | ~56 credits/sec | ~69 credits/sec | ~104 credits/sec | ~138 credits/sec |

> The table above lists reference values; the actual charge is based on the `pricing.estimated_cost` returned by `POST /video/generations`. The Kling series does not additionally apply the 7.9-discount compensation factor.

---

## 7. Status Enum

| Status | Description |
|------|------|
| `pending` | Task submitted, waiting for upstream processing |
| `processing` | Upstream is generating the video |
| `completed` | Generation complete; `video_url` is available |
| `failed` | Generation failed; credits have been refunded |
| `cancelled` | Task was cancelled |

---

## 8. FAQ

**Q: What resolutions does Kling support?**  
A: `720p`, `1080p`, `2k`, `4k`. `480p` is not supported.

**Q: Can the first-frame image and reference images be used together?**  
A: Not in the current normal mode. To use them together, the system will treat them as reference images; or use first-frame mode and reference mode separately.

**Q: How long does video generation take?**  
A: Typically 30 seconds to 3 minutes, depending on model load and resolution.

**Q: How long is the generated video URL valid?**  
A: The server immediately downloads it to NeoSpark storage and returns a local/S3 URL, which is valid long-term. Tencent Cloud's temporary URL is not exposed directly to the frontend.

**Q: How do I estimate credit consumption?**  
A: When calling the create task endpoint, `pricing.estimated_cost` in the response is the estimated consumption.

---

## 9. Related Backend Files

- `providers/tencent_vod_client.py` — Tencent Cloud VOD Provider
- `services/video_service_v2.py` — Video generation service
- `api/endpoints/video.py` — Video API endpoints
- `tests/test_tencent_vod_client.py` — Provider unit tests

---

*Document Version: 2026-07-31*  
*Corresponding Backend Branches: release/2026-03-29 / fix/ecommerce-batch-reference-consistency*
