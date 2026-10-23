export interface Skill {
  id: string;
  name: string;
  description: string;
  emoji?: string;
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
