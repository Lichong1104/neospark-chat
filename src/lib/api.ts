import axios from 'axios';
import type { MediaBlock, ModelOption, Session, Skill, UserInfo } from '../types';
import { emojiFor } from '../data/skills';

const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ||
  'https://api.useneospark.com/api/v1';
const API_ORIGIN = API_BASE.replace(/\/api\/v1\/?$/, '');

const TOKEN_KEY = 'neospark_access_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}
export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

const http = axios.create({
  baseURL: API_BASE,
  // The session cookie (neospark_session) lives on the API origin and is sent
  // cross-origin only with credentials enabled. This is what carries login
  // state across astro-site → chat and across browser sessions.
  withCredentials: true,
});

http.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Unwrap the axios envelope so callers get the payload directly.
http.interceptors.response.use(
  (res) => res.data,
  (err) => Promise.reject(err),
);

/* --------------------------------------------------------------- auth -- */

export async function sendEmailCode(email: string): Promise<void> {
  await http.post('/auth/email/send-code', { email, turnstile_token: null });
}

export async function emailLogin(email: string, code: string): Promise<void> {
  await http.post('/auth/email/login', {
    email,
    code,
    referral_code: null,
    turnstile_token: null,
  });
  await mintAccessToken();
}

export async function getMe(): Promise<UserInfo> {
  const res = (await http.get('/auth/me')) as { data?: UserInfo };
  if (!res?.data) throw new Error('Unexpected /auth/me response');
  return res.data;
}

export async function mintAccessToken(): Promise<string | null> {
  try {
    const res = (await http.post('/auth/access-token')) as { access_token?: string };
    if (res?.access_token) setToken(res.access_token);
    return res?.access_token ?? null;
  } catch {
    return null;
  }
}

export async function logout(): Promise<void> {
  try {
    await http.post('/auth/logout');
  } catch {
    // even if the backend is unreachable, clear local state
  }
  clearToken();
}

export function googleLoginUrl(next = '/'): string {
  const target = /^https?:\/\//.test(next) ? next : `${window.location.origin}${next}`;
  const params = new URLSearchParams({ next: target });
  return `${API_BASE}/auth/google/login?${params.toString()}`;
}

/* ------------------------------------------------------------ catalogue -- */

interface BackendSkill {
  id: string;
  name: string;
  description?: string;
  is_active?: boolean;
  owner_id?: number | null;
}

export async function listSkills(): Promise<Skill[]> {
  const res = (await http.get('/agents/skills')) as unknown;
  const arr = Array.isArray(res) ? (res as BackendSkill[]) : (res as { data?: BackendSkill[] })?.data;
  return (arr ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description ?? '',
    emoji: emojiFor(s.id),
  }));
}

export async function listModels(): Promise<ModelOption[]> {
  const res = (await http.get('/agents/models')) as unknown as { data?: ModelOption[] };
  return res?.data ?? [];
}

/* ------------------------------------------------------------- history -- */

interface BackendSession {
  session_id: string;
  title?: string;
  skill_ids?: string[];
  model?: string | null;
  updated_at?: string;
  pinned?: boolean;
}

interface BackendMessage {
  message_id: string;
  role: string;
  content: string;
  created_at?: string;
}

export async function listSessions(): Promise<Session[]> {
  const res = (await http.get('/agents/sessions')) as unknown as { sessions?: BackendSession[] };
  return (res?.sessions ?? []).map((s) => ({
    id: s.session_id,
    title: s.title || 'New chat',
    skillIds: s.skill_ids ?? [],
    model: s.model ?? null,
    pinned: Boolean(s.pinned),
    updatedAt: s.updated_at ? new Date(s.updated_at).getTime() : Date.now(),
  }));
}

export async function getSessionMessages(sessionId: string): Promise<import('../types').Message[]> {
  const res = (await http.get(`/agents/sessions/${sessionId}/messages`)) as unknown as {
    messages?: BackendMessage[];
  };
  return (res?.messages ?? []).map((m) => ({
    id: m.message_id,
    role: m.role === 'user' ? 'user' : 'assistant',
    content: absolutizeMarkdownLinks(m.content || ''),
    createdAt: m.created_at ? new Date(m.created_at).getTime() : Date.now(),
  }));
}

export async function deleteSession(sessionId: string): Promise<void> {
  await http.delete(`/agents/sessions/${encodeURIComponent(sessionId)}`);
}

export async function pinSession(sessionId: string, pinned: boolean): Promise<void> {
  await http.patch(`/agents/sessions/${encodeURIComponent(sessionId)}/pin`, { pinned });
}

