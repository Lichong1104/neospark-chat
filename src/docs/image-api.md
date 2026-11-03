# NeoSpark Image Generation API Documentation

> Version: 1.0.0  
> Base URL: `https://api.useneospark.com/api/v1`  
> Swagger UI: `https://api.useneospark.com/docs`

---

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Image Generation Flow](#image-generation-flow)
- [Supported Models and Pricing](#supported-models-and-pricing)
- [API Endpoints Overview](#api-endpoints-overview)
- [API Endpoint Details](#api-endpoint-details)
  - [Get Model Configuration](#get-drawingmodelsconfig)
  - [Upload File](#post-storageupload)
  - [Get User Image List](#get-storageuser-images)
  - [Delete Uploaded Image](#delete-storageuploadupload_id)
  - [Create Drawing Session](#post-drawingsessions)
  - [Get Session List](#get-drawingsessions)
  - [Get Session Details](#get-drawingsessionssession_id)
  - [Generate Image](#post-drawingsessionssession_idgenerate)
  - [Query Generation Status](#get-drawingmessagesmessage_id)
  - [Update Session Title](#put-drawingsessionssession_idtitle)
  - [Delete Session](#delete-drawingsessionssession_id)
  - [Get Billing History](#get-drawingbillinghistory)
  - [Ecommerce Storyboard Generation](#post-drawingecommercestoryboard)
  - [Multi-Reference Batch Generation](#post-drawingsessionssession_idgenerate-multi-ref)
  - [Proxy Download Single Image](#get-drawingdownload)
  - [Batch ZIP Packaged Download](#post-drawingdownload-zip)
- [Test Call Examples](#test-call-examples)

---

## Overview

The image generation module supports two major providers, **Google Gemini** and **Tengda (MagicAPI)**, offering:

- **Text-to-Image**: Generate images from text prompts
- **Image-to-Image**: Edit, transfer styles, and repaint based on reference images
- **Multiple reference images**: Gemini 3 Pro / 3.1 Flash and the entire Tengda model series all support multiple reference images
- **Image download**: Supports single-image proxy download and batch ZIP packaged download

**Supported providers**:
- `gemini` — Google Gemini image generation models
- `tengda` — Tengda (MagicAPI / New API) image generation service, supporting the GPT Image series and Midjourney

---

## Authentication

Image generation endpoints support two authentication methods: **API Key** and **Bearer Token**.

### API Key (Recommended for programmatic access)

API Keys are long-lived and suitable for server-to-server integrations, automation scripts, and similar scenarios.

**Obtaining an API Key**:
1. First complete Google OAuth login in a browser, or call the email verification code login to obtain a session
2. Use the session to call `POST /auth/access-token` to obtain a Bearer Token
3. Use the Bearer Token to call `POST /api-keys` to create an API Key

**Using an API Key**:

Method 1 (recommended): `X-API-Key` request header

```python
import requests

headers = {"X-API-Key": "np_xxxxx"}
resp = requests.get("https://api.useneospark.com/api/v1/drawing/models/config", headers=headers)
print(resp.json())
```

```javascript
const resp = await fetch("https://api.useneospark.com/api/v1/drawing/models/config", {
  headers: { "X-API-Key": "np_xxxxx" }
});
const data = await resp.json();
console.log(data);
```

Method 2: `Authorization` request header

```python
import requests

headers = {"Authorization": "ApiKey np_xxxxx"}
resp = requests.get("https://api.useneospark.com/api/v1/drawing/models/config", headers=headers)
print(resp.json())
```

```javascript
const resp = await fetch("https://api.useneospark.com/api/v1/drawing/models/config", {
  headers: { "Authorization": "ApiKey np_xxxxx" }
});
const data = await resp.json();
console.log(data);
```

### Bearer Token

Suitable for temporary access scenarios:

```python
import requests

headers = {"Authorization": "Bearer YOUR_ACCESS_TOKEN"}
resp = requests.get("https://api.useneospark.com/api/v1/drawing/models/config", headers=headers)
print(resp.json())
```

```javascript
const resp = await fetch("https://api.useneospark.com/api/v1/drawing/models/config", {
  headers: { "Authorization": "Bearer YOUR_ACCESS_TOKEN" }
});
const data = await resp.json();
console.log(data);
```

---

## Image Generation Flow

### Standard Text-to-Image / Image-to-Image

```text
1. 创建绘画会话
   POST /drawing/sessions

2. 提交生成任务
   POST /drawing/sessions/{session_id}/generate

3. 轮询任务状态
   GET /drawing/messages/{message_id}

4. 获取完整会话历史（可选）
   GET /drawing/sessions/{session_id}
```

### Image-to-Image with Reference Images

```text
1. 获取历史图片（可选，直接使用已有图片）
   GET /storage/user-images

2. 上传新参考图片（如需要）
   POST /storage/upload

3. 创建绘画会话
   POST /drawing/sessions

4. 提交图生图任务（带 ref_upload_id / ref_upload_ids / ref_image_paths）
   POST /drawing/sessions/{session_id}/generate

5. 轮询任务状态
   GET /drawing/messages/{message_id}
```

**Reference image source notes**:
- Uploaded images: use `ref_upload_id` or `ref_upload_ids` (values come from the `id` of entries with `type=upload` in `/storage/user-images`)
- Generated images: use `ref_image_paths` (values come from the `url` of entries with `type=generation` in `/storage/user-images`)

---

## Supported Models and Pricing

| Model | Provider | Description | Supported Resolutions | Multi-Image Reference | Price (credits/image) |
|------|--------|------|-----------|---------|---------------|
| `gemini-3-pro-image-preview` | gemini | High-quality generation | 1K, 2K, 4K | Up to 14 | 1K=13, 2K=13, 4K=18 |
| `gemini-3.1-flash-image-preview` | gemini | Latest Flash, supports more resolutions and ratios | 512, 1K, 2K, 4K | Up to 14 | 512=4, 1K=7, 2K=7, 4K=13 |
| `gemini-2.5-flash-image` | gemini | Fast generation, great value | 1K | Single image only | 1K=6 |
| `gpt-image-1-vip` | tengda | GPT Image 1 VIP, high-quality image generation | 512, 1K, 2K, 4K | Supported | 15 |
| `gpt-image-1.5` | tengda | GPT Image 1.5, balanced quality and speed | 512, 1K, 2K, 4K | Supported | 12 |
| `gpt-image-2` | tengda | GPT Image 2, latest image generation model | 512, 1K, 2K, 4K | Supported | 1K_low=4, 1K_medium=7, 1K_high=12 |
| `gpt-image-2.5-flare` | tengda | GPT Image 2.5 Flare, halo-effect image generation | 1K, 2K, 4K | Supported | 1K_low=4, 1K_medium=7, 1K_high=12 |
| `gpt-image-2.5-sunburst` | tengda | GPT Image 2.5 Sunburst, sunburst-composition image generation | 1K, 2K, 4K | Supported | 1K_low=4, 1K_medium=7, 1K_high=12 |
| `midjourney` | tengda | Midjourney, artistic-style image generation | 1K | Supported | 25 |
| `grok-imagine-image-v2.0` | wavespeed | Grok Imagine Image V2.0, xAI's latest image model, supports text-to-image and image editing | 1K, 2K | Single image only | 1K=40, 2K=50 |

**Notes**:
- Prices are read from database configuration at runtime; the table above shows default reference values
- Image-to-image surcharge: 0 for Gemini / Tengda models (`image_to_image_extra = 0`); for WaveSpeed `grok-imagine-image-v2.0`, image editing costs an extra +10 credits/image
- WaveSpeed `grok-imagine-image-v2.0` notes:
  - Accessed via WaveSpeedAI; image editing supports only a single reference image — when multiple are provided, only the first is used
  - Negative prompts are not supported (`negative_prompt` is ignored)
  - `quality` only takes effect for `low` / `medium` (the upstream has no `high` tier; `high` automatically falls back to `medium`) and does not affect pricing
  - Supported aspect ratios: `1:1`, `16:9`, `9:16`, `4:3`, `3:4`
- When `num_images` is the generation count, total cost = unit price × count
- Actual output sizes of Tengda models are determined by the service provider (gpt-image-1/2 series output approximately 1024px, gpt-image-2.5 series output true 1K/2K/4K sizes, Midjourney outputs 1024px)
- `gpt-image-2` supports the `quality` parameter: `low` (low quality, 4 credits) / `medium` (medium quality, 7 credits) / `high` (high quality, 12 credits), default `low`
- `gpt-image-2.5-flare` / `gpt-image-2.5-sunburst` also support the `quality` parameter, with the same pricing as `gpt-image-2`; sizes are output at true 1K/2K/4K resolutions (e.g., 4K 16:9 = 3840x2160, 4K 1:1 = 2880x2880), and support 12 aspect ratios: `1:1`, `4:3`, `3:2`, `2:3`, `16:9`, `9:16`, `3:4`, `4:5`, `5:4`, `21:9`, `2:1`, `1:2` (the last 6 are empirically verified additions, not listed in official documentation)

**Supported resolutions**: `512`, `1K`, `2K`, `3K`, `4K`

**Supported aspect ratios**: `1:1`, `16:9`, `9:16`, `4:3`, `3:4`, `3:2`, `2:3`, `5:4`, `4:5`, `21:9`, `2:1`, `1:2`, `4:1`, `1:4`, `8:1`, `1:8`

---

## Credit Billing Mechanism

Image generation uses **two-stage billing**:

1. **Reserve**: When a task is submitted, the corresponding amount is frozen from available credits based on the estimated cost.
2. **Consume / Release**:
   - Generation succeeds: frozen credits are converted into actual consumption.
   - Generation fails or the task is cancelled: frozen credits are released back to the account in full.

Corresponding transaction types in `GET /drawing/billing/history`:
- `reserve` — frozen when the task is submitted
- `consume` — charged when the task succeeds
- `release` — returned when the task fails/is cancelled

**Ecommerce detail-page nine-grid storyboard** billing occurs in two stages:
- Stage 1 (`type=1`): normal billing based on the selected model and resolution.
- Stage 2 (`generate-batch`): billed at the actual model unit price × 10 images; the fixed 1500 credits are no longer used. If storyboard-to-prompt conversion fails, the entire batch of frozen credits is released.

**Multi-reference batch generation** (`generate-multi-ref`):
- Total cost = single reference-image generation unit price × number of reference images
- Each reference image produces an independent message, whose status can be queried individually.

---

## API Endpoints Overview

| Method | Path | Authentication | Purpose |
|---|---|---|---|
| `GET` | `/drawing/models/config` | Required | Get available model configuration (including prices, resolutions, ratios) |
| `POST` | `/storage/upload` | Required | Upload a file (obtains the upload_id needed for image-to-image) |
| `GET` | `/storage/user-images` | Required | Get all user images (uploaded + generated) |
| `DELETE` | `/storage/upload/{upload_id}` | Required | Delete a specified uploaded image |
| `POST` | `/drawing/sessions` | Required | Create a drawing session |
| `GET` | `/drawing/sessions` | Required | Get the current user's session list |
| `GET` | `/drawing/sessions/{session_id}` | Required | Get full details of a single session (including history messages) |
| `POST` | `/drawing/sessions/{session_id}/generate` | Required | Submit an image generation task (text-to-image/image-to-image) |
| `GET` | `/drawing/messages/{message_id}` | Required | Query the status and result of a single generation message |
| `PUT` | `/drawing/sessions/{session_id}/title` | Required | Update session title |
| `DELETE` | `/drawing/sessions/{session_id}` | Required | Delete a session (soft delete by default) |
| `GET` | `/drawing/billing/history` | Required | Get drawing-related credit transactions |
| `POST` | `/drawing/ecommerce/storyboard` | Required | Generate ecommerce product nine-grid storyboard JSON |
| `POST` | `/drawing/sessions/{session_id}/generate-multi-ref` | Required | Multi-reference batch generation (same prompt + multiple reference images) |
| `GET` | `/drawing/download` | Required | Proxy download of a single image |
| `POST` | `/drawing/download-zip` | Required | Batch package images into a ZIP for download |

---

## API Endpoint Details

---

### GET /drawing/models/config

**Description**: Get the currently available drawing model configuration, including each model's supported resolutions, aspect ratios, and prices.

**Authentication**: Required

**Response example**:
```json
{
  "code": 200,
  "data": {
    "gemini-3.1-flash-image-preview": {
      "name": "Gemini 3.1 Flash Image Preview",
      "provider": "gemini",
      "description": "Latest Flash version, supports more resolutions and ratios",
      "supported_resolutions": [
        {"value": "512", "label": "512 (512px)", "price": 4},
        {"value": "1K", "label": "1K (1024px)", "price": 7},
        {"value": "2K", "label": "2K (2048px)", "price": 7},
        {"value": "4K", "label": "4K (4096px)", "price": 13}
      ],
      "supported_aspect_ratios": [
        {"value": "1:1", "label": "1:1 Square"},
        {"value": "16:9", "label": "16:9 Landscape"}
      ],
      "image_to_image_extra": 0,
      "supports_image_to_image": true
    }
  }
}
```

**Additional response field notes**:
- When a model supports quality selection, an additional `quality_options` field is returned, for example:
  ```json
  "quality_options": [
    {"resolution": "1K", "quality": "low", "price": 4},
    {"resolution": "1K", "quality": "medium", "price": 7},
    {"resolution": "1K", "quality": "high", "price": 12}
  ]
  ```
- The frontend can decide whether to show a quality (HD / STD) selector based on whether `quality_options` exists

---

### POST /storage/upload

**Description**: Upload a file to obtain the `upload_id` and `url` needed for image-to-image. Supports images, videos, and other types.

**Authentication**: Required

**Request body**: `multipart/form-data`
- `file`: file content
- `file_type`: file type, `image` / `video` / `other`

**Response example**:
```json
{
  "code": 200,
  "data": {
    "upload_id": "upload_abc123",
    "url": "/uploads/3/images/2026/04/23/photo_xxx.jpg",
    "path": "uploads/3/images/2026/04/23/photo_xxx.jpg",
    "filename": "photo_xxx.jpg",
    "size": 245678
  }
}
```

**Response field descriptions**:
- `upload_id`: upload record ID, referenced via `ref_upload_id` or `ref_upload_ids` in image-to-image
- `url`: file access path
- `path`: local storage path
- `filename`: file name
- `size`: file size (bytes)

---

### GET /storage/user-images

**Description**: Get all images of the current user, including uploaded images and generated images. Used to directly select historical images as reference images for image-to-image without re-uploading.

**Authentication**: Required

**Query parameters**:
- `source`: optional, filter by source (`upload` / `generation`)
- `limit`: items per page, default `20`, maximum `100`
- `offset`: offset, default `0`

**Response field descriptions**:
- `id`: image ID. `upload` type is `upload_id` (can be used for `ref_upload_ids`); `generation` type is `{message_id}_{idx}`
- `type`: image source type
  - `upload`: user-uploaded image (can be used for `ref_upload_ids`)
  - `generation`: system-generated image (can be used for `ref_image_paths`)
- `filename`: file name
- `path`: local storage path
- `url`: access path
- `size`: file size (bytes)
- `prompt`: generation prompt (only present for `generation` type)
- `model`: generation model (only present for `generation` type)
- `created_at`: creation time
- `session_info`: associated session information

**Response example**:
```json
{
  "code": 200,
  "data": {
    "total": 3,
    "offset": 0,
    "limit": 20,
    "images": [
      {
        "id": "up_abcd1234efgh5678",
        "type": "upload",
        "filename": "product.jpg",
        "path": "uploads/3/images/2026/04/23/product.jpg",
        "url": "/uploads/3/images/2026/04/23/product.jpg",
        "size": 245678,
        "created_at": "2026-04-23T10:00:00",
        "session_info": null
      },
      {
        "id": "dm_xxx_assistant_0",
        "type": "generation",
        "filename": "generated_0.png",
        "path": "uploads/3/images/2026/04/23/generated_0.png",
        "url": "/uploads/3/images/2026/04/23/generated_0.png",
        "size": 156000,
        "prompt": "一只可爱的猫咪",
        "model": "gemini-3.1-flash-image-preview",
        "created_at": "2026-04-23T10:32:15",
        "session_info": {
          "session_id": "ds_a1b2c3d4e5f6",
          "session_status": "active",
          "session_exists": true
        }
      }
    ]
  }
}
```

**Usage**:
- For `upload` type images: take the `id` field as the value for `ref_upload_ids`
- For `generation` type images: take the `url` field as the value for `ref_image_paths`

---

### DELETE /storage/upload/{upload_id}

**Description**: Delete a specified uploaded image. If the image is already in use (e.g., as an image-to-image reference), it is only marked as deleted and the physical file is not removed.

**Authentication**: Required

**Path parameters**:
- `upload_id`: uploaded file ID

**Query parameters**:
- `permanent`: whether to permanently delete, default `false` (soft delete)

**Response example (not in use)**:
```json
{
  "code": 200,
  "message": "Deleted successfully",
  "upload_id": "up_abcd1234efgh5678"
}
```

**Response example (in use)**:
```json
{
  "code": 200,
  "message": "File is in use and has been marked as deleted; physical file retained",
  "use_count": 2
}
```

---

### POST /drawing/sessions

**Description**: Create a new drawing session. Subsequent steps in the same creation chain should reuse the same `session_id`.

**Authentication**: Required

**Request headers**:
- `Content-Type: application/json`

**Request body**:
```json
{
  "title": "我的创作"
}
```

**Request field descriptions**:
- `title`: optional, session title. If omitted, the backend auto-generates one in the format `Drawing Session MM/DD HH:MM`

**Response example**:
```json
{
  "code": 200,
  "data": {
    "session_id": "ds_a1b2c3d4e5f6",
    "title": "我的创作",
    "created_at": "2026-04-23T10:30:00"
  }
}
```

---

### GET /drawing/sessions

**Description**: Get the current user's drawing session list.

**Authentication**: Required

**Query parameters**:
- `status`: optional, filter by status (`active` / `completed`)
- `limit`: items per page, default `20`, maximum `100`
- `offset`: offset, default `0`

**Response example**:
```json
{
  "code": 200,
  "data": [
    {
      "session_id": "ds_a1b2c3d4e5f6",
      "title": "我的创作",
      "status": "active",
      "total_generations": 3,
      "total_cost": 27,
      "last_message_at": "2026-04-23T10:35:00",
      "created_at": "2026-04-23T10:30:00"
    }
  ]
}
```

---

### GET /drawing/sessions/{session_id}

**Description**: Get full details of a single drawing session, including basic session information and all history messages.

**Authentication**: Required

**Path parameters**:
- `session_id`: session ID

**Response example**:
```json
{
  "code": 200,
  "data": {
    "session_id": "ds_a1b2c3d4e5f6",
    "title": "我的创作",
    "status": "active",
    "total_generations": 1,
    "total_cost": 7,
    "messages": [
      {
        "message_id": "dm_xxx_user",
        "role": "user",
        "sequence": 1,
        "content": "一只可爱的猫咪",
        "model": null,
        "resolution": null,
        "aspect_ratio": null,
        "status": null,
        "images": null,
        "actual_cost": null,
        "created_at": "2026-04-23T10:30:00",
        "completed_at": null
      },
      {
        "message_id": "dm_xxx_assistant",
        "role": "assistant",
        "sequence": 2,
        "content": "一只可爱的猫咪",
        "model": "gemini-3.1-flash-image-preview",
        "resolution": "1K",
        "aspect_ratio": "1:1",
        "status": "completed",
        "images": [
          {"url": "/uploads/3/images/2026/04/23/generated_0.png", "local_path": "uploads/3/images/2026/04/23/generated_0.png"}
        ],
        "actual_cost": 7,
        "created_at": "2026-04-23T10:30:01",
        "completed_at": "2026-04-23T10:32:15"
      }
    ],
    "created_at": "2026-04-23T10:30:00",
    "updated_at": "2026-04-23T10:32:15"
  }
}
```

---

### POST /drawing/sessions/{session_id}/generate

**Description**: Submit an image generation task in the specified session. Supports text-to-image and image-to-image (single/multiple reference images).

**Authentication**: Required

**Request headers**:
- `Content-Type: application/json`

**Request body example - Standard text-to-image**:
```json
{
  "prompt": "一只可爱的猫咪，坐在窗台上，阳光照射，治愈系插画风格",
  "model": "gemini-3.1-flash-image-preview",
  "resolution": "1K",
  "aspect_ratio": "1:1",
  "negative_prompt": "模糊, 低质量, 变形",
  "num_images": 1,
  "provider": "gemini",
  "optimize_prompt": true
}
```

**Request body example - Image-to-image (single reference image, upload ID)**:
```json
{
  "prompt": "保留主体和构图，只把背景改成高级感浅灰渐变背景",
  "model": "gemini-3.1-flash-image-preview",
  "resolution": "1K",
  "aspect_ratio": "1:1",
  "negative_prompt": "",
  "num_images": 1,
  "provider": "gemini",
  "optimize_prompt": true,
  "ref_upload_id": "up_abcd1234efgh5678",
  "strength": 0.7
}
```

**Request body example - Image-to-image (multiple reference images, supported by Gemini 3 Pro / 3.1 Flash and Tengda)**:
```json
{
  "prompt": "融合这些图片的风格和元素，生成一张新的产品主图",
  "model": "gemini-3-pro-image-preview",
  "resolution": "1K",
  "aspect_ratio": "1:1",
  "negative_prompt": "",
  "num_images": 1,
  "provider": "gemini",
  "optimize_prompt": true,
  "ref_upload_ids": ["up_abc123", "up_def456", "up_ghi789"],
  "strength": 0.7
}
```

**Request body example - Text-to-image (Tengda GPT Image)**:
```json
{
  "prompt": "一只可爱的猫咪，坐在窗台上，阳光照射，治愈系插画风格",
  "model": "gpt-image-2",
  "resolution": "1K",
  "aspect_ratio": "16:9",
  "negative_prompt": "模糊, 低质量, 变形",
  "num_images": 1,
  "provider": "tengda",
  "quality": "low",
  "optimize_prompt": true
}
```

**Request body example - Text-to-image (Tengda Midjourney)**:
```json
{
  "prompt": "A cute cat sitting on a windowsill, sunlight streaming in, healing illustration style --ar 16:9",
  "model": "midjourney",
  "resolution": "1K",
  "aspect_ratio": "16:9",
  "negative_prompt": "",
  "num_images": 1,
  "provider": "tengda",
  "optimize_prompt": true
}
```

**Request body example - Image-to-image (multiple previously generated image paths as references)**:
```json
{
  "prompt": "融合这三张图的风格元素，生成一张新的产品主图",
  "model": "gemini-3-pro-image-preview",
  "resolution": "1K",
  "aspect_ratio": "1:1",
  "negative_prompt": "",
  "num_images": 1,
  "provider": "gemini",
  "ref_image_paths": [
    "/uploads/3/images/2026/04/23/result_a.png",
    "/uploads/3/images/2026/04/23/result_b.png",
    "/uploads/3/images/2026/04/23/result_c.png"
  ],
  "strength": 0.7
}
```

**Parameter descriptions**:

| Parameter | Type | Required | Description |
|------|------|------|------|
| `prompt` | string | ✅ | Prompt describing the desired image content |
| `model` | string | ✅ | Model ID, e.g. `gemini-3.1-flash-image-preview` |
| `resolution` | string | ✅ | Resolution: `512` / `1K` / `2K` / `3K` / `4K` |
| `aspect_ratio` | string | ✅ | Aspect ratio: `1:1` / `16:9` / `9:16` / `4:3` / `3:4`, etc. |
| `negative_prompt` | string | ❌ | Negative prompt, default empty string |
| `num_images` | integer | ❌ | Number of images to generate, range 1-4, default `1`. In ecommerce nine-grid mode (`type=1`), the backend forces this to `1` |
| `ref_image_path` | string | ❌ | [Single, backward compatible] Reference image path, e.g. `/uploads/...` |
| `ref_upload_id` | string | ❌ | [Single, backward compatible] Reference image upload ID, from `/storage/upload`. Required in ecommerce nine-grid mode (`type=1`) |
| `ref_upload_ids` | string[] | ❌ | [Multiple] List of reference image upload IDs, up to 14 |
| `ref_image_paths` | string[] | ❌ | [Multiple] List of reference image paths; mutually exclusive with `ref_upload_ids`, up to 14 |
| `strength` | float | ❌ | Reference image strength, range `0.0-1.0`, default `0.7`. Ignored for text-to-image (no reference image) |
| `provider` | string | ❌ | Provider, supports `gemini`, `tengda`, `wavespeed`, default `gemini` |
| `quality` | string | ❌ | Quality: `low` / `medium` / `high`. Supported by Tengda `gpt-image-2` series; WaveSpeed `grok-imagine-image-v2.0` only supports `low`/`medium` (`high` automatically falls back to `medium`). Default `low` |
| `optimize_prompt` | boolean | ❌ | Whether to optimize the prompt, default `true` |
| `type` | integer | ❌ | Generation type. Omit for normal generation; `1` means stage 1 of the ecommerce detail-page nine-grid. Currently only `1` is supported |

**Important constraints**:
- **The four reference image parameters are mutually exclusive**: only one of `ref_image_path`, `ref_upload_id`, `ref_upload_ids`, `ref_image_paths` may be used
- Single reference image: use `ref_upload_id` or `ref_image_path`
- Multiple reference images: use `ref_upload_ids` or `ref_image_paths`; **supported by `gemini-3-pro-image-preview`, `gemini-3.1-flash-image-preview`, and the entire Tengda series**, up to 14
- `gemini-2.5-flash-image` only supports a single reference image
- WaveSpeed `grok-imagine-image-v2.0` image editing only supports a single reference image; when multiple are provided, only the first is used

**Response example**:
```json
{
  "code": 200,
  "data": {
    "message_id": "dm_a1b2c3d4e5_assistant",
    "status": "pending",
    "estimated_cost": 7,
    "created_at": "2026-04-23T10:30:00"
  }
}
```

**Error response example (insufficient balance)**:
```json
{
  "code": 402,
  "message": "积分不足，请充值后再试",
  "data": null
}
```

**Error response example (reference image parameter conflict)**:
```json
{
  "detail": "Only one of ref_image_path/ref_upload_id, ref_upload_ids, or ref_image_paths can be used"
}
```

**Common status codes**:
- `200`: task created successfully
- `400`: parameter error, reference image parameter conflict, unsupported model, ecommerce mode missing reference image
- `402`: insufficient credits
- `403`: user restricted from generating images (admin can set `can_generate_image=false`)
- `404`: session does not exist, reference image upload record does not exist
- `409`: duplicate submission (the same batch of multi-reference batch generation already exists)
- `500`: model pricing configuration error (`DrawingPricingConfigError`)

---

### GET /drawing/messages/{message_id}

**Description**: Query the status and result of a single generation message. The frontend polls this endpoint to get generation progress.

**Authentication**: Required

**Path parameters**:
- `message_id`: message ID

**Response field descriptions**:
- `message_id`: message ID
- `status`: status, `pending` / `generating` / `completed` / `failed`
- `sequence`: the message's sequence number within the session
- `images`: list of generated images (only present when `completed`)
  - `url`: image access path
  - `local_path`: local storage path
- `actual_cost`: actual credits consumed (only present after completion)
- `generation_time`: generation time taken (milliseconds)
- `error_msg`: error message (only present when `failed`)
- `created_at`: creation time
- `completed_at`: completion time

**Response example (in progress)**:
```json
{
  "code": 200,
  "data": {
    "message_id": "dm_a1b2c3d4e5_assistant",
    "status": "generating",
    "sequence": 2,
    "images": null,
    "actual_cost": null,
    "generation_time": null,
    "error_msg": null,
    "created_at": "2026-04-23T10:30:00",
    "completed_at": null
  }
}
```

**Response example (completed)**:
```json
{
  "code": 200,
  "data": {
    "message_id": "dm_a1b2c3d4e5_assistant",
    "status": "completed",
    "sequence": 2,
    "images": [
      {
        "url": "/uploads/3/images/2026/04/23/generated_0.png",
        "local_path": "uploads/3/images/2026/04/23/generated_0.png"
      }
    ],
    "actual_cost": 7,
    "generation_time": 12500,
    "error_msg": null,
    "created_at": "2026-04-23T10:30:00",
    "completed_at": "2026-04-23T10:32:15"
  }
}
```

**Response example (failed)**:
```json
{
  "code": 200,
  "data": {
    "message_id": "dm_a1b2c3d4e5_assistant",
    "status": "failed",
    "sequence": 2,
    "images": null,
    "actual_cost": null,
    "generation_time": null,
    "error_msg": "Generation failed",
    "created_at": "2026-04-23T10:30:00",
    "completed_at": "2026-04-23T10:31:00"
  }
}
```

---

### PUT /drawing/sessions/{session_id}/title

**Description**: Update the session title.

**Authentication**: Required

**Request headers**:
- `Content-Type: application/json`

**Request body**:
```json
{
  "title": "新的会话标题"
}
```

**Response example**:
```json
{
  "code": 200,
  "message": "Title updated successfully"
}
```

---

### DELETE /drawing/sessions/{session_id}

**Description**: Delete a drawing session.

**Authentication**: Required

**Query parameters**:
- `permanent`: whether to permanently delete, default `false` (soft delete, marked as `deleted`)

**Response example (soft delete)**:
```json
{
  "code": 200,
  "message": "Session deleted",
  "status": "deleted"
}
```

**Response example (permanent delete)**:
```json
{
  "code": 200,
  "message": "Session permanently deleted"
}
```

---

### GET /drawing/billing/history

**Description**: Get drawing-related credit balance transaction history.

**Authentication**: Required

**Query parameters**:
- `type`: optional, filter by type: `grant` / `reserve` / `consume` / `release` / `adjust` / `expire`
- `limit`: items per page, default `20`, maximum `100`
- `offset`: offset, default `0`

**Response field descriptions**:
- `total`: number of transactions returned this time
- `offset`: current offset
- `limit`: current page size
- `transactions`: transaction list
  - `id`: transaction ID
  - `type`: event type
  - `type_name`: Chinese name (入账/冻结/消费/释放/调整/过期)
  - `points`: credits changed in this transaction
  - `total_points_after`: total credits after the change
  - `frozen_points_after`: frozen credits after the change
  - `biz_type`: business type, e.g. `drawing` / `video_generation`
  - `biz_id`: business object ID
  - `description`: remark/description
  - `created_at`: creation time

**Response example**:
```json
{
  "code": 200,
  "data": {
    "total": 2,
    "offset": 0,
    "limit": 20,
    "transactions": [
      {
        "id": 101,
        "type": "reserve",
        "type_name": "Reserve",
        "points": -7,
        "total_points_after": 99993,
        "frozen_points_after": 7,
        "idempotency_key": "draw:dm_a1b2c3d4e5_assistant",
        "biz_type": "text_to_image",
        "biz_id": "dm_a1b2c3d4e5_assistant",
        "description": "",
        "created_at": "2026-04-23T10:30:00"
      },
      {
        "id": 102,
        "type": "consume",
        "type_name": "Consume",
        "points": -7,
        "total_points_after": 99993,
        "frozen_points_after": 0,
        "idempotency_key": "draw:dm_a1b2c3d4e5_assistant",
        "biz_type": "text_to_image",
        "biz_id": "dm_a1b2c3d4e5_assistant",
        "description": "",
        "created_at": "2026-04-23T10:32:15"
      }
    ]
  }
}
```

---

### GET /drawing/download

**Description**: Proxy download of a single image. Supports external URLs and local uploads paths; the backend uniformly returns the file and sets the attachment header, solving frontend cross-origin download issues.

**Authentication**: Required

**Query parameters**:
- `url`: image URL or local path (required)
- `name`: download file name (optional)

**Python example**:
```python
import requests

resp = requests.get(
    f"{BASE_URL}/drawing/download?url=/uploads/3/images/2026/04/23/generated_0.png&name=cat.png",
    headers=HEADERS
)
with open("cat.png", "wb") as f:
    f.write(resp.content)
```

---

### POST /drawing/download-zip

**Description**: Batch package images into a ZIP for download. The backend fetches all image URLs concurrently, packages them into a ZIP, and streams it back, replacing frontend JSZip.

**Authentication**: Required

**Request headers**:
- `Content-Type: application/json`

**Request body**:
```json
{
  "urls": [
    "/uploads/3/images/2026/04/23/generated_0.png",
    "/uploads/3/images/2026/04/23/generated_1.png"
  ],
  "filename": "my_images"
}
```

**Python example**:
```python
import requests

resp = requests.post(
    f"{BASE_URL}/drawing/download-zip",
    headers={**HEADERS, "Content-Type": "application/json"},
    json={
        "urls": ["/uploads/3/images/2026/04/23/generated_0.png"],
        "filename": "my_images"
    }
)
with open("my_images.zip", "wb") as f:
    f.write(resp.content)
```

---

### POST /drawing/ecommerce/storyboard

**Description**: Generate storyboard JSON for an ecommerce product nine-grid promotional image. This endpoint is a standalone tool endpoint; it does not create drawing messages. The returned structured storyboard data can be used as a prompt reference in the stage-1 `type=1` generation.

**Authentication**: Required

**Request headers**:
- `Content-Type: application/json`

**Request body**:
```json
{
  "prompt": "为这款洗面奶生成电商详情页九宫格分镜，要求干净高级、适合美妆护肤品详情页。"
}
```

**Response example**:
```json
{
  "code": 200,
  "data": {
    "model": "gemini-3.1-flash-image-preview",
    "storyboard": {
      "panels": [
        {"panel_type": "Key Visual (KV)", "description": "..."},
        {"panel_type": "Feature Focus", "description": "..."}
      ]
    }
  }
}
```

---

### POST /drawing/sessions/{session_id}/generate-multi-ref

**Description**: Multi-reference batch generation. Provide multiple reference images and one prompt; generation runs in parallel with the same prompt for each reference image. Each reference image produces an independent assistant message, whose status can be polled individually.

**Authentication**: Required

**Request headers**:
- `Content-Type: application/json`

**Request body example**:
```json
{
  "prompt": "保留产品主体，只调整布光和背景氛围",
  "model": "gemini-3.1-flash-image-preview",
  "resolution": "1K",
  "aspect_ratio": "1:1",
  "negative_prompt": "",
  "ref_upload_ids": ["up_abc123", "up_def456", "up_ghi789"],
  "strength": 0.7,
  "provider": "gemini",
  "concurrency": 5
}
```

**Parameter descriptions**:

| Parameter | Type | Required | Description |
|------|------|------|------|
| `prompt` | string | ✅ | Prompt, shared by all reference images |
| `model` | string | ✅ | Model ID |
| `resolution` | string | ✅ | Resolution |
| `aspect_ratio` | string | ✅ | Aspect ratio |
| `negative_prompt` | string | ❌ | Negative prompt |
| `ref_upload_ids` | string[] | ✅ (choose one with `ref_image_paths`) | List of reference image upload IDs, at least 1, up to 14 |
| `ref_image_paths` | string[] | ✅ (choose one with `ref_upload_ids`) | List of reference image paths, at least 1, up to 14 |
| `strength` | float | ❌ | Reference image strength, default `0.7` |
| `quality` | string | ❌ | Quality, only takes effect for Tengda `gpt-image-2` |
| `provider` | string | ❌ | Provider, default `gemini` |
| `concurrency` | integer | ❌ | Parallel generation concurrency, range 1-20, default `5` |

**Important constraints**:
- Choose exactly one of `ref_upload_ids` and `ref_image_paths`; they cannot be passed together
- Provide at least 1 reference image
- Up to 14 reference images

**Response example**:
```json
{
  "code": 200,
  "data": {
    "message_ids": ["dm_xxx_assistant_1", "dm_xxx_assistant_2", "dm_xxx_assistant_3"],
    "total_estimated_cost": 21,
    "ref_count": 3,
    "created_at": "2026-04-23T10:30:00"
  }
}
```

**Error codes**:
- `400`: no reference image provided, both reference image parameter types provided, or maximum count exceeded
- `402`: insufficient credits
- `403`: user restricted from generating
- `404`: session does not exist, reference image upload record does not exist
- `409`: the same batch has already been submitted (idempotent)

---

## Test Call Examples

The following examples provide both **Python** and **JavaScript** calling methods.

### Environment Setup

```python
BASE_URL = "https://api.useneospark.com/api/v1"
HEADERS = {"X-API-Key": "np_xxxxxxxxxxxxxxxx"}
```

```javascript
const BASE_URL = "https://api.useneospark.com/api/v1";
const HEADERS = { "X-API-Key": "np_xxxxxxxxxxxxxxxx" };
```

### Scenario 1: Upload a Reference Image

```python
import requests

url = f"{BASE_URL}/storage/upload"
with open("/path/to/your/image.jpg", "rb") as f:
    files = {"file": ("image.jpg", f, "image/jpeg")}
    data = {"file_type": "image"}
    resp = requests.post(url, headers=HEADERS, files=files, data=data)
    print(resp.json())
```

```javascript
const form = new FormData();
form.append("file", fileInput.files[0]);
form.append("file_type", "image");

const resp = await fetch(`${BASE_URL}/storage/upload`, {
  method: "POST",
  headers: HEADERS,
  body: form
});
const data = await resp.json();
console.log(data);
```

**Response example**:
```json
{
  "code": 200,
  "data": {
    "upload_id": "up_abcd1234efgh5678",
    "url": "/uploads/3/images/2026/04/23/photo_xxx.jpg",
    "path": "uploads/3/images/2026/04/23/photo_xxx.jpg",
    "filename": "photo_xxx.jpg",
    "size": 245678
  }
}
```

### Scenario 2: Text-to-Image

**Step 1: Create a session**

```python
import requests

url = f"{BASE_URL}/drawing/sessions"
payload = {"title": "文生图测试"}
resp = requests.post(url, headers={**HEADERS, "Content-Type": "application/json"}, json=payload)
session_id = resp.json()["data"]["session_id"]
print("Session ID:", session_id)
```

```javascript
const resp = await fetch(`${BASE_URL}/drawing/sessions`, {
  method: "POST",
  headers: { ...HEADERS, "Content-Type": "application/json" },
  body: JSON.stringify({ title: "文生图测试" })
});
const data = await resp.json();
const session_id = data.data.session_id;
console.log("Session ID:", session_id);
```

**Response example**:
```json
{
  "code": 200,
  "data": {
    "session_id": "ds_a1b2c3d4e5f6",
    "title": "文生图测试",
    "created_at": "2026-04-23T10:30:00"
  }
}
```

**Step 2: Submit a text-to-image task**

```python
url = f"{BASE_URL}/drawing/sessions/{session_id}/generate"
payload = {
    "prompt": "一只可爱的猫咪，坐在窗台上，阳光照射，治愈系插画风格",
    "model": "gemini-3.1-flash-image-preview",
    "resolution": "1K",
    "aspect_ratio": "1:1",
    "negative_prompt": "模糊, 低质量, 变形",
    "num_images": 1,
    "provider": "gemini",
    "optimize_prompt": True
}
resp = requests.post(url, headers={**HEADERS, "Content-Type": "application/json"}, json=payload)
message_id = resp.json()["data"]["message_id"]
print("Message ID:", message_id)
```

```javascript
const resp = await fetch(`${BASE_URL}/drawing/sessions/${session_id}/generate`, {
  method: "POST",
  headers: { ...HEADERS, "Content-Type": "application/json" },
  body: JSON.stringify({
    prompt: "一只可爱的猫咪，坐在窗台上，阳光照射，治愈系插画风格",
    model: "gemini-3.1-flash-image-preview",
    resolution: "1K",
    aspect_ratio: "1:1",
    negative_prompt: "模糊, 低质量, 变形",
    num_images: 1,
    provider: "gemini",
    optimize_prompt: true
  })
});
const data = await resp.json();
const message_id = data.data.message_id;
console.log("Message ID:", message_id);
```

**Response example**:
```json
{
  "code": 200,
  "data": {
    "message_id": "dm_a1b2c3d4e5_assistant",
    "status": "pending",
    "estimated_cost": 7,
    "created_at": "2026-04-23T10:30:00"
  }
}
```

**Step 3: Poll status**

```python
import time

url = f"{BASE_URL}/drawing/messages/{message_id}"
while True:
    resp = requests.get(url, headers=HEADERS)
    result = resp.json()["data"]
    print(f"Status: {result['status']}")
    if result["status"] in ("completed", "failed"):
        print(result)
        break
    time.sleep(3)
```

```javascript
const poll = async () => {
  while (true) {
    const resp = await fetch(`${BASE_URL}/drawing/messages/${message_id}`, { headers: HEADERS });
    const result = (await resp.json()).data;
    console.log("Status:", result.status);
    if (result.status === "completed" || result.status === "failed") {
      console.log(result);
      break;
    }
    await new Promise(r => setTimeout(r, 3000));
  }
};
poll();
```

**Response example (completed)**:
```json
{
  "code": 200,
  "data": {
    "message_id": "dm_a1b2c3d4e5_assistant",
    "status": "completed",
    "sequence": 2,
    "images": [
      {
        "url": "/uploads/3/images/2026/04/23/generated_0.png",
        "local_path": "uploads/3/images/2026/04/23/generated_0.png"
      }
    ],
    "actual_cost": 7,
    "generation_time": 12500,
    "created_at": "2026-04-23T10:30:00",
    "completed_at": "2026-04-23T10:32:15"
  }
}
```

### Scenario 3: Image-to-Image (Single Reference Image)

```python
import requests

# 方式一：使用已上传图片的 upload_id（可从 /storage/user-images 列表获取）
# 方式二：先调用 /storage/upload 上传新图片获取 upload_id

session_resp = requests.post(
    f"{BASE_URL}/drawing/sessions",
    headers={**HEADERS, "Content-Type": "application/json"},
    json={"title": "图生图测试"}
)
session_id = session_resp.json()["data"]["session_id"]

resp = requests.post(
    f"{BASE_URL}/drawing/sessions/{session_id}/generate",
    headers={**HEADERS, "Content-Type": "application/json"},
    json={
        "prompt": "保留主体和构图，只把背景改成高级感浅灰渐变背景",
        "model": "gemini-3.1-flash-image-preview",
        "resolution": "1K",
        "aspect_ratio": "1:1",
        "num_images": 1,
        "provider": "gemini",
        "ref_upload_id": "up_xxx",
        "strength": 0.7
    }
)
print(resp.json())
```

```javascript
const sessionResp = await fetch(`${BASE_URL}/drawing/sessions`, {
  method: "POST",
  headers: { ...HEADERS, "Content-Type": "application/json" },
  body: JSON.stringify({ title: "图生图测试" })
});
const session_id = (await sessionResp.json()).data.session_id;

const resp = await fetch(`${BASE_URL}/drawing/sessions/${session_id}/generate`, {
  method: "POST",
  headers: { ...HEADERS, "Content-Type": "application/json" },
  body: JSON.stringify({
    prompt: "保留主体和构图，只把背景改成高级感浅灰渐变背景",
    model: "gemini-3.1-flash-image-preview",
    resolution: "1K",
    aspect_ratio: "1:1",
    num_images: 1,
    provider: "gemini",
    ref_upload_id: "up_xxx",
    strength: 0.7
  })
});
const data = await resp.json();
console.log(data);
```

**Response example**:
```json
{
  "code": 200,
  "data": {
    "message_id": "dm_a1b2c3d4e5_assistant",
    "status": "pending",
    "estimated_cost": 7,
    "created_at": "2026-04-23T10:30:00"
  }
}
```

### Scenario 4: Image-to-Image (Using a Previously Generated Image as Reference)

```python
import requests

# 1. 先获取图片列表，找到历史生成图片的 url
# 2. 使用 ref_image_paths 引用历史生成图片

session_resp = requests.post(
    f"{BASE_URL}/drawing/sessions",
    headers={**HEADERS, "Content-Type": "application/json"},
    json={"title": "历史图片参考测试"}
)
session_id = session_resp.json()["data"]["session_id"]

resp = requests.post(
    f"{BASE_URL}/drawing/sessions/{session_id}/generate",
    headers={**HEADERS, "Content-Type": "application/json"},
    json={
        "prompt": "在这张图的基础上添加星空背景",
        "model": "gemini-3.1-flash-image-preview",
        "resolution": "1K",
        "aspect_ratio": "1:1",
        "num_images": 1,
        "provider": "gemini",
        "ref_image_paths": ["/uploads/3/images/2026/04/23/generated_0.png"],
        "strength": 0.7
    }
)
print(resp.json())
```

```javascript
const sessionResp = await fetch(`${BASE_URL}/drawing/sessions`, {
  method: "POST",
  headers: { ...HEADERS, "Content-Type": "application/json" },
  body: JSON.stringify({ title: "历史图片参考测试" })
});
const session_id = (await sessionResp.json()).data.session_id;

const resp = await fetch(`${BASE_URL}/drawing/sessions/${session_id}/generate`, {
  method: "POST",
  headers: { ...HEADERS, "Content-Type": "application/json" },
  body: JSON.stringify({
    prompt: "在这张图的基础上添加星空背景",
    model: "gemini-3.1-flash-image-preview",
    resolution: "1K",
    aspect_ratio: "1:1",
    num_images: 1,
    provider: "gemini",
    ref_image_paths: ["/uploads/3/images/2026/04/23/generated_0.png"],
    strength: 0.7
  })
});
const data = await resp.json();
console.log(data);
```

**Response example**:
```json
{
  "code": 200,
  "data": {
    "message_id": "dm_a1b2c3d4e5_assistant",
    "status": "pending",
    "estimated_cost": 7,
    "created_at": "2026-04-23T10:30:00"
  }
}
```

### Scenario 5: Image-to-Image (Multiple Reference Images, Gemini 3 Pro / 3.1 Flash and Tengda)

```python
import requests

# 可从 /storage/user-images 获取 upload 类型的 id 作为 ref_upload_ids

session_resp = requests.post(
    f"{BASE_URL}/drawing/sessions",
    headers={**HEADERS, "Content-Type": "application/json"},
    json={"title": "多图参考测试"}
)
session_id = session_resp.json()["data"]["session_id"]

resp = requests.post(
    f"{BASE_URL}/drawing/sessions/{session_id}/generate",
    headers={**HEADERS, "Content-Type": "application/json"},
    json={
        "prompt": "融合这些图片的风格和元素，生成一张新的产品主图",
        "model": "gemini-3-pro-image-preview",
        "resolution": "1K",
        "aspect_ratio": "1:1",
        "num_images": 1,
        "provider": "gemini",
        "ref_upload_ids": ["up_abc123", "up_def456", "up_ghi789"],
        "strength": 0.7
    }
)
print(resp.json())
```

```javascript
const sessionResp = await fetch(`${BASE_URL}/drawing/sessions`, {
  method: "POST",
  headers: { ...HEADERS, "Content-Type": "application/json" },
  body: JSON.stringify({ title: "多图参考测试" })
});
const session_id = (await sessionResp.json()).data.session_id;

const resp = await fetch(`${BASE_URL}/drawing/sessions/${session_id}/generate`, {
  method: "POST",
  headers: { ...HEADERS, "Content-Type": "application/json" },
  body: JSON.stringify({
    prompt: "融合这些图片的风格和元素，生成一张新的产品主图",
    model: "gemini-3-pro-image-preview",
    resolution: "1K",
    aspect_ratio: "1:1",
    num_images: 1,
    provider: "gemini",
    ref_upload_ids: ["up_abc123", "up_def456", "up_ghi789"],
    strength: 0.7
  })
});
const data = await resp.json();
console.log(data);
```

**Response example**:
```json
{
  "code": 200,
  "data": {
    "message_id": "dm_a1b2c3d4e5_assistant",
    "status": "pending",
    "estimated_cost": 7,
    "created_at": "2026-04-23T10:30:00"
  }
}
```

---

### Scenario 6: Get Image List and Delete Images

**Get all user images**

```python
import requests

# 全部图片
resp = requests.get(f"{BASE_URL}/storage/user-images?limit=20", headers=HEADERS)
print(resp.json())

# 仅上传的图片
resp = requests.get(f"{BASE_URL}/storage/user-images?source=upload&limit=20", headers=HEADERS)
print(resp.json())

# 仅生成的图片
resp = requests.get(f"{BASE_URL}/storage/user-images?source=generation&limit=20", headers=HEADERS)
print(resp.json())
```

```javascript
// 全部图片
const resp = await fetch(`${BASE_URL}/storage/user-images?limit=20`, { headers: HEADERS });
console.log(await resp.json());

// 仅上传的图片
const resp2 = await fetch(`${BASE_URL}/storage/user-images?source=upload&limit=20`, { headers: HEADERS });
console.log(await resp2.json());

// 仅生成的图片
const resp3 = await fetch(`${BASE_URL}/storage/user-images?source=generation&limit=20`, { headers: HEADERS });
console.log(await resp3.json());
```

**Response example**:
```json
{
  "code": 200,
  "data": {
    "total": 3,
    "offset": 0,
    "limit": 20,
    "images": [
      {
        "id": "up_abcd1234efgh5678",
        "type": "upload",
        "filename": "product.jpg",
        "url": "/uploads/3/images/2026/04/23/product.jpg",
        "size": 245678,
        "created_at": "2026-04-23T10:00:00",
        "session_info": null
      },
      {
        "id": "dm_xxx_assistant_0",
        "type": "generation",
        "filename": "generated_0.png",
        "url": "/uploads/3/images/2026/04/23/generated_0.png",
        "size": 156000,
        "prompt": "一只可爱的猫咪",
        "model": "gemini-3.1-flash-image-preview",
        "created_at": "2026-04-23T10:32:15",
        "session_info": {
          "session_id": "ds_a1b2c3d4e5f6",
          "session_status": "active",
          "session_exists": true
        }
      }
    ]
  }
}
```

**Delete a specified uploaded image**

```python
import requests

# 软删除
resp = requests.delete(f"{BASE_URL}/storage/upload/up_xxx", headers=HEADERS)
print(resp.json())

# 永久删除
resp = requests.delete(f"{BASE_URL}/storage/upload/up_xxx?permanent=true", headers=HEADERS)
print(resp.json())
```

```javascript
// 软删除
const resp = await fetch(`${BASE_URL}/storage/upload/up_xxx`, {
  method: "DELETE",
  headers: HEADERS
});
console.log(await resp.json());

// 永久删除
const resp2 = await fetch(`${BASE_URL}/storage/upload/up_xxx?permanent=true`, {
  method: "DELETE",
  headers: HEADERS
});
console.log(await resp2.json());
```

**Response example (soft delete, not in use)**:
```json
{
  "code": 200,
  "message": "Deleted successfully",
  "upload_id": "up_abcd1234efgh5678"
}
```

**Response example (soft delete, in use)**:
```json
{
  "code": 200,
  "message": "File is in use and has been marked as deleted; physical file retained",
  "use_count": 2
}
```

---

### Scenario 7: Get Session List and Details

**Get session list**

```python
import requests

resp = requests.get(f"{BASE_URL}/drawing/sessions?limit=10", headers=HEADERS)
print(resp.json())
```

```javascript
const resp = await fetch(`${BASE_URL}/drawing/sessions?limit=10`, { headers: HEADERS });
console.log(await resp.json());
```

**Response example**:
```json
{
  "code": 200,
  "data": [
    {
      "session_id": "ds_a1b2c3d4e5f6",
      "title": "我的创作",
      "status": "active",
      "total_generations": 3,
      "total_cost": 27,
      "last_message_at": "2026-04-23T10:35:00",
      "created_at": "2026-04-23T10:30:00"
    }
  ]
}
```

**Get single session details**

```python
import requests

resp = requests.get(f"{BASE_URL}/drawing/sessions/{session_id}", headers=HEADERS)
print(resp.json())
```

```javascript
const resp = await fetch(`${BASE_URL}/drawing/sessions/${session_id}`, { headers: HEADERS });
console.log(await resp.json());
```

**Response example**:
```json
{
  "code": 200,
  "data": {
    "session_id": "ds_a1b2c3d4e5f6",
    "title": "我的创作",
    "status": "active",
    "total_generations": 1,
    "total_cost": 7,
    "messages": [
      {
        "message_id": "dm_xxx_user",
        "role": "user",
        "sequence": 1,
        "content": "一只可爱的猫咪",
        "created_at": "2026-04-23T10:30:00"
      },
      {
        "message_id": "dm_xxx_assistant",
        "role": "assistant",
        "sequence": 2,
        "content": "一只可爱的猫咪",
        "model": "gemini-3.1-flash-image-preview",
        "resolution": "1K",
        "aspect_ratio": "1:1",
        "status": "completed",
        "images": [
          {"url": "/uploads/3/images/2026/04/23/generated_0.png", "local_path": "uploads/3/images/2026/04/23/generated_0.png"}
        ],
        "actual_cost": 7,
        "created_at": "2026-04-23T10:30:01",
        "completed_at": "2026-04-23T10:32:15"
      }
    ],
    "created_at": "2026-04-23T10:30:00",
    "updated_at": "2026-04-23T10:32:15"
  }
}
```

**Update session title**

```python
import requests

resp = requests.put(
    f"{BASE_URL}/drawing/sessions/{session_id}/title",
    headers={**HEADERS, "Content-Type": "application/json"},
    json={"title": "修改后的标题"}
)
print(resp.json())
```

```javascript
const resp = await fetch(`${BASE_URL}/drawing/sessions/${session_id}/title`, {
  method: "PUT",
  headers: { ...HEADERS, "Content-Type": "application/json" },
  body: JSON.stringify({ title: "修改后的标题" })
});
console.log(await resp.json());
```

**Response example**:
```json
{
  "code": 200,
  "message": "Title updated successfully"
}
```

**Delete session (soft delete)**

```python
import requests

resp = requests.delete(f"{BASE_URL}/drawing/sessions/{session_id}", headers=HEADERS)
print(resp.json())
```

```javascript
const resp = await fetch(`${BASE_URL}/drawing/sessions/${session_id}`, {
  method: "DELETE",
  headers: HEADERS
});
console.log(await resp.json());
```

**Response example**:
```json
{
  "code": 200,
  "message": "Session deleted",
  "status": "deleted"
}
```

---

### Scenario 8: Query Billing History

```python
import requests

resp = requests.get(f"{BASE_URL}/drawing/billing/history?limit=20", headers=HEADERS)
print(resp.json())
```

```javascript
const resp = await fetch(`${BASE_URL}/drawing/billing/history?limit=20`, { headers: HEADERS });
console.log(await resp.json());
```

**Response example**:
```json
{
  "code": 200,
  "data": {
    "total": 2,
    "offset": 0,
    "limit": 20,
    "transactions": [
      {
        "id": 101,
        "type": "reserve",
        "type_name": "Reserve",
        "points": -7,
        "total_points_after": 99993,
        "frozen_points_after": 7,
        "biz_type": "text_to_image",
        "biz_id": "dm_a1b2c3d4e5_assistant",
        "created_at": "2026-04-23T10:30:00"
      },
      {
        "id": 102,
        "type": "consume",
        "type_name": "Consume",
        "points": -7,
        "total_points_after": 99993,
        "frozen_points_after": 0,
        "biz_type": "text_to_image",
        "biz_id": "dm_a1b2c3d4e5_assistant",
        "created_at": "2026-04-23T10:32:15"
      }
    ]
  }
}
```

---

**Document last updated**: 2026-05-18
