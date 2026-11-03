# API Key Integration Guide - Video Generation

This document explains how to integrate NeoSpark video generation into your application using an API Key.

> **Version Notes**: This document corresponds to the `seedance-2.0` / `seedance-2.0-fast` / `seedance-2.5` / `gemini-omni-flash-preview` / `kling-3.0` / `kling-3.0-omni` / `minimax-h3` / `wan3.0-video` / `grok-imagine-video` versions. `omni-fast` / `omni-fast-v2v` have been removed from the model list (2026-09-22), and the legacy SDance API is deprecated.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Getting an API Key](#getting-an-api-key)
3. [Authentication](#authentication)
4. [Video Generation Workflow](#video-generation-workflow)
5. [Supported Models and Pricing](#supported-models-and-pricing)
6. [Video Generation API Details](#video-generation-api-details)
7. [Assets API](#assets-api)
8. [Video Watermark Removal API](#video-watermark-removal-api)
9. [Error Handling](#error-handling)
10. [Best Practices](#best-practices)
11. [References](#references)

---

## Quick Start

### Basic Information

```
API Base URL: https://api.useneospark.com/api/v1
Authentication: X-API-Key: np_your_api_key_here
```

### Minimal Working Example

**Python:**

```python
import requests
import time

API_KEY = "np_your_api_key_here"
BASE_URL = "https://api.useneospark.com/api/v1"

# 1. 创建视频生成任务
response = requests.post(
    f"{BASE_URL}/video/generations",
    headers={
        "X-API-Key": API_KEY,
        "Content-Type": "application/json"
    },
    json={
        "prompt": "一只可爱的猫咪在草地上玩耍",
        "model": "seedance-2.0",
        "duration": 5,
        "ratio": "16:9",
        "resolution": "720p"
    }
)
result = response.json()
print(f"Task ID: {result['data']['task_id']}")
print(f"Estimated cost: {result['data']['pricing']['estimated_cost']} credits")

# 2. 轮询查询任务状态
task_id = result["data"]["task_id"]
while True:
    response = requests.get(
        f"{BASE_URL}/video/generations/{task_id}",
        headers={"X-API-Key": API_KEY}
    )
    status_data = response.json()["data"]
    print(f"Status: {status_data['status']}, Progress: {status_data['progress']}%")

    if status_data["status"] == "completed":
        print(f"Video URL: {status_data['video_url']}")
        break
    elif status_data["status"] in ["failed", "cancelled"]:
        print(f"Task failed: {status_data.get('error_msg', 'Unknown error')}")
        break

    time.sleep(5)
```

**JavaScript:**

```javascript
const API_KEY = "np_your_api_key_here";
const BASE_URL = "https://api.useneospark.com/api/v1";

async function generateVideo() {
  // 1. 创建视频生成任务
  const createResponse = await fetch(`${BASE_URL}/video/generations`, {
    method: "POST",
    headers: {
      "X-API-Key": API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: "一只可爱的猫咪在草地上玩耍",
      model: "seedance-2.0",
      duration: 5,
      ratio: "16:9",
      resolution: "720p",
    }),
  });
  const result = await createResponse.json();
  console.log("Task ID:", result.data.task_id);

  // 2. 轮询查询任务状态
  const taskId = result.data.task_id;
  while (true) {
    const statusResponse = await fetch(`${BASE_URL}/video/generations/${taskId}`, {
      headers: { "X-API-Key": API_KEY },
    });
    const statusData = (await statusResponse.json()).data;
    console.log(`Status: ${statusData.status}, Progress: ${statusData.progress}%`);

    if (statusData.status === "completed") {
      console.log("Video URL:", statusData.video_url);
      return statusData.video_url;
    } else if (["failed", "cancelled"].includes(statusData.status)) {
      throw new Error(`Task failed: ${statusData.error_msg || 'Unknown error'}`);
    }

    await new Promise(resolve => setTimeout(resolve, 5000));
  }
}

generateVideo();
```

---

## Getting an API Key

### Method 1: Create via the Web Interface

1. Visit https://platform.useneospark.com
2. Sign in with your Google account
3. Go to "User" → "API Keys"
4. Click "Create API Key"
5. Copy the generated key (**shown only once!**)

### Method 2: Create via the API (requires an existing Bearer Token)

```bash
# 1. 先登录获取 Bearer Token（通过浏览器 OAuth）

# 2. 使用 Bearer Token 创建 API Key
curl -X POST "https://api.useneospark.com/api/v1/api-keys" \
  -H "Authorization: Bearer YOUR_BEARER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "我的应用",
    "expires_days": 90
  }'
```

**Response example:**

```json
{
  "code": 200,
  "data": {
    "id": 1,
    "name": "我的应用",
    "api_key": "np_xxxxxxxxxxxxxxxxxxxx",
    "is_active": true,
    "expires_at": "2025-07-08T10:30:00",
    "created_at": "2025-04-09T10:30:00"
  }
}
```

---

## Authentication

Two methods are supported for passing the API Key:

### Method 1: X-API-Key Header (Recommended)

```bash
curl "https://api.useneospark.com/api/v1/video/generations" \
  -H "X-API-Key: np_your_api_key_here"
```

### Method 2: Authorization Header

```bash
curl "https://api.useneospark.com/api/v1/video/generations" \
  -H "Authorization: ApiKey np_your_api_key_here"
```

---

## Video Generation Workflow

Video generation uses an asynchronous task model. The workflow is as follows:

```
1. 提交任务 → 返回 task_id
2. 轮询查询任务状态
3. 任务完成后获取视频 URL
4. 下载或使用视频
```

### Flow Diagram

```
┌─────────────┐    POST /video/generations    ┌─────────────┐
│   你的应用   │ ───────────────────────────▶ │  NeoSpark   │
│             │                               │   服务器     │
│             │ ◀─────────────────────────── │             │
└─────────────┘   {task_id, status:pending}   └─────────────┘
       │
       │ GET /video/generations/{task_id}
       │ (轮询，每 2-5 秒一次)
       ▼
┌─────────────┐
│  任务完成？  │── 否 ──▶ 继续轮询
└─────────────┘
       │ 是
       ▼
┌─────────────┐
│ 获取视频URL  │
└─────────────┘
```

---

## Supported Models and Pricing

### Model List

The following models are currently supported for video generation:

| Model | Description | Supported Resolutions | Max Duration | Status |
|------|------|-----------|---------|------|
| `seedance-2.0` | High quality, balanced quality and speed, supports 4K | `480p`, `720p`, `1080p`, `4k` | 15s | Available |
| `seedance-2.0-fast` | Fast generation, higher speed, up to 720p | `480p`, `720p` | 15s | Available |
| `seedance-2.5` | Higher quality, supports 4K | `480p`, `720p`, `1080p`, `4k` | 30s | Available |
| `gemini-omni-flash-preview` | Google Vertex AI short video generation with native audio output | `360p`, `720p`, `1080p`, `4k` | 15s | Available |
| `kling-3.0` | Tencent Cloud VOD Kling 3.0 | `720p`, `1080p`, `2k`, `4k` | 15s | Available |
| `kling-3.0-omni` | Tencent Cloud VOD Kling 3.0 Omni multimodal version | `720p`, `1080p`, `2k`, `4k` | 15s | Available |
| `minimax-h3` | Next-generation open general-purpose multimodal video model, supports text-to-video/image-to-video/first-last-frame/multimodal reference, reference audio | `768p`, `2k` | 15s | Available |
| `wan3.0-video` | Alibaba Cloud DashScope Wan 3.0, supports text-to-video/image-to-video/video-to-video, reference audio, **document input (PPT/doc/xls/pdf/md)** | `480p`, `720p`, `1080p` | 30s | Available |
| `grok-imagine-video` | xAI Grok Imagine Video v1.5 (via WaveSpeedAI), supports text-to-video/first-frame image-to-video/multi-reference images (≤7) | `480p`, `720p`, `1080p` | 1~15s | Available |

> **Naming Note**: Internally, the code recognizes `doubao-seedance-2-0-260128` / `doubao-seedance-2-0-fast-260128` / `doubao-seedance-2.5` as aliases of `seedance-2.0` / `seedance-2.0-fast` / `seedance-2.5`, but the external API consistently uses `seedance-2.0` / `seedance-2.0-fast` / `seedance-2.5`.
>
> **MiniMax-H3 Note**: The external API uses `minimax-h3`; the actual Moyu gateway model ID is `MiniMax-H3` (case-sensitive).

### Credits Calculation

The `pricing.estimated_cost` returned by the API is the final estimated charge; the frontend should use this value. The following describes the internal calculation logic:

**Seedance 2.0 Series**:
Estimated based on the new Volcano Engine token pricing:
```
tokens = duration × width × height × 24(fps) // 1024
预估费用 = ceil(tokens × price_per_million / 70_000 × multiplier)
```
Here `price_per_million` varies by resolution and whether an input video is included (approximately 16~51 CNY per million tokens), and `multiplier` is currently fixed at 2.0. The actual cost will not exceed the estimated frozen amount.

**Gemini Omni Flash** (converted from USD/second by resolution × 274, then divided by 0.79 as compensation):
- `360p`: approximately 12 credits/second
- `720p`: approximately 36 credits/second
- `1080p`: approximately 54 credits/second
- `4k`: approximately 106 credits/second

**Grok Imagine Video** (1 USD = 274 credits, no 0.79 compensation):
- Text-to-video: $0.08/second → approximately 22 credits/second
- Image-to-video/reference-image-to-video: $0.09/second → approximately 25 credits/second

**Tencent Cloud Kling Models**:
Converted from Kling's official USD pricing (1 USD ≈ 274 credits):
- `kling-3.0` 720p baseline is approximately $0.084/second (no audio) / $0.126/second (with audio)
- `kling-3.0-omni` carries an additional premium of approximately 20% over `kling-3.0`
- Resolution factors: `1080p=4/3`, `2k≈2.5`, `4k=$0.420/second`, `480p=0.8`

**MiniMax-H3** (7.9-discount compensation retained):
```
预估费用 = ceil(duration × 0.8 / 0.07 / 0.79)
```
- Moyu pricing is ¥0.800/second, converted from CNY to credits with a 7.9-discount compensation applied.
- Example: approximately 73 credits for 5 seconds, approximately 145 credits for 10 seconds.

**Alibaba Cloud Wan 3.0** (official list price, no 7.9-discount compensation):
Converted from DashScope's official CNY pricing:
- `480p`: ¥0.30/second → approximately 14 credits/second
- `720p`: ¥0.60/second → approximately 27 credits/second
- `1080p`: ¥1.20/second → approximately 55 credits/second

The backend first compresses images to JPEG and converts them to base64 data URIs for submission, avoiding DashScope cross-region download failures.

**General Notes**:
- `0.79` is the credit purchase discount compensation factor, applied to some fixed unit-price models (Gemini Omni Flash, MiniMax-H3, etc.).
- Credits are frozen based on `estimated_cost` when the task is created.
- After the task completes successfully, settlement is based on the actual cost, but will not exceed the estimated frozen amount; failures release the freeze.
- The `completion_tokens` / `total_tokens` / `token_cost` returned by the query API are for reference only.

### Provider-Specific Limitations

- **Gemini Omni Flash**:
  - Supports `360p` / `720p` / `1080p` / `4k`
  - Maximum 15 seconds
  - Up to 5 reference images
  - Tasks usually complete synchronously; the response may directly return `completed` with `video_url`
- **Grok Imagine Video**:
  - Supports `16:9` / `1:1` / `9:16` / `3:2` / `2:3`, 1~15 seconds
  - Up to 7 reference images (including the first frame)
- **Wan 3.0**:
  - Supports reference audio (`reference_audio_*`) and document input (`reference_file_*`, only 1, ≤100MB, ≤50 pages)
  - Reference images/first frame/last frame can be used simultaneously; reference images are submitted as base64 data URIs
- **Tencent Cloud Kling**:
  - Does not support the `480p` resolution
  - Upstream statuses: `PENDING` / `PROCESSING` / `FINISH` / `FAIL`
- **Seedance**:
  - Maximum 9 reference images in total (including first/last frame)
  - Maximum 3 reference videos
  - Asset images must be at least 300×300 pixels
  - Assets uploaded to the Moyu asset library must wait for the `Active` status (up to 120 seconds)
- **MiniMax-H3**:
  - Only supports `768p` and `2k` resolutions
  - Maximum 15 seconds
  - Supports the `adaptive` aspect ratio (automatic adaptation)
  - Up to 9 reference images, 3 reference videos, and 3 reference audio clips
  - Does not support `face_swap_mode` or `real_person_mode`
  - Media references are converted via the Moyu asset library to `mm_file://{file_id}` before submission
  - Upstream statuses: `queued` / `in_progress` / `completed` / `failed`
- **Wan 3.0**:
  - Only supports `480p`, `720p`, `1080p`
  - Maximum 30 seconds
  - Supports the `adaptive` aspect ratio
  - Supports text-to-video, image-to-video (first/last frame), video-to-video, and reference audio
  - Up to 9 reference images and 3 reference videos
  - Does not support `face_swap_mode`, `real_person_mode`, `generate_audio`, or `watermark`
  - The backend compresses image assets to JPEG and converts them to base64 data URIs for submission
  - Upstream statuses: `PENDING` / `RUNNING` / `SUCCEEDED` / `FAILED` / `CANCELLED`

### Reserved Fields with No Effect or Limited Effect

The following fields are accepted but **do not actually take effect**; they are kept for compatibility only (except for Wan 3.0):
- `seed`
- `camera_fixed`
- `return_last_frame`
- `draft`
- `frames`
- `fps`
- `service_tier`
- `tools`
- `reference_audio_*` (reference audio is only consumed by some models: `seedance-2.5` / `seedance-2.0` / `seedance-2.0-fast` (via Moyu gateway), `minimax-h3`, `wan3.0-video`; other models ignore it)

---

## Video Generation API Details

### 1. Submit a Video Generation Task

**POST** `/api/v1/video/generations`

Creates a new video generation task.

**Request Parameters:**

| Field | Type | Required | Description |
|------|------|------|------|
| prompt | string | Yes | Video description text, 1-2000 characters |
| model | string | No | Model name, defaults to `seedance-2.0`. Options: `seedance-2.0-fast`, `seedance-2.5`, `gemini-omni-flash-preview`, `kling-3.0`, `kling-3.0-omni`, `minimax-h3`, `wan3.0-video`, `grok-imagine-video` |
| duration | int | No | Video duration (seconds). Default 5. Seedance 2.0/2.0-fast/Kling/Gemini Omni Flash/MiniMax-H3 support 4~15; Seedance 2.5 and Wan 3.0 support 4~30; Grok Imagine supports 1~15 |
| ratio | string | No | Aspect ratio, default `16:9`. MiniMax-H3 additionally supports `adaptive`; Grok Imagine supports `16:9`/`1:1`/`9:16`/`3:2`/`2:3` |
| resolution | string | No | Resolution, default `720p`. Supported ranges vary by model; see "Supported Models and Pricing" |
| generate_audio | bool | No | Whether to generate audio, default `false` |
| watermark | bool | No | Whether to add a watermark, default `false`. Note: the Seedance series (via Moyu gateway) is currently not passed through to upstream; it is only stored |
| real_person_mode | bool | No | Whether to enable real-person mode, default `false` (requires uploading assets via `/video/assets` first and waiting for `Active`)|
| face_swap_mode | bool | No | Whether to enable precision face-swap mode (Seedance series only), default `false`. When enabled, 1 reference image + 1 reference video must be provided |
| negative_prompt | string | No | Negative prompt. Under `face_swap_mode` it is passed through to Seedance metadata; in normal mode its effect depends on upstream support |
| seed | int | No | Random seed (not supported by the current intermediary, kept for compatibility)|
| camera_fixed | bool | No | Whether to fix the camera position (not supported by the current intermediary, kept for compatibility)|
| return_last_frame | bool | No | Whether to return the last frame image (not supported by the current intermediary, kept for compatibility)|
| draft | bool | No | Draft mode (not supported by the current intermediary, kept for compatibility)|
| frames | int | No | Total number of video frames (not supported by the current intermediary, kept for compatibility)|
| fps | int | No | Frame rate (not supported by the current intermediary, kept for compatibility)|
| service_tier | string | No | Service tier (not supported by the current intermediary, kept for compatibility)|
| tools | array | No | Tool calls (not supported by the current intermediary, kept for compatibility)|
| asset_group_id | string | No | Asset group ID; the generated video is automatically added to this asset group upon completion. If omitted, it is automatically placed in the default group |

**Resource Reference Parameters (Image-to-Video / Multimodal Reference):**

> Each resource supports four input methods (URL / upload_id / path / asset_id), which are mutually exclusive — choose one. For `asset_id`, you must first call `POST /video/assets` or `POST /video/assets/from-upload` to upload and register it, and wait until the asset status is `Active` before using it.

| Field | Type | Description |
|------|------|------|
| first_frame_url / first_frame_upload_id / first_frame_path / first_frame_asset_id | string | First-frame image |
| last_frame_url / last_frame_upload_id / last_frame_path / last_frame_asset_id | string | Last-frame image |
| reference_image_urls / reference_image_upload_ids / reference_image_paths / reference_image_asset_ids | array | List of reference images. Seedance / Wan 3.0 / MiniMax-H3: up to 9, **Gemini Omni Flash: up to 5**, Grok Imagine: up to 7 |
| reference_video_urls / reference_video_upload_ids / reference_video_paths | array | List of reference videos, up to 3. `wan3.0-video` uses the reference-to-video mode: reference videos drive the motion/camera/background, and prompts can refer to them in order as "Video 1", "Video 2" (e.g., "keep the motion of Video 1, change to a seaside scene") |
| reference_audio_urls / reference_audio_upload_ids / reference_audio_paths | array | List of reference audio clips. Only consumed by `seedance-2.5` / `seedance-2.0` / `seedance-2.0-fast` (via Moyu gateway), `minimax-h3`, and `wan3.0-video`; other models ignore it |
| reference_file_url / reference_file_upload_id / reference_file_path | string | **Reference file (document input), only supported by `wan3.0-video`, maximum 1**. Formats: doc/docx/xls/xlsx/ppt/pptx/pdf/txt/md/key/pages/numbers, ≤100MB, ≤50 pages. Upload via `POST /storage/upload` (`file_type=other`) or `POST /video/assets`; URL / upload_id / path are all accepted |

> **Document-to-Video Example**: After uploading a PPT, create a task——
>
> ```json
> {
>   "prompt": "根据 PPT 内容介绍产品，生成宣传视频",
>   "model": "wan3.0-video",
>   "duration": 5,
>   "ratio": "16:9",
>   "resolution": "720p",
>   "reference_file_url": "https://example.com/slides.pptx"
> }
> ```

> **Video-to-Video Example (reference-to-video, `wan3.0-video` only)**: The reference video drives the motion/camera/background——
>
> ```json
> {
>   "prompt": "保留视频1的动作、镜头与背景，把人物换成在雪地跳舞",
>   "model": "wan3.0-video",
>   "duration": 5,
>   "ratio": "16:9",
>   "resolution": "720p",
>   "reference_video_urls": ["https://example.com/dance.mp4"]
> }
> ```
>
> The reference video is ultimately submitted to DashScope as `reference_video` type entries in `input.media[]` (up to 5 clips officially supported, platform-limited to 3). The three input methods `reference_video_urls` / `reference_video_upload_ids` / `reference_video_paths` are equivalent and can be mixed.

> **Mixing Rules**: `reference_image` cannot appear together with `first_frame` / `last_frame` (normal mode, Seedance series). `gemini-omni-flash-preview`, `minimax-h3`, and `wan3.0-video` allow reference images to be used together with first/last frames. Real-person mode (`real_person_mode=true`) or precision face-swap mode (`face_swap_mode=true`) allows them to be used together.

**Supported Models:**

- `seedance-2.0` - High quality, supports 4K
- `seedance-2.0-fast` - Fast generation, up to 720p
- `seedance-2.5` - Higher quality, supports 4K and up to 30 seconds
- `gemini-omni-flash-preview` - Google Vertex AI, supports text-to-video/image-to-video, native audio, 360p/720p/1080p/4k
- `kling-3.0` - Tencent Cloud VOD Kling 3.0
- `kling-3.0-omni` - Kling 3.0 Omni multimodal version
- `minimax-h3` - Next-generation open general-purpose multimodal video model, supports 768p/2k, text-to-video/image-to-video/first-last-frame/multimodal reference
- `wan3.0-video` - Alibaba Cloud DashScope Wan 3.0, supports text-to-video/image-to-video/video-to-video (reference-to-video, reference videos drive the output), reference audio, **document input (PPT/doc/xls/pdf/md, ≤100MB, maximum 1)**
- `grok-imagine-video` - xAI Grok Imagine Video v1.5 (via WaveSpeedAI), supports text-to-video/first-frame image-to-video/multi-reference images (≤7), 1~15 seconds

For the actual billing logic, see "Supported Models and Pricing"; the frontend should use the `pricing.estimated_cost` returned by the API.

**Supported Aspect Ratios:**

- `16:9` - Landscape (default)
- `9:16` - Portrait
- `1:1` - Square
- `4:3`, `3:4`, `21:9`, `adaptive`

**Supported Resolutions:**

| Model | Supported Resolutions |
|------|-------------|
| `seedance-2.0` | `480p`, `720p`, `1080p`, `4k` |
| `seedance-2.0-fast` | `480p`, `720p` |
| `seedance-2.5` | `480p`, `720p`, `1080p`, `4k` |
| `gemini-omni-flash-preview` | `360p`, `720p`, `1080p`, `4k` |
| `kling-3.0` | `720p`, `1080p`, `2k`, `4k` |
| `kling-3.0-omni` | `720p`, `1080p`, `2k`, `4k` |
| `minimax-h3` | `768p`, `2k` |
| `wan3.0-video` | `480p`, `720p`, `1080p` |
| `grok-imagine-video` | `480p`, `720p`, `1080p` |

**Note**: The `kling-3.0` series does not support `480p`. `gemini-omni-flash-preview` supports `360p` (not `480p`). `minimax-h3` only supports `768p` and `2k`. `wan3.0-video` does not support `4k`.

**Python Example:**

```python
import requests
import time

API_KEY = "np_your_api_key_here"
BASE_URL = "https://api.useneospark.com/api/v1"

def create_video_task(prompt: str, **kwargs) -> dict:
    """创建视频生成任务"""
    payload = {
        "prompt": prompt,
        "model": kwargs.get("model", "seedance-2.0"),
        "duration": kwargs.get("duration", 5),
        "ratio": kwargs.get("ratio", "16:9"),
        "resolution": kwargs.get("resolution", "720p"),
        "generate_audio": kwargs.get("generate_audio", False),
        "watermark": kwargs.get("watermark", False),
    }

    # 可选高级参数
    for key in ["seed", "camera_fixed", "return_last_frame", "draft",
                "frames", "fps", "service_tier", "tools"]:
        if key in kwargs:
            payload[key] = kwargs[key]

    # 可选资源参数
    for key in ["first_frame_url", "first_frame_upload_id", "first_frame_path",
                "last_frame_url", "last_frame_upload_id", "last_frame_path",
                "reference_image_urls", "reference_image_upload_ids", "reference_image_paths",
                "reference_video_urls", "reference_video_upload_ids", "reference_video_paths",
                "reference_audio_urls", "reference_audio_upload_ids", "reference_audio_paths"]:
        if key in kwargs:
            payload[key] = kwargs[key]

    response = requests.post(
        f"{BASE_URL}/video/generations",
        headers={
            "X-API-Key": API_KEY,
            "Content-Type": "application/json"
        },
        json=payload
    )
    response.raise_for_status()
    return response.json()

# 示例 1：文生视频
result = create_video_task(
    prompt="一只可爱的猫咪在草地上玩耍，阳光明媚，微风轻拂",
    model="seedance-2.0",
    duration=5,
    ratio="16:9",
    resolution="720p"
)
print(f"Task created: {result['data']['task_id']}")
print(f"Estimated cost: {result['data']['pricing']['estimated_cost']} credits")

# 示例 2：首帧图生视频
result = create_video_task(
    prompt="镜头缓慢推进，展示更多细节",
    model="seedance-2.0",
    duration=5,
    first_frame_url="https://example.com/image.png"
)

# 示例 3：多模态参考（图片风格 + 音频节奏）
result = create_video_task(
    prompt="参考图片的风格和音频的节奏生成视频",
    model="seedance-2.0",
    duration=10,
    reference_image_urls=["https://example.com/style.png"],
    reference_audio_urls=["https://example.com/music.mp3"]
)
```

**JavaScript Example:**

```javascript
async function createVideoTask(prompt, options = {}) {
  const payload = {
    prompt,
    model: options.model || "seedance-2.0",
    duration: options.duration || 5,
    ratio: options.ratio || "16:9",
    resolution: options.resolution || "720p",
    generate_audio: options.generateAudio || false,
    watermark: options.watermark || false,
    ...options,
  };

  const response = await fetch(`${BASE_URL}/video/generations`, {
    method: "POST",
    headers: {
      "X-API-Key": API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return await response.json();
}

// 使用示例
createVideoTask("一只可爱的猫咪在草地上玩耍，阳光明媚，微风轻拂", {
  model: "seedance-2.0",
  duration: 5,
}).then((result) => {
  console.log("Task ID:", result.data.task_id);
});
```

**Response Example:**

```json
{
  "code": 200,
  "data": {
    "task_id": "video_a1b2c3d4e5f6",
    "external_task_id": "cgt-20260513152306-y92dz",
    "status": "pending",
    "progress": 0,
    "model": "seedance-2.0",
    "duration": 5,
    "ratio": "16:9",
    "resolution": "720p",
    "pricing": {
      "estimated_cost": 110,
      "currency": "credits"
    },
    "available_points_after": 23864,
    "created_at": "2025-04-09T12:00:00"
  }
}
```

---

### 2. Query Task Status

**GET** `/api/v1/video/generations/{task_id}`

Queries the current status of a video generation task.

**Python Example:**

```python
def get_video_task(task_id: str) -> dict:
    """获取视频任务状态"""
    response = requests.get(
        f"{BASE_URL}/video/generations/{task_id}",
        headers={"X-API-Key": API_KEY}
    )
    response.raise_for_status()
    return response.json()

# 查询任务
result = get_video_task("video_a1b2c3d4e5f6")
print(f"Status: {result['data']['status']}")
print(f"Progress: {result['data']['progress']}%")
if result["data"]["status"] == "completed":
    print(f"Video URL: {result['data']['video_url']}")
```

**JavaScript Example:**

```javascript
async function getVideoTask(taskId) {
  const response = await fetch(`${BASE_URL}/video/generations/${taskId}`, {
    headers: { "X-API-Key": API_KEY },
  });
  return await response.json();
}

// 使用示例
getVideoTask("video_a1b2c3d4e5f6").then((result) => {
  console.log("Status:", result.data.status);
  console.log("Progress:", result.data.progress);
});
```

**Response Fields:**
- `task_id`: Task ID
- `external_task_id`: Upstream provider task ID (e.g., `cgt-xxx`)
- `status`: Status — `pending` / `processing` / `completed` / `failed` / `cancelled`
- `progress`: Progress percentage
- `prompt`: Prompt
- `model`: Model
- `duration`: Duration
- `ratio`: Aspect ratio
- `resolution`: Resolution
- `generate_audio`: Whether audio was generated
- `watermark`: Whether a watermark was added
- `video_url`: Result video URL (after completion, returns a local/S3 playback URL; falls back to the upstream URL if the download fails)
- `estimated_cost`: Estimated cost
- `actual_cost`: Actual charge (after completion)
- `completion_tokens`: Completion token usage returned by upstream (for reference)
- `total_tokens`: Total token count returned by upstream (for reference)
- `token_cost`: Cost calculated from tokens (for reference, already includes the 1.55x factor)
- `error_msg`: Error message (on failure)
- `created_at`: Creation time
- `completed_at`: Completion time

**Notes**:
- Every query automatically syncs the latest upstream status.
- After a task completes, the backend automatically downloads the video to local/S3 storage, and `video_url` returns a locally accessible URL; if the download fails, it falls back to the upstream URL so the frontend never receives an empty address.
- If upstream reports success but returns no video URL, the task remains `processing` and polling continues (it does not return `completed`); if no address is obtained within the grace period (default 30 minutes), it is marked `failed` and the credits are refunded.

**Response Example (Processing)**:

```json
{
  "code": 200,
  "data": {
    "task_id": "video_a1b2c3d4e5f6",
    "external_task_id": "cgt-20260513152306-y92dz",
    "status": "processing",
    "progress": 45,
    "prompt": "一只可爱的猫咪...",
    "model": "seedance-2.0",
    "duration": 5,
    "ratio": "16:9",
    "resolution": "720p",
    "generate_audio": false,
    "watermark": false,
    "video_url": null,
    "estimated_cost": 110,
    "actual_cost": null,
    "error_msg": null,
    "created_at": "2025-04-09T12:00:00",
    "completed_at": null
  }
}
```

**Response Example (Completed):**

```json
{
  "code": 200,
  "data": {
    "task_id": "video_a1b2c3d4e5f6",
    "external_task_id": "cgt-20260513152306-y92dz",
    "status": "completed",
    "progress": 100,
    "prompt": "一只可爱的猫咪...",
    "model": "seedance-2.0",
    "duration": 5,
    "ratio": "16:9",
    "resolution": "720p",
    "generate_audio": false,
    "watermark": false,
    "video_url": "/uploads/1/videos/2026/10/08/video_a1b2c3d4e5f6.mp4",
    "estimated_cost": 110,
    "actual_cost": 110,
    "error_msg": null,
    "created_at": "2025-04-09T12:00:00",
    "completed_at": "2025-04-09T12:02:30"
  }
}
```

---

### 3. Poll Until Task Completion

**Python Full Example:**

```python
import time
import requests

def wait_for_video_completion(
    task_id: str,
    poll_interval: int = 5,
    max_attempts: int = 60,
    max_network_retries: int = 3,
) -> dict:
    """
    轮询等待视频生成完成

    Args:
        task_id: 任务ID
        poll_interval: 轮询间隔（秒），默认 5 秒
        max_attempts: 最大轮询次数，默认 60 次（5分钟）
        max_network_retries: 单次轮询遇到网络/5xx 错误时的最大重试次数

    Returns:
        完成的任务数据
    """
    network_retry = 0

    for attempt in range(max_attempts):
        try:
            result = get_video_task(task_id)
            network_retry = 0  # 成功则重置网络重试计数
        except requests.exceptions.RequestException as e:
            # 网络抖动、超时、5xx 等可重试错误先重试，不要轻易判定失败
            network_retry += 1
            if network_retry > max_network_retries:
                raise Exception(f"Failed to poll task status: {e}")
            time.sleep(poll_interval)
            continue

        data = result["data"]
        status = data["status"]
        progress = data["progress"]

        print(f"[{attempt + 1}/{max_attempts}] Status: {status}, Progress: {progress}%")

        if status == "completed":
            # 部分上游会先返回 completed 再异步生成 video_url，可短暂继续轮询
            if not data.get("video_url"):
                time.sleep(poll_interval)
                continue
            print(f"Video completed! URL: {data['video_url']}")
            return data
        elif status == "failed":
            error_msg = data.get("error_msg", "Unknown error")
            raise Exception(f"Video generation failed: {error_msg}")
        elif status == "cancelled":
            raise Exception("Video generation was cancelled")

        time.sleep(poll_interval)

    raise TimeoutError(f"Video generation timeout after {max_attempts * poll_interval} seconds")

# 完整流程：创建并等待完成
def generate_video(prompt: str, **options) -> str:
    """完整的视频生成流程，返回视频URL"""

    # 1. 创建任务
    print("Creating video task...")
    result = create_video_task(prompt, **options)
    task_id = result["data"]["task_id"]
    print(f"Task created: {task_id}")

    # 2. 等待完成
    print("Waiting for video generation...")
    final_data = wait_for_video_completion(task_id)

    return final_data["video_url"]

# 使用示例
if __name__ == "__main__":
    try:
        video_url = generate_video(
            prompt="一只可爱的柯基犬在海滩上奔跑，夕阳下的金色沙滩",
            model="seedance-2.0",
            duration=5,
            ratio="16:9",
            resolution="720p"
        )
        print(f"\nSuccess! Video URL: {video_url}")
    except Exception as e:
        print(f"\nError: {e}")
```

**JavaScript/TypeScript Full Example:**

```typescript
interface VideoTask {
  task_id: string;
  status: "pending" | "processing" | "completed" | "failed" | "cancelled";
  progress: number;
  video_url?: string;
  error_msg?: string;
}

interface VideoOptions {
  model?: string;
  duration?: number;
  ratio?: string;
  resolution?: string;
  generateAudio?: boolean;
  watermark?: boolean;
  seed?: number;
  cameraFixed?: boolean;
  returnLastFrame?: boolean;
  draft?: boolean;
  frames?: number;
  fps?: number;
  serviceTier?: string;
  tools?: Array<{type: string}>;
  firstFrameUrl?: string;
  firstFrameUploadId?: string;
  lastFrameUrl?: string;
  lastFrameUploadId?: string;
  referenceImageUrls?: string[];
  referenceVideoUrls?: string[];
  referenceAudioUrls?: string[];
}

class NeoSparkVideoClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl = "https://api.useneospark.com/api/v1") {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  private async request(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<any> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        "X-API-Key": this.apiKey,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    return await response.json();
  }

  async createTask(
    prompt: string,
    options: VideoOptions = {}
  ): Promise<VideoTask> {
    const result = await this.request("/video/generations", {
      method: "POST",
      body: JSON.stringify({
        prompt,
        model: options.model || "seedance-2.0",
        duration: options.duration || 5,
        ratio: options.ratio || "16:9",
        resolution: options.resolution || "720p",
        generate_audio: options.generateAudio || false,
        watermark: options.watermark || false,
        seed: options.seed,
        camera_fixed: options.cameraFixed || false,
        return_last_frame: options.returnLastFrame || false,
        draft: options.draft || false,
        frames: options.frames,
        fps: options.fps,
        service_tier: options.serviceTier || "default",
        tools: options.tools,
        first_frame_url: options.firstFrameUrl,
        first_frame_upload_id: options.firstFrameUploadId,
        last_frame_url: options.lastFrameUrl,
        last_frame_upload_id: options.lastFrameUploadId,
        reference_image_urls: options.referenceImageUrls,
        reference_video_urls: options.referenceVideoUrls,
        reference_audio_urls: options.referenceAudioUrls,
      }),
    });
    return result.data;
  }

  async getTask(taskId: string): Promise<VideoTask> {
    const result = await this.request(`/video/generations/${taskId}`);
    return result.data;
  }

  async waitForCompletion(
    taskId: string,
    onProgress?: (status: string, progress: number) => void,
    pollInterval: number = 5000,
    maxNetworkRetries: number = 3
  ): Promise<VideoTask> {
    let networkRetry = 0;

    return new Promise((resolve, reject) => {
      const poll = async () => {
        try {
          const task = await this.getTask(taskId);
          networkRetry = 0; // 成功则重置

          if (onProgress) {
            onProgress(task.status, task.progress);
          }

          if (task.status === "completed") {
            // 部分上游会先返回 completed 再异步生成 video_url
            if (!task.video_url) {
              setTimeout(poll, pollInterval);
              return;
            }
            resolve(task);
          } else if (task.status === "failed") {
            reject(new Error(`Video generation failed: ${task.error_msg}`));
          } else if (task.status === "cancelled") {
            reject(new Error("Video generation was cancelled"));
          } else {
            setTimeout(poll, pollInterval);
          }
        } catch (error: any) {
          // 网络抖动、超时、5xx 等可重试错误先重试
          networkRetry += 1;
          if (networkRetry > maxNetworkRetries) {
            reject(error);
            return;
          }
          setTimeout(poll, pollInterval);
        }
      };

      poll();
    });
  }

  async generateVideo(
    prompt: string,
    options: VideoOptions = {},
    onProgress?: (status: string, progress: number) => void
  ): Promise<string> {
    // 创建任务
    const task = await this.createTask(prompt, options);
    console.log("Task created:", task.task_id);

    // 等待完成
    const completed = await this.waitForCompletion(task.task_id, onProgress);

    if (!completed.video_url) {
      throw new Error("Video URL not found in completed task");
    }

    return completed.video_url;
  }
}

// React Hook 示例
import { useState, useCallback } from "react";

export function useVideoGeneration(apiKey: string) {
  const [status, setStatus] = useState<string>("idle");
  const [progress, setProgress] = useState<number>(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generateVideo = useCallback(
    async (prompt: string, options?: VideoOptions) => {
      setStatus("creating");
      setProgress(0);
      setError(null);

      const client = new NeoSparkVideoClient(apiKey);

      try {
        const url = await client.generateVideo(
          prompt,
          options,
          (status, progress) => {
            setStatus(status);
            setProgress(progress);
          }
        );

        setVideoUrl(url);
        setStatus("completed");
        return url;
      } catch (err: any) {
        setError(err.message);
        setStatus("failed");
        throw err;
      }
    },
    [apiKey]
  );

  return { generateVideo, status, progress, videoUrl, error };
}

// React 组件使用示例
function VideoGenerator() {
  const { generateVideo, status, progress, videoUrl, error } =
    useVideoGeneration("np_your_api_key");
  const [prompt, setPrompt] = useState("");

  const handleGenerate = async () => {
    try {
      await generateVideo(prompt, { duration: 5, ratio: "16:9" });
    } catch (e) {
      console.error("Failed to generate video:", e);
    }
  };

  return (
    <div>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="描述你想要生成的视频..."
      />
      <button onClick={handleGenerate} disabled={status === "processing"}>
        {status === "processing"
          ? `Generating... ${progress}%`
          : "Generate Video"}
      </button>

      {error && <div className="error">{error}</div>}

      {videoUrl && <video src={videoUrl} controls width="100%" />}
    </div>
  );
}
```

---

### 4. List All Video Tasks

**GET** `/api/v1/video/generations`

Gets the video task list for the current user.

**Query Parameters:**

| Parameter | Type | Required | Description |
|------|------|------|------|
| page | int | No | Page number, default 1 |
| page_size | int | No | Page size, default 20, maximum 100 |
| status | string | No | Status filter: pending/processing/completed/failed/cancelled |

**Python Example:**

```python
def list_video_tasks(page: int = 1, page_size: int = 20, status: str = None) -> dict:
    """列出视频任务"""
    params = {
        "page": page,
        "page_size": page_size
    }
    if status:
        params["status"] = status

    response = requests.get(
        f"{BASE_URL}/video/generations",
        headers={"X-API-Key": API_KEY},
        params=params
    )
    return response.json()

# 获取所有任务
result = list_video_tasks()
for task in result["data"]["items"]:
    print(f"{task['task_id']}: {task['status']} - {task['prompt'][:30]}...")

# 获取已完成的任务
completed = list_video_tasks(status="completed")
print(f"Completed tasks: {completed['data']['total']}")
```

**Response Example:**

```json
{
  "code": 200,
  "data": {
    "items": [
      {
        "task_id": "video_a1b2c3d4e5f6",
        "status": "completed",
        "progress": 100,
        "prompt": "一只可爱的猫咪...",
        "model": "seedance-2.0",
        "preview_url": "/uploads/1/videos/2026/10/08/video_a1b2c3d4e5f6.mp4",
        "estimated_cost": 110,
        "error_msg": null,
        "created_at": "2025-04-09T12:00:00"
      }
    ],
    "total": 1,
    "page": 1,
    "page_size": 20
  }
}
```

---

### 5. Delete a Video Task

**DELETE** `/api/v1/video/generations/{task_id}`

Deletes a completed video task record.

**Python Example:**

```python
def delete_video_task(task_id: str) -> dict:
    """删除视频任务"""
    response = requests.delete(
        f"{BASE_URL}/video/generations/{task_id}",
        headers={"X-API-Key": API_KEY}
    )
    return response.json()

# 删除任务
result = delete_video_task("video_a1b2c3d4e5f6")
print(result["message"])  # "Task deleted"
```

**Note:** Only completed, failed, or cancelled tasks can be deleted.

---

### 6. Get Model List

**GET** `/api/v1/video/models`

Gets the list of supported video generation models and pricing information.

**Python Example:**

```python
def list_video_models() -> dict:
    """获取视频模型列表"""
    response = requests.get(
        f"{BASE_URL}/video/models",
        headers={"X-API-Key": API_KEY}
    )
    return response.json()

# 获取模型列表
result = list_video_models()
for model in result["data"]["models"]:
    print(f"{model['name']}: {model['price_per_second']} credits/second")
```

**Response Example:**

```json
{
  "code": 200,
  "data": {
    "models": [
      {
        "id": "seedance-2.0",
        "name": "Seedance 2.0",
        "description": "Highest quality, balanced cost and generation speed",
        "price_per_second": 22
      },
      {
        "id": "seedance-2.0-fast",
        "name": "Seedance 2.0 Fast",
        "description": "Faster generation, lower cost, slightly lower quality",
        "price_per_second": 18
      }
    ],
    "ratios": ["16:9", "4:3", "1:1", "3:4", "9:16", "21:9", "adaptive"],
    "resolutions": {
      "seedance-2.0": ["480p", "720p", "1080p", "4k"],
      "seedance-2.0-fast": ["480p", "720p"]
    },
    "durations": {
      "default": {"min": 4, "max": 15, "default": 5},
      "seedance-2.5": {"min": 4, "max": 30, "default": 5},
      "wan3.0-video": {"min": 4, "max": 30, "default": 5}
    },
    "capabilities": [
      "text_to_video",
      "image_to_video",
      "multi_modal_reference",
      "video_editing",
      "video_extension",
      "audio_generation",
      "web_search"
    ]
  }
}
```

---

## Assets API

To use real-person mode or reuse assets in video generation, you can first register images/videos/audio to the Moyu asset library, obtain an `asset_id`, and then use it in the generation request.

### 1. Upload an Asset Directly

**POST** `/api/v1/video/assets`

Uploads a file directly and registers it as an asset.

**Request Body**: `multipart/form-data`
- `file`: File content
- `asset_type`: Asset type — `image` / `video` / `audio`, default `image`
- `name`: Asset display name (optional)

**Response Example**:
```json
{
  "code": 200,
  "data": {
    "asset_id": "asset_abc123",
    "name": "product.jpg",
    "asset_type": "Image",
    "status": "active",
    "url": "https://...",
    "upload_id": "up_xxx",
    "local_url": "/uploads/..."
  }
}
```

**Notes**:
- Image assets must be at least 300×300 pixels.
- After upload, it waits for the asset status to become `Active`, for up to 60 seconds. If it times out, it returns `status: processing`, and you must poll `GET /video/assets/{asset_id}` yourself.

### 2. Create an Asset from an Existing Upload

**POST** `/api/v1/video/assets/from-upload`

Registers a file already uploaded via `/storage/upload` as a Moyu asset library asset.

**Request Body**:
```json
{
  "upload_id": "up_abc123",
  "asset_type": "image",
  "name": "product"
}
```

**Response Example**: Same as uploading an asset directly.

### 3. Query Asset Status

**GET** `/api/v1/video/assets/{asset_id}`

Queries the current status of an asset.

**Response Example**:
```json
{
  "code": 200,
  "data": {
    "asset_id": "asset_abc123",
    "name": "product.jpg",
    "asset_type": "Image",
    "status": "active",
    "url": "https://..."
  }
}
```

---

## Video Watermark Removal API

Calls the WaveSpeed AI `video-watermark-remover` model to remove watermarks, logos, or subtitles from videos.

### 1. Create a Watermark Removal Task

**POST** `/api/v1/video/remove-watermark`

**Request Parameters:**

| Field | Type | Required | Description |
|------|------|------|------|
| video_url | string | No (choose one of three) | Public video URL |
| video_upload_id | string | No (choose one of three) | Video upload ID |
| video_path | string | No (choose one of three) | Video local path, e.g., `/uploads/...` |
| duration | int | No | Video duration (seconds), 1-600. If omitted, it is auto-detected |

**Billing Rules**: 1 credit/second, minimum 5 credits.

**Response Example**:
```json
{
  "code": 200,
  "data": {
    "task_id": "vwm_a1b2c3d4e5f6",
    "external_task_id": "wavespeed_xxx",
    "status": "pending",
    "progress": 0,
    "video_duration": 10,
    "pricing": {
      "estimated_cost": 10,
      "currency": "credits",
      "price_per_second": 1,
      "minimum_charge_seconds": 5
    },
    "available_points_after": 23864,
    "created_at": "2025-04-09T12:00:00"
  }
}
```

### 2. Query Watermark Removal Task Status

**GET** `/api/v1/video/remove-watermark/{task_id}`

**Response Example (Completed)**:
```json
{
  "code": 200,
  "data": {
    "task_id": "vwm_a1b2c3d4e5f6",
    "external_task_id": "wavespeed_xxx",
    "status": "completed",
    "progress": 100,
    "source_video_url": "https://...",
    "video_duration": 10,
    "result_video_url": "/uploads/1/videos/2026/10/08/vwm_a1b2c3d4e5f6.mp4",
    "estimated_cost": 10,
    "actual_cost": 10,
    "error_msg": null,
    "created_at": "2025-04-09T12:00:00",
    "completed_at": "2025-04-09T12:02:30"
  }
}
```

### 3. List Watermark Removal Tasks

**GET** `/api/v1/video/remove-watermark`

**Query Parameters:**
- `page`: Page number, default 1
- `page_size`: Page size, default 20
- `status`: Status filter

---

## Error Handling

### Common Error Codes

| HTTP Code | Description | Suggested Action |
|-----------|------|----------|
| 200 | Success | - |
| 400 | Invalid request parameters | Check parameter format and range |
| 401 | API Key invalid or expired | Check the API Key and regenerate it |
| 402 | Insufficient credits | Check your balance; top up or redeem credits |
| 403 | User restricted from generating videos | An administrator set `can_generate_video=false` |
| 404 | Task does not exist | Check that the task_id is correct; also returned if the task was deleted |
| 429 | Too many requests | Reduce the request rate; add retry backoff |
| 500 | Internal server error | Retry later; contact support |
| 502 | External service error | Upstream service temporarily unavailable; retry later |

### Handling Polling Failures

While polling `GET /video/generations/{task_id}`, you may encounter network jitter, timeouts, or transient upstream 5xx errors. Recommended practices:

1. **Distinguish error types**:
   - **Network / timeout / 5xx**: Retry 3-5 times with backoff (e.g., 5s → 7.5s → 11s).
   - **401 / 403**: API Key invalid or user restricted; stop polling and prompt for re-authentication.
   - **404**: Task does not exist or was deleted; stop polling.
   - **Task status `failed` / `cancelled`**: A real failure; display `error_msg`.

2. **Long-running `processing` with no result / upstream completed but no `video_url`**:
   The backend handles this automatically — when upstream reports success but returns no video URL, the task stays `processing` and polling continues (it does not return `completed`); if no address is obtained within the grace period (default 30 minutes), it is marked `failed` and the credits are refunded. The client needs no special handling — just keep polling normally based on `status`.

3. **Set a per-request timeout**:
   Set a 10-20 second timeout for each polling request to avoid connections hanging for a long time.

### Error Response Format

**Business errors (4xx):**

```json
{
  "code": 402,
  "message": "积分不足，无法完成此操作。当前可用积分: 50，需要积分: 110",
  "data": null
}
```

**External service errors (502):**

```json
{
  "code": 502,
  "message": "Video task creation failed: Server error '503 Service Unavailable' ...",
  "error": "Server error '503 Service Unavailable' ...",
  "traceback": "...",
  "error_type": "task_creation_failed"
}
```

Possible values of `error_type`:
- `task_creation_failed` — Task creation failed
- `dashscope_video_task_creation_failed` — DashScope Wan 3.0 task creation failed
- `authentication_failed` — Upstream authentication failed (check MOYU_API_KEY / TENCENT_VOD_SECRET_ID/SECRET_KEY / GOOGLE_APPLICATION_CREDENTIALS / DASHSCOPE_API_KEY)
- `asset_upload_failed` — Legacy asset upload failed (deprecated)
- `asset_registration_failed` — Asset registration to Moyu failed
- `asset_processing_failed` — Asset processing failed
- `omni_task_creation_failed` — Omni task creation failed
- `vertex_video_task_creation_failed` — Vertex AI Gemini Omni Flash task creation failed
- `tencent_vod_task_creation_failed` — Tencent Cloud VOD task creation failed
- `wavespeed_task_creation_failed` — WaveSpeed watermark removal task creation failed
- `timeout` — Upstream service timeout
- `internal_server_error` — Internal server error

### Python Error Handling Example

```python
import requests
from requests.exceptions import HTTPError

def safe_api_call(func):
    """API 调用装饰器，统一错误处理"""
    def wrapper(*args, **kwargs):
        try:
            result = func(*args, **kwargs)

            # 检查业务错误码
            code = result.get("code", 200)
            if code != 200:
                message = result.get("message", "Unknown error")

                if code == 401:
                    raise AuthenticationError(f"API Key invalid: {message}")
                elif code == 402:
                    raise InsufficientPointsError(f"Not enough credits: {message}")
                else:
                    raise APIError(f"Error {code}: {message}")

            return result

        except HTTPError as e:
            status_code = e.response.status_code

            if status_code == 401:
                raise AuthenticationError("API Key is invalid or expired")
            else:
                raise APIError(f"HTTP {status_code}: {str(e)}")

        except requests.exceptions.RequestException as e:
            raise NetworkError(f"Network error: {str(e)}")

    return wrapper

class AuthenticationError(Exception):
    pass

class InsufficientPointsError(Exception):
    pass

class APIError(Exception):
    pass

class NetworkError(Exception):
    pass

# 使用装饰器
@safe_api_call
def create_video_task_safe(prompt: str, **kwargs) -> dict:
    payload = {
        "prompt": prompt,
        "model": kwargs.get("model", "seedance-2.0"),
        "duration": kwargs.get("duration", 5),
        "ratio": kwargs.get("ratio", "16:9"),
        "resolution": kwargs.get("resolution", "720p"),
    }
    response = requests.post(
        f"{BASE_URL}/video/generations",
        headers={
            "X-API-Key": API_KEY,
            "Content-Type": "application/json"
        },
        json=payload
    )
    response.raise_for_status()
    return response.json()
```

---

## Best Practices

### 1. API Key Security

**Do NOT:**

```javascript
// 在前端代码中硬编码
const API_KEY = "np_xxxxxxxxxxxxx";
```

**Recommended:**

```javascript
// 从环境变量读取
const API_KEY = process.env.NEOSPARK_API_KEY;

// 或使用配置文件（.gitignore）
import config from "./config";
const API_KEY = config.apiKey;
```

### 2. Credit Estimation

Before generating a video, check the user's credits:

```python
def check_points_before_task(cost: int) -> bool:
    """检查是否有足够积分"""
    response = requests.get(
        f"{BASE_URL}/auth/me",
        headers={"X-API-Key": API_KEY}
    )
    data = response.json()
    balance = data["data"]["balance"]

    if balance < cost:
        print(f"Insufficient points: {balance} < {cost}")
        return False
    return True

# 视频价格表（基础单价，积分/秒，仅供参考，以接口返回 pricing.estimated_cost 为准）
VIDEO_PRICES = {
    "seedance-2.0": 22,
    "seedance-2.0-fast": 18,
    "seedance-2.5": 42,
    "kling-3.0": 23,
    "kling-3.0-omni": 35,
    "gemini-omni-flash-preview": 36,  # 720p 基准，360p=12, 1080p=54, 4k=106
    "minimax-h3": 15,
    "wan3.0-video": 27,  # 720p 基准，480p=14, 1080p=55
    "grok-imagine-video": 22,  # 文生；图生/参考图生约 25
}

def calculate_video_cost(model: str, duration: int) -> int:
    """计算视频生成实际扣费（仅部分模型含 7.9 折补偿）"""
    base = VIDEO_PRICES.get(model, 22) * duration
    # Gemini Omni Flash / MiniMax-H3 等固定单价模型需要补偿 7.9 折；Grok / Wan 3.0 已按官方价换算无补偿
    if model in {"gemini-omni-flash-preview", "minimax-h3"}:
        return (base * 100 + 78) // 79  # ceil(base / 0.79)
    return base
```

### 3. Robust Polling

Video generation takes a long time, and the polling phase is prone to network jitter. Do not treat a single failed query as a task failure. Recommended strategy:

- Normal `pending` / `processing`: query every 3-5 seconds.
- When a query fails:
  - Network / timeout / 5xx: retry 3-5 times with exponential backoff.
  - 401 / 403: stop polling and re-authenticate.
  - 404: stop polling; the task may have been deleted.
- `completed` but no `video_url`: the backend already handles this in the normal flow (when upstream succeeds but returns no address, the task stays `processing` rather than `completed`); if it still occurs occasionally, continue polling a few more times.
- Set a per-query timeout (10-20 seconds) to prevent the browser/client from hanging for a long time.

### 4. Task Management

It is recommended to keep a local task list so users can view their history:

```python
import json
import os
from datetime import datetime

class TaskManager:
    def __init__(self, storage_file: str = "video_tasks.json"):
        self.storage_file = storage_file
        self.tasks = self._load_tasks()

    def _load_tasks(self) -> dict:
        if os.path.exists(self.storage_file):
            with open(self.storage_file, 'r') as f:
                return json.load(f)
        return {}

    def _save_tasks(self):
        with open(self.storage_file, 'w') as f:
            json.dump(self.tasks, f, indent=2)

    def add_task(self, task_id: str, prompt: str, **metadata):
        self.tasks[task_id] = {
            "task_id": task_id,
            "prompt": prompt,
            "status": "pending",
            "created_at": datetime.now().isoformat(),
            **metadata
        }
        self._save_tasks()

    def update_task(self, task_id: str, **updates):
        if task_id in self.tasks:
            self.tasks[task_id].update(updates)
            self._save_tasks()

    def get_task(self, task_id: str) -> dict:
        return self.tasks.get(task_id)

    def list_tasks(self, status: str = None) -> list:
        tasks = list(self.tasks.values())
        if status:
            tasks = [t for t in tasks if t["status"] == status]
        return sorted(tasks, key=lambda x: x["created_at"], reverse=True)
```

### 4. Complete Example Project Structure

```
my-video-app/
├── .env                    # 环境变量（不提交到 Git）
├── config.py               # 配置管理
├── neospark_client.py      # NeoSpark 客户端封装
├── task_manager.py         # 任务管理
├── video_generator.py      # 视频生成逻辑
└── main.py                 # 主程序
```

**config.py:**

```python
import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    NEOSPARK_API_KEY = os.getenv("NEOSPARK_API_KEY")
    NEOSPARK_BASE_URL = os.getenv("NEOSPARK_BASE_URL", "https://api.useneospark.com/api/v1")
    DEFAULT_VIDEO_MODEL = "seedance-2.0"
    DEFAULT_VIDEO_DURATION = 5
    DEFAULT_VIDEO_RATIO = "16:9"
    DEFAULT_VIDEO_RESOLUTION = "720p"

    @classmethod
    def validate(cls):
        if not cls.NEOSPARK_API_KEY:
            raise ValueError("NEOSPARK_API_KEY is required")

Config.validate()
```

---

## References

- API Documentation: https://api.useneospark.com/docs
- Admin Console: https://platform.useneospark.com
- Technical Support: support@useneospark.com

---

**Document Version**: 2.5
**Last Updated**: 2026-09-22
**Compatible Versions**: seedance-2.0 / seedance-2.0-fast / seedance-2.5 / gemini-omni-flash-preview / kling-3.0 / kling-3.0-omni / minimax-h3 / wan3.0-video / grok-imagine-video
