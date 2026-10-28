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
}

/** Top-level screens the sidebar can switch between. */
export type View = 'chat' | 'pricing' | 'balance' | 'subscription' | 'user' | 'skills' | 'api-keys';

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

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
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
