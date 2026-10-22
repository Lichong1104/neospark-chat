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
