import type { ModelOption, Skill } from '../types';

// Fallback catalogue, used only while the live `GET /agents/skills` has not
// loaded (or has failed). Kept in sync with production so the shell never
// shows a skill that no longer exists.
export const SKILLS: Skill[] = [
  { id: 'agent-reach', name: 'Agent Reach', description: 'Read and search the public web: turn pages into Markdown, read RSS, fetch V2EX, Xueqiu, Bilibili, GitHub and YouTube transcripts, and run Exa searches. Read-only.', emoji: '🌐' },
  { id: 'drawing-prompt', name: 'Drawing Prompt Optimizer', description: 'Turn a simple idea into a high-quality English prompt for AI image models.', emoji: '🎨' },
  { id: 'ecommerce-detail-page-expert', name: 'E-commerce Detail Page Expert', description: 'Generate a nine-grid visual strategy for e-commerce detail pages, nine hero-image prompts, and call the API to render previews and standalone hero images.', emoji: '🛍️' },
  { id: 'neospark-imagegen-cli', name: 'NeoSpark Image Gen', description: 'Generate, edit and fuse images through the NeoSpark image API (text-to-image, image-to-image and multi-reference fusion).', emoji: '🖼️' },
  { id: 'neospark-infographics', name: 'NeoSpark Infographics', description: 'Turn articles, notes and data into polished infographic plates, choosing a layout automatically and rendering through the image API.', emoji: '📊' },
  { id: 'neospark-video-cli', name: 'NeoSpark Video', description: 'Create and manage video jobs: text-to-video, image-to-video, multi-reference generation and watermark removal.', emoji: '🎬' },
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