/* -------------------------------------------------------------- upload -- */

export interface UploadedFile {
  uploadId: string;
  url: string;
  filename: string;
}

function detectFileType(file: File): string {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  return 'other';
}

export async function uploadFile(file: File): Promise<UploadedFile> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('file_type', detectFileType(file));
  const res = (await http.post('/storage/upload', formData)) as unknown as {
    data?: { upload_id?: string; url?: string; filename?: string };
  };
  return {
    uploadId: res?.data?.upload_id ?? '',
    url: res?.data?.url ?? '',
    filename: res?.data?.filename ?? file.name,
  };
}

/* ---------------------------------------------------------- URL helpers -- */

export function absolutizeUrl(url: string): string {
  if (!url) return url;
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url;
  return url.startsWith('/') ? `${API_ORIGIN}${url}` : `${API_ORIGIN}/${url}`;
}

/** Rewrite relative markdown links/images in stored history to absolute URLs. */
export function absolutizeMarkdownLinks(text: string): string {
  if (!text) return text;
  return text.replace(/\]\((\/[^)\s]+)\)/g, (_m, path: string) => `](${absolutizeUrl(path)})`);
}

/* ---------------------------------------------------------- SSE chat -- */

export interface ChatStreamHandlers {
  onText: (text: string) => void;
  onMedia: (block: MediaBlock) => void;
  onDone: (payload: { content?: string; session_id?: string }) => void;
  onError: (message: string) => void;
}

function parseSseEvent(
  raw: string,
  handlers: ChatStreamHandlers,
  onSession: (sessionId: string) => void,
) {
  let eventName: string | null = null;
  const dataLines: string[] = [];
  for (const line of raw.split('\n')) {
    if (line.startsWith('event:')) eventName = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
  }
  if (!dataLines.length) return;

  const dataStr = dataLines.join('\n');
  if (dataStr === '[DONE]') return;

  let data: unknown;
  try {
    data = JSON.parse(dataStr);
  } catch {
    return;
  }
  if (typeof data !== 'object' || data === null) return;

  // Named events (video_task / plan / step_done / confirm) are orchestration
  // metadata; the basic chat only needs the bare data events below.
  if (eventName) return;

  const obj = data as Record<string, unknown>;
  if (obj.error) {
    handlers.onError(String(obj.error));
    return;
  }
  if (obj.type === 'text') {
    handlers.onText(String(obj.text ?? obj.content ?? ''));
    return;
  }
  if (obj.type === 'image' || obj.type === 'video' || obj.type === 'file') {
    handlers.onMedia({
      type: obj.type,
      url: absolutizeUrl(String(obj.url ?? '')),
      filename: obj.filename ? String(obj.filename) : undefined,
    });
    return;
  }
  // Final payload: { content, done, session_id, blocks, files, usage }.
  if (obj.session_id) onSession(String(obj.session_id));
  handlers.onDone({
    content: obj.content ? String(obj.content) : undefined,
    session_id: obj.session_id ? String(obj.session_id) : undefined,
  });
}

/**
 * Stream a Skill chat turn over SSE. Returns the resolved session_id (from the
 * `x-session-id` header or the final payload) so a new conversation can be
 * continued on the next turn.
 */
export async function chatStream(
  params: {
    skillIds: string[];
    message: string;
    sessionId?: string | null;
    model?: string;
  },
  handlers: ChatStreamHandlers,
  signal?: AbortSignal,
): Promise<string | null> {
  const { skillIds, message, sessionId, model } = params;
  const isMulti = skillIds.length > 1;
  const path = isMulti ? '/agents/chat/multi/stream' : '/agents/chat/stream';
  const body: Record<string, unknown> = isMulti
    ? { skill_ids: skillIds, message }
    : { skill_id: skillIds[0], message };
  if (sessionId) body.session_id = sessionId;
  if (model) body.model_override = model;

  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const j = (await res.json()) as { detail?: string };
      if (j.detail) detail = j.detail;
    } catch {
      // keep the generic message
    }
    throw new Error(detail);
  }

  let finalSessionId = res.headers.get('x-session-id');

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const onSession = (sid: string) => {
    finalSessionId = sid;
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() || '';
    for (const part of parts) parseSseEvent(part, handlers, onSession);
  }
  if (buffer.trim()) parseSseEvent(buffer, handlers, onSession);

  return finalSessionId;
}

export { API_BASE, API_ORIGIN };
