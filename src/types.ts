export interface Skill {
  id: string;
  name: string;
  description: string;
  emoji?: string;
  /** Uploader id; null/undefined marks a system skill. */
  ownerId?: number | null;
  isActive?: boolean;
  /** Cover image (first preview), then the full set. */
  preview?: string | null;
  previews?: string[];
  executionMode?: string;
  /** Real rating aggregates; null/0 when nobody has rated it yet. */
  ratingAvg?: number | null;
  ratingCount?: number;
  commentCount?: number;
  /** Distinct users who downloaded the MCP bundle. */
  installs?: number;
}

export interface SkillReviewItem {
  id: number;
  user_id: number;
  user_name: string;
  user_avatar: string | null;
  rating: number | null;
  comment: string | null;
  created_at: string | null;
  is_mine: boolean;
  /** Only ever true on my_review — hidden reviews stay out of the public list. */
  is_hidden: boolean;
  hidden_reason: string | null;
}

export type SkillReviewBlockReason = 'login_required' | 'owner' | 'not_used';

export interface SkillReviewsSummary {
  skill_id: string;
  rating_avg: number | null;
  rating_count: number;
  comment_count: number;
  total: number;
  my_review: SkillReviewItem | null;
  comments: SkillReviewItem[];
  offset: number;
  limit: number;
  sort: 'newest' | 'rating';
  has_used: boolean;
  can_review: boolean;
  block_reason: SkillReviewBlockReason | null;
}

/** Top-level screens the sidebar can switch between. */
export type View = 'chat' | 'pricing' | 'balance' | 'subscription' | 'docs' | 'user' | 'skills' | 'api-keys';

export interface ApiKeyItem {
  id: number;
  name: string;
  is_active: boolean;
  status: 'active' | 'expired' | 'inactive';
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface ApiKeyListData {
  items: ApiKeyItem[];
  total: number;
  active_count: number;
  expired_count: number;
}

export interface CreatedApiKey extends ApiKeyItem {
  api_key: string;
}

export interface ModelOption {
  id: string;
  label: string;
}

export interface MediaBlock {
  type: 'image' | 'video' | 'file';
  url: string;
  filename?: string;
  mime?: string;
}

/** A confirmation the Skill asks for (e.g. image aspect ratio, a parameter choice). */
export interface ConfirmPrompt {
  question: string;
  options: string[];
}

/** One step in a multi-skill orchestration plan. */
export interface PlanStep {
  skill_id: string;
  skill_name: string;
  task: string;
}

export interface Attachment {
  id: string;
  uploadId: string;
  url: string;
  name: string;
  type: 'image' | 'video' | 'file';
}

/** One Skill's line in a price preview (`POST /agents/skills/pricing/batch`). */
export interface SkillPricingItem {
  skill_id: string;
  pricing_mode: string;
  skill_fee_credits: number;
  creator_share_rate: number;
  free_quota_applied: boolean;
  free_quota_remaining: number;
  free_quota_period: string | null;
  estimated_token_credits: number;
  estimated_asset_credits: number;
  pricing_version: string | number | null;
}

/** Pre-run quote for the selected Skills: fee, free quota and hold estimate. */
export interface SkillPricingPreview {
  skill_fee_credits: number;
  estimated_token_credits: number;
  estimated_asset_credits: number;
  hold_credits: number;
  max_points_per_run: number;
  hold_expires_hours: number;
  budget_remaining: number;
  free_quota_applied: boolean;
  skills: SkillPricingItem[];
  resolved_skill_ids?: string[];
}

/** Per-Skill split of a settled invocation. */
export interface BillingSkillLine {
  skill_id: string;
  owner_id: number | null;
  skill_fee_credits: number;
  creator_credits: number;
  platform_credits: number;
  refunded_credits: number;
  free_quota_applied: boolean;
}

/** One internal asset task (image/video/…) charged inside an invocation. */
export interface BillingAssetLine {
  id: number;
  skill_id: string | null;
  asset_type: string;
  task_table: string | null;
  task_id: string | null;
  provider: string | null;
  model: string | null;
  quantity: number;
  unit_credits: number;
  credits: number;
  upstream_cost_fen: number;
  status: string;
  error_code: string | null;
  created_at: string | null;
  completed_at: string | null;
}

/** Settled billing payload attached to an assistant turn (`billing` in SSE). */
export interface SkillBilling {
  invocation_id: number;
  user_id: number;
  skill_id: string | null;
  channel: string;
  status: string;
  skill_count: number;
  skill_fee_credits: number;
  token_credits: number;
  asset_credits: number;
  asset_item_count: number;
  total_credits: number;
  refunded_credits: number;
  creator_credits: number;
  platform_credits: number;
  charged_credits: number | null;
  free_quota_applied: boolean;
  partial_success: boolean;
  balance_after?: number | null;
  skills?: BillingSkillLine[];
  assets?: BillingAssetLine[];
}

/** One run in full, from `GET /agents/skills/invocations/{id}`. */
export interface SkillInvocationDetail extends SkillBilling {
  model: string | null;
  input_tokens: number;
  output_tokens: number;
  error_code: string | null;
  created_at: string | null;
  settled_at: string | null;
  pricing_snapshot?: Record<string, unknown>;
  skills: BillingSkillLine[];
  assets: BillingAssetLine[];
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** Settlement for this turn: summary, per-Skill split and asset entries. */
  billing?: SkillBilling;
  /** Media produced by the Skill (streamed live), rendered under the text. */
  media?: MediaBlock[];
  /** A confirmation the Skill is waiting on, rendered as tappable option cards. */
  confirm?: ConfirmPrompt;
  /** A multi-skill orchestration plan, rendered as a task list. */
  plan?: PlanStep[];
  /** Progress of the plan: how many steps are done. */
  stepCompleted?: number;
  stepTotal?: number;
  /** True while the message is being streamed in. */
  streaming?: boolean;
  createdAt: number;
}

export interface Session {
  /** The backend session_id. */
  id: string;
  title: string;
  skillIds: string[];
  model: string | null;
  pinned: boolean;
  updatedAt: number;
}

export interface UserInfo {
  id: number;
  email: string;
  name: string | null;
  avatar_url: string | null;
  balance: number;
  is_admin: boolean;
  created_at?: string | null;
}

/** Stripe subscription state from GET /billing/state. */
export interface SubscriptionState {
  stripeSubscriptionId: string;
  stripePriceId: string;
  planKey: string;
  billingInterval: string;
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

export interface BillingState {
  user: { id: number; email: string } | null;
  subscription: SubscriptionState | null;
}

/** Credit balance from GET /balance. */
export interface BalanceInfo {
  total_points: number;
  frozen_points: number;
  available_points: number;
  points_expires_at: string | null;
  points_expired: boolean;
}

/** A single credit ledger entry from GET /drawing/billing/history. */
export interface PointTransaction {
  id: number;
  type: string;
  type_name: string;
  points: number;
  total_points_after: number;
  frozen_points_after: number;
  biz_type: string;
  biz_id: string;
  description: string | null;
  created_at: string | null;
}
