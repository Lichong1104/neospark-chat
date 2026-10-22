import { useEffect, useRef, useState } from 'react';
import { ArrowUp, FileText, Loader2, Paperclip, X } from 'lucide-react';
import { toast } from 'sonner';
import type { Attachment, Message as ChatMessage } from '../types';
import { Message } from './Message';
import Eyebrow from './Eyebrow';
import { uploadFile } from '../lib/api';
import { uid } from '../lib/utils';

interface ChatAreaProps {
  title: string;
  contextLabel: string;
  messages: ChatMessage[];
  streaming: boolean;
  draft: string;
  onDraftChange: (text: string) => void;
  onSend: (text: string, attachments: Attachment[]) => void;
  authenticated: boolean;
  onRequestLogin: () => void;
}

const SUGGESTIONS = [
  'Generate a 9-grid e-commerce detail page visual plan',
  'Organize my notes into a Word document',
  'Write a Xiaohongshu-style promo post',
];

export default function ChatArea({
  title,
  contextLabel,
  messages,
  streaming,
  draft,
  onDraftChange,
  onSend,
  authenticated,
  onRequestLogin,
}: ChatAreaProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  const send = () => {
    const text = draft.trim();
    if ((!text && attachments.length === 0) || streaming) return;
    if (!authenticated) {
      onRequestLogin();
      return;
    }
    onSend(text, attachments);
    setAttachments([]);
  };

  const grow = () => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      try {
        const uploaded = await uploadFile(file);
        setAttachments((prev) => [
          ...prev,
          {
            id: uid(),
            uploadId: uploaded.uploadId,
            url: uploaded.url,
            name: uploaded.filename,
            type: file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'file',
          },
        ]);
      } catch (e) {
        toast((e as Error).message || 'Upload failed');
      }
    }
    setUploading(false);
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <main className="flex h-full min-w-0 flex-1 flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-line bg-surface/70 px-6 py-3 backdrop-blur">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold tracking-tight">{title || 'New chat'}</div>
          <div className="truncate text-[12px] text-muted-2">{contextLabel || 'Select a skill to start'}</div>
        </div>
      </header>

      {/* Messages */}
      <div ref={listRef} className="flex-1 overflow-y-auto px-6 py-8">
        {messages.length === 0 ? (
          <div className="mx-auto flex max-w-2xl flex-col items-center pt-[10vh] text-center">
            <Eyebrow>NeoSpark Conversation</Eyebrow>
            <h1 className="mt-6 text-[2rem] font-bold leading-[1.15] tracking-[-0.03em]">
              One conversation, all your Skills
            </h1>
            <p className="mt-3 max-w-md text-[15px] leading-relaxed text-muted">
              Pick one or more skills and a model on the left, then describe the result you want.
              Once connected, the skill's real output streams back here.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => (authenticated ? onSend(s, []) : onRequestLogin())}
                  className="rounded-full border border-line bg-surface px-4 py-2 text-[13px] font-medium text-muted shadow-card transition-colors hover:border-ink hover:text-ink"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-5">
            {messages.map((m) => (
              <Message key={m.id} message={m} />
            ))}
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-line bg-surface/70 px-6 py-4 backdrop-blur">
        {(attachments.length > 0 || uploading) && (
          <div className="mx-auto mb-2 flex max-w-3xl flex-wrap gap-2">
            {attachments.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-2 rounded-xl border border-line bg-surface py-1 pl-1 pr-1.5 shadow-card"
              >
                {a.type === 'image' ? (
                  <img src={a.url} alt="" className="h-9 w-9 rounded-lg object-cover" />
                ) : (
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-line-soft text-muted-2">
                    <FileText className="h-4 w-4" />
                  </span>
                )}
                <span className="max-w-[160px] truncate text-[12px] font-medium text-ink-2">{a.name}</span>
                <button
                  type="button"
                  onClick={() => removeAttachment(a.id)}
                  className="rounded-md p-1 text-muted-2 transition-colors hover:bg-line-soft hover:text-ink"
                  aria-label="Remove attachment"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {uploading && (
              <div className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-[12px] font-medium text-muted-2 shadow-card">
                <Loader2 className="h-4 w-4 animate-spin text-orange-deep" />
                Uploading…
              </div>
            )}
          </div>
        )}

        <div className="mx-auto flex max-w-3xl items-end gap-1.5 rounded-2xl border border-line bg-surface p-2 shadow-card">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex h-9 w-9 flex-none items-center justify-center rounded-xl text-muted-2 transition-colors hover:bg-line-soft hover:text-ink"
            aria-label="Add attachment"
            title="Add attachment"
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <textarea
            ref={areaRef}
            rows={1}
            value={draft}
            onChange={(e) => {
              onDraftChange(e.target.value);
              grow();
            }}
            onFocus={() => {
              if (!authenticated) onRequestLogin();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={authenticated ? 'Message NeoSpark…' : 'Sign in to start chatting…'}
            className="max-h-[180px] min-h-[24px] flex-1 resize-none bg-transparent px-2 py-1.5 text-[0.95rem] leading-relaxed outline-none placeholder:text-muted-2"
          />
          <button
            type="button"
            onClick={send}
            disabled={(!draft.trim() && attachments.length === 0) || streaming}
            aria-label="Send"
            className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-ink text-surface shadow-[0_1px_2px_rgba(10,10,10,.3),0_8px_18px_-8px_rgba(10,10,10,.5)] transition-transform duration-200 hover:scale-105 disabled:scale-100 disabled:opacity-30"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              void handleFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </div>
        <div className="mx-auto mt-2 flex max-w-3xl items-center justify-between text-[11px] text-muted-2">
          <span>{authenticated ? 'Enter to send · Shift+Enter for newline' : 'Not signed in — sign in to send'}</span>
          <span>{streaming ? 'Generating…' : contextLabel}</span>
        </div>
      </div>
    </main>
  );
}
