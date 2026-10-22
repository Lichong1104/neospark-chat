import type { ModelOption, Skill } from '../types';

// Fallback catalogue, used only while the live `GET /agents/skills` has not
// loaded (or has failed). Kept in sync with production so the shell never
// shows a skill that no longer exists.
export const SKILLS: Skill[] = [
  { id: 'agent-reach', name: 'Agent Reach', description: '读取与搜索公开互联网内容：抓网页为 Markdown、读 RSS、查 V2EX/雪球/B 站/GitHub/YouTube 字幕，跑 Exa 搜索。只读。', emoji: '🌐' },
  { id: 'drawing-prompt', name: '绘画提示词优化助手', description: '把简单想法转成适合 AI 绘画模型的高质量英文提示词', emoji: '🎨' },
  { id: 'ecommerce-detail-page-expert', name: '电商详情页视觉专家', description: '生成电商九宫格视觉策略、9 张主图提示词，并调用 API 生成预览图与独立主图', emoji: '🛍️' },
  { id: 'neospark-imagegen-cli', name: 'NeoSpark 图片生成助手', description: '通过 NeoSpark 绘画 API 生成、编辑和融合图片（文生图 / 图生图 / 多参考融合）', emoji: '🖼️' },
  { id: 'neospark-infographics', name: 'Neospark Infographics', description: '把文章、笔记、数据转成精致的信息图板，自动选版式并调用图片 API 渲染', emoji: '📊' },
  { id: 'neospark-video-cli', name: 'NeoSpark Video', description: '生成与管理视频任务：文生视频 / 图生视频 / 多参考生成 / 去水印', emoji: '🎬' },
];

export const MODELS: ModelOption[] = [
  { id: 'gemini:gemini-4-argon', label: 'Gemini 4 Argon' },
  { id: 'anthropic:claude-opus-5', label: 'Claude Opus 5' },
  { id: 'openai:gpt-6-astra', label: 'GPT-6 Astra' },
];

// Emoji per skill id, so skills fetched from the backend get the same warm
// mark as the fallback catalogue.
const SKILL_EMOJI: Record<string, string> = {
  'agent-reach': '🌐',
  'drawing-prompt': '🎨',
  'ecommerce-detail-page-expert': '🛍️',
  'neospark-imagegen-cli': '🖼️',
  'neospark-infographics': '📊',
  'neospark-video-cli': '🎬',
};

export function emojiFor(id: string): string {
  return SKILL_EMOJI[id] ?? '⚙️';
}

export function skillById(id: string): Skill | undefined {
  return SKILLS.find((s) => s.id === id);
}
