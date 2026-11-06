import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Check, ChevronDown, FileText, Loader2, Menu, Paperclip, Search, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';
import type { Attachment, MediaBlock, Message as ChatMessage, ModelOption, Skill, ThinkingDepth } from '../types';
import { Message } from './Message';
import Eyebrow from './Eyebrow';
import { uploadFile } from '../lib/api';
import { cn, uid } from '../lib/utils';

interface ChatAreaProps {
  title: string;
  contextLabel: string;
  messages: ChatMessage[];
  streaming: boolean;
  loadingHistory: boolean;
  draft: string;
  onDraftChange: (text: string) => void;
  onSend: (text: string, attachments: Attachment[]) => void;
  onConfirmSelect: (option: string) => void;
  onPreviewMedia: (media: MediaBlock) => void;
  authenticated: boolean;
  onRequestLogin: () => void;
  skills: Skill[];
  selectedSkills: string[];
  onToggleSkill: (id: string) => void;
  models: ModelOption[];
  model: string;
  onModelChange: (id: string) => void;
  thinkingDepth: ThinkingDepth;
  onThinkingDepthChange: (depth: ThinkingDepth) => void;
  /** Bumped whenever the conversation changes (new chat / switch / delete). */
  composerKey: number;
  onOpenNav: () => void;
}

const SUGGESTIONS = [
  'Generate a 9-grid e-commerce detail page visual plan',
  'Organize my notes into a Word document',
  'Write a Xiaohongshu-style promo post',
];

type SlashItem =
  | { kind: 'skill'; id: string; name: string; description: string; emoji: string; active: boolean }
  | { kind: 'attachment'; id: string; name: string; url: string; mediaType: 'image' | 'video' | 'file' };

/* Brand marks for the model providers, keyed by the id prefix before ":". */
function GeminiMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="model-icon-gemini" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#4387fd" />
          <stop offset="1" stopColor="#9b72cb" />
        </linearGradient>
      </defs>
      <path
        fill="url(#model-icon-gemini)"
        d="M12 0c.9 6.6 4.8 10.8 12 12-7.2 1.2-11.1 5.4-12 12-.9-6.6-4.8-10.8-12-12C7.2 10.8 11.1 6.6 12 0z"
      />
    </svg>
  );
}

function OpenAiMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="#0a0a0a" strokeWidth="1.7" aria-hidden="true">
      <ellipse cx="12" cy="12" rx="9.2" ry="3.7" />
      <ellipse cx="12" cy="12" rx="9.2" ry="3.7" transform="rotate(60 12 12)" />
      <ellipse cx="12" cy="12" rx="9.2" ry="3.7" transform="rotate(120 12 12)" />
    </svg>
  );
}

function ClaudeMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="#d97757" aria-hidden="true">
      <rect x="10.1" y="2.5" width="3.8" height="19" rx="1.9" />
      <rect x="10.1" y="2.5" width="3.8" height="19" rx="1.9" transform="rotate(60 12 12)" />
      <rect x="10.1" y="2.5" width="3.8" height="19" rx="1.9" transform="rotate(120 12 12)" />
    </svg>
  );
}

function ModelIcon({ modelId, className }: { modelId: string; className?: string }) {
  const provider = modelId.split(':')[0];
  if (provider === 'gemini') return <GeminiMark className={className} />;
  if (provider === 'openai') return <OpenAiMark className={className} />;
  if (provider === 'anthropic') return <ClaudeMark className={className} />;
  return <Sparkles className={className} />;
}

export default function ChatArea({
  title,
  contextLabel,
  messages,
  streaming,
  loadingHistory,
  draft,
  onDraftChange,
  onSend,
  onConfirmSelect,
  onPreviewMedia,
  authenticated,
  onRequestLogin,
  skills,
  selectedSkills,
  onToggleSkill,
  models,
  model,
  onModelChange,
  thinkingDepth,
  onThinkingDepthChange,
  composerKey,
  onOpenNav,
}: ChatAreaProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modelRef = useRef<HTMLDivElement>(null);
  const dragDepth = useRef(0);
  /** Caret position captured when the @ menu opens, used when inserting a chip. */
  const savedRangeRef = useRef<Range | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState('');
  const [slashIndex, setSlashIndex] = useState(0);
  const [mentionMode, setMentionMode] = useState<'select' | 'mention'>('mention');
  const slashRef = useRef<HTMLDivElement>(null);

  // Attachments belong to the conversation they were dropped into. Switching to
  // another conversation (or starting a new one) must not carry them over, and an
  // upload that finishes after the switch must not land in the new conversation.
  const composerKeyRef = useRef(composerKey);
  useEffect(() => {
    if (composerKeyRef.current === composerKey) return;
    composerKeyRef.current = composerKey;
    setAttachments([]);
    setUploading(false);
    setDragActive(false);
    dragDepth.current = 0;
  }, [composerKey]);

  // Follow the stream only while the reader is parked at the bottom. Scrolling
  // up to reread output should not be yanked back down by the next chunk.
  const [atBottom, setAtBottom] = useState(true);
  const atBottomRef = useRef(true);
  const firstMessageIdRef = useRef<string | null>(null);

  const jumpToBottom = (smooth = false) => {
    const el = listRef.current;
    if (!el) return;
    atBottomRef.current = true;
    setAtBottom(true);
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  };

  const handleListScroll = () => {
    const el = listRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    atBottomRef.current = near;
    setAtBottom(near);
  };

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const firstId = messages[0]?.id ?? null;
    const conversationChanged = firstId !== firstMessageIdRef.current;
    firstMessageIdRef.current = firstId;
    if (conversationChanged || atBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Keep the uncontrolled contentEditable in sync with the draft state.
  // The marketing-site jump-in and the auto-send path set `draft` from outside
  // the editor, so the DOM can still hold the old text after the state is
  // cleared — which made the placeholder render on top of leftover text.
  // Syncing whenever they differ (including clearing) fixes that.
  useEffect(() => {
    const el = editorRef.current;
    if (!el || el.innerText === draft) return;
    el.innerText = draft;
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    sel?.removeAllRanges();
    sel?.addRange(range);
  }, [draft]);

  useEffect(() => {
    if (!modelOpen) return;
    const onDown = (e: MouseEvent) => {
      if (modelRef.current && !modelRef.current.contains(e.target as Node)) setModelOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModelOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [modelOpen]);

  useEffect(() => {
    if (!slashOpen) return;
    const onDown = (e: MouseEvent) => {
      if (slashRef.current && !slashRef.current.contains(e.target as Node)) {
        // Close the menu without rewriting the draft: this used to truncate
        // everything after the last "@", so clicking outside after pasting a
        // long text dropped half of it.
        setSlashOpen(false);
        setSlashQuery('');
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [slashOpen]);

  useEffect(() => {
    if (!slashOpen) return;
    const el = slashRef.current?.querySelector(`[data-item-index="${slashIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [slashIndex, slashOpen]);

  const modelLabel = model ? models.find((m) => m.id === model)?.label ?? model : 'Model';
  const supportsThinking = models.find((m) => m.id === model)?.supportsThinking ?? false;

  const filteredItems = useMemo<SlashItem[]>(() => {
    const q = slashQuery.trim().toLowerCase();
    const skillItems: SlashItem[] = skills
      .filter((s) => !q || s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q))
      .map((s) => ({
        kind: 'skill' as const,
        id: s.id,
        name: s.name,
        description: s.description,
        emoji: s.emoji ?? '⚙️',
        active: selectedSkills.includes(s.id),
      }));
    // The "+ Skill" picker only lists skills; typing "@" also lists the files
    // the reader has attached, so a sentence can point at a specific one.
    if (mentionMode === 'select') return skillItems;
    const attachmentItems: SlashItem[] = attachments
      .filter((a) => !q || a.name.toLowerCase().includes(q))
      .map((a) => ({ kind: 'attachment' as const, id: a.id, name: a.name, url: a.url, mediaType: a.type }));
    return [...attachmentItems, ...skillItems];
  }, [skills, selectedSkills, attachments, slashQuery, mentionMode]);

  // Insert an inline @chip for a skill or an attachment at the caret, replacing
  // the "@query" the reader typed. The chip's text is what `el.innerText`
  // carries, so it ends up in the message the agent reads.
  const insertChip = (label: string, thumbUrl?: string) => {
    const el = editorRef.current;
    if (!el) return;

    // Clicking a menu button blurs the editor and resets the selection, so
    // prefer the caret position captured when "@" was typed; use the live
    // selection only when it actually sits in a text node containing "@".
    const sel = window.getSelection();
    let range: Range | null = null;
    if (sel && sel.rangeCount > 0) {
      const live = sel.getRangeAt(0);
      if (live.startContainer instanceof Text) {
        const liveBefore = live.startContainer.textContent || '';
        if (liveBefore.lastIndexOf('@', live.startOffset - 1) >= 0) range = live;
      }
    }
    const saved = savedRangeRef.current;
    if (!range && saved && saved.startContainer instanceof Text) {
      range = saved.cloneRange();
      // `saved` is the position at the moment "@" was typed; include the query
      // text typed since then in the deletion range.
      const savedNode = range.startContainer as Text;
      const queryLength = slashQuery.length;
      if (queryLength > 0) {
        range.setEnd(savedNode, Math.min(savedNode.length, range.startOffset + queryLength));
      }
    }
    if (!range) return;

    const node = range.startContainer as Text;
    const before = node.textContent || '';
    const offset = range.startOffset;
    const atIdx = before.lastIndexOf('@', offset - 1);
    if (atIdx < 0) return;
    // Only delete a short query ("@" plus a filename or Skill-name fragment).
    // A longer span means the selection has drifted; skip the insert rather
    // than delete body text.
    if (offset - atIdx > 96) return;

    range.setStart(node, atIdx);
    range.setEnd(node, offset);
    range.deleteContents();

    const chip = document.createElement('span');
    chip.contentEditable = 'false';
    chip.className = 'mention-chip';
    if (thumbUrl) {
      const img = document.createElement('img');
      img.src = thumbUrl;
      img.alt = '';
      chip.appendChild(img);
    }
    chip.appendChild(document.createTextNode(`@${label}`));
    const space = document.createTextNode(' ');
    range.insertNode(space);
    range.insertNode(chip);
    range.setStartAfter(space);
    range.collapse(true);
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(range);
    }
    savedRangeRef.current = null;

    onDraftChange(el.innerText || '');
  };

  const chooseItem = (item?: SlashItem) => {
    if (item) {
      if (item.kind === 'skill') {
        if (mentionMode === 'mention') {
          // Mentioning a skill inserts it inline and also selects it so it joins the run.
          insertChip(item.name);
          if (!selectedSkills.includes(item.id)) onToggleSkill(item.id);
        } else {
          onToggleSkill(item.id);
        }
      } else {
        // Referencing an attachment inserts a thumbnail + @filename; the file is
        // already in the send list, and the message carries its upload_id/url.
        insertChip(item.name, item.mediaType === 'image' ? item.url : undefined);
      }
    }
    setSlashOpen(false);
    setSlashQuery('');
  };

  const handleEditorInput = () => {
    const el = editorRef.current;
    if (!el) return;
    const text = el.innerText;
    onDraftChange(text);
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      const node = range.startContainer;
      const before = (node.textContent || '').slice(0, range.startOffset);
      const atIdx = before.lastIndexOf('@');
      if (atIdx >= 0) {
        savedRangeRef.current = range.cloneRange();
        setSlashQuery(before.slice(atIdx + 1));
        setSlashIndex(0);
        setSlashOpen(true);
      } else if (slashOpen) {
        setSlashOpen(false);
        setSlashQuery('');
      }
    }
  };

  const send = () => {
    const text = (editorRef.current?.innerText ?? draft).trim();
    if ((!text && attachments.length === 0) || streaming) return;
    if (!authenticated) {
      onRequestLogin();
      return;
    }
    atBottomRef.current = true;
    setAtBottom(true);
    onSend(text, attachments);
    setAttachments([]);
    if (editorRef.current) editorRef.current.innerText = '';
    onDraftChange('');
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const keyAtUploadStart = composerKeyRef.current;
    setUploading(true);
    for (const file of Array.from(files)) {
      try {
        const uploaded = await uploadFile(file);
        // The user switched conversations while this file was uploading: drop it
        // instead of attaching it to the conversation they are now looking at.
        if (composerKeyRef.current !== keyAtUploadStart) return;
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
    if (composerKeyRef.current === keyAtUploadStart) setUploading(false);
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  // Drag-and-drop: dropping files anywhere on the chat uploads them through the
  // same path as the paperclip button. A depth counter keeps the overlay from
  // flickering as the pointer crosses child elements.
  const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files');

  const onDragEnter = (e: React.DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepth.current += 1;
    setDragActive(true);
  };

  const onDragOver = (e: React.DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const onDragLeave = () => {
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragActive(false);
  };

  const onDrop = (e: React.DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepth.current = 0;
    setDragActive(false);
    if (e.dataTransfer.files?.length) void handleFiles(e.dataTransfer.files);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (slashOpen) {
      if (e.key === 'Escape') {
        e.preventDefault();
        chooseItem();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlashIndex((i) => Math.min(i + 1, filteredItems.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const item = filteredItems[slashIndex];
        if (item) chooseItem(item);
        return;
      }
    }
    if (e.key === '@') {
      setMentionMode('mention');
      setSlashOpen(true);
      setSlashQuery('');
      setSlashIndex(0);
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <main
      className="relative flex h-full min-w-0 flex-1 flex-col"
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {dragActive && (
        <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-surface/80 backdrop-blur-sm">
          <div className="rounded-2xl border-2 border-dashed border-orange-ink bg-surface px-6 py-4 text-sm font-semibold text-orange-ink shadow-panel">
            Drop files to attach
          </div>
        </div>
      )}
      {/* Header */}
      <header className="border-b border-line bg-surface/70 px-3 py-2.5 backdrop-blur sm:px-6 sm:py-3">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-1.5 sm:gap-3">
          <button type="button" onClick={onOpenNav} aria-label="Open menu" className="icon-btn lg:hidden">
            <Menu className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold tracking-tight">{title || 'New chat'}</div>
            <div className="truncate text-xs text-muted-2">{contextLabel || 'Select a skill to start'}</div>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="relative min-h-0 flex-1">
        <div
          ref={listRef}
          onScroll={handleListScroll}
          aria-busy={streaming}
          className="h-full overflow-y-auto px-4 py-6 sm:px-6 sm:py-8"
        >
          {loadingHistory ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-2" />
            </div>
          ) : messages.length === 0 ? (
            <div className="mx-auto flex max-w-3xl flex-col items-center pt-[10vh] text-center">
              <Eyebrow>NeoSpark Conversation</Eyebrow>
              <h1 className="mt-6 text-2xl font-bold leading-[1.15] tracking-[-0.03em] sm:text-display">
                One chat, all your skills
              </h1>
              <p className="mt-3 max-w-lg text-base leading-relaxed text-muted">
                Choose a skill and a model, then tell NeoSpark what you want.
              </p>
              <div className="mt-8 flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:justify-center">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => (authenticated ? onSend(s, []) : onRequestLogin())}
                    className="min-h-10 w-full rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium text-muted shadow-card transition-colors hover:border-ink hover:text-ink sm:w-auto"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 sm:gap-6">
              {messages.map((m) => (
                <Message
                  key={m.id}
                  message={m}
                  onConfirmSelect={onConfirmSelect}
                  onPreviewMedia={onPreviewMedia}
                  disabled={streaming}
                />
              ))}
            </div>
          )}
        </div>
        {!atBottom && (
          <button
            type="button"
            onClick={() => jumpToBottom(true)}
            className="absolute bottom-3 left-1/2 z-10 flex min-h-9 -translate-x-1/2 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-1.5 text-xs font-semibold text-ink shadow-panel"
          >
            <ArrowDown className="h-3.5 w-3.5" />
            {streaming ? 'Jump to latest' : 'Jump to bottom'}
          </button>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-line bg-surface/70 px-3 py-3 backdrop-blur sm:px-6 sm:py-4">
        {(attachments.length > 0 || uploading) && (
          <div className="mx-auto mb-2 flex w-full max-w-6xl flex-wrap gap-2">
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
                <span className="max-w-[160px] truncate text-xs font-medium text-ink-2">{a.name}</span>
                <button
                  type="button"
                  onClick={() => removeAttachment(a.id)}
                  className="flex h-8 w-8 flex-none items-center justify-center rounded-md text-muted-2 transition-colors hover:bg-line-soft hover:text-ink"
                  aria-label="Remove attachment"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {uploading && (
              <div className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-xs font-medium text-muted-2 shadow-card">
                <Loader2 className="h-4 w-4 animate-spin text-orange-ink" />
                Uploading…
              </div>
            )}
          </div>
        )}

        <div className="mx-auto w-full max-w-6xl">
          {/* Selected skills */}
          {selectedSkills.length > 0 && (
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              {selectedSkills.map((id) => {
                const skill = skills.find((s) => s.id === id);
                if (!skill) return null;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onToggleSkill(id)}
                    disabled={streaming}
                    title={skill.description}
                    className="flex min-h-8 items-center gap-1.5 rounded-full border border-ink bg-ink px-2.5 py-1 text-xs font-semibold text-surface transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="text-sm leading-none">{skill.emoji}</span>
                    {skill.name}
                    <X className="h-3 w-3 opacity-70" />
                  </button>
                );
              })}
            </div>
          )}

          {/* Input shell */}
          <div className="relative flex items-end gap-1.5 rounded-2xl border border-line bg-surface p-2 shadow-card transition-colors focus-within:border-ink">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || streaming}
              className="flex h-10 w-10 flex-none items-center justify-center rounded-xl text-muted-2 transition-colors hover:bg-line-soft hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Add attachment"
              title="Add attachment"
            >
              <Paperclip className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setMentionMode('select');
                setSlashOpen(true);
                setSlashQuery('');
                setSlashIndex(0);
              }}
              disabled={streaming}
              title="Select a skill"
              className="flex h-10 flex-none items-center gap-1 rounded-xl px-2.5 text-sm font-semibold text-muted-2 transition-colors hover:bg-line-soft hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Sparkles className="h-4 w-4" />
              Skill
            </button>
            <div className="relative min-w-0 flex-1">
              {!draft && !streaming && (
                <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-base leading-relaxed text-muted-2">
                  {authenticated ? 'Message NeoSpark… use @ to mention a skill or file' : 'Sign in to start chatting…'}
                </span>
              )}
              <div
                ref={editorRef}
                contentEditable={!streaming}
                suppressContentEditableWarning
                onInput={handleEditorInput}
                onKeyDown={handleKeyDown}
                className={cn(
                  'max-h-56 min-h-20 overflow-y-auto whitespace-pre-wrap break-words px-2 py-1.5 text-base leading-relaxed outline-none sm:max-h-72',
                  streaming && 'cursor-not-allowed opacity-60',
                )}
              />
            </div>
            <div className="relative flex-none" ref={modelRef}>
              <button
                type="button"
                onClick={() => setModelOpen((v) => !v)}
                disabled={streaming}
                className="flex h-10 items-center gap-1.5 rounded-xl px-2.5 text-sm font-semibold text-muted-2 transition-colors hover:bg-line-soft hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ModelIcon modelId={model} className="h-4 w-4 flex-none" />
                {modelLabel}
                <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', modelOpen && 'rotate-180')} />
              </button>
              {modelOpen && (
                <div className="absolute bottom-full right-0 z-30 mb-1 w-52 overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-panel">
                  {models.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        onModelChange(m.id);
                        setModelOpen(false);
                      }}
                      className={cn(
                        'flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-semibold transition-colors',
                        model === m.id ? 'bg-line-soft text-ink' : 'text-ink-2 hover:bg-paper',
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <ModelIcon modelId={m.id} className="h-4 w-4 flex-none" />
                        {m.label}
                      </span>
                      {model === m.id && <Check className="h-3.5 w-3.5 flex-none text-orange-ink" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {supportsThinking && (
              <div className="flex flex-none items-center gap-0.5 rounded-xl border border-line bg-surface p-0.5">
                {(['low', 'medium', 'high'] as ThinkingDepth[]).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => onThinkingDepthChange(d)}
                    disabled={streaming}
                    className={cn(
                      'h-8 rounded-lg px-2 text-xs font-semibold capitalize transition-colors',
                      thinkingDepth === d
                        ? 'bg-ink text-surface'
                        : 'text-muted-2 hover:bg-line-soft hover:text-ink',
                      streaming && 'cursor-not-allowed opacity-40',
                    )}
                  >
                    {d}
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={send}
              disabled={(!draft.trim() && attachments.length === 0) || streaming}
              aria-label="Send"
              className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-ink text-surface shadow-[0_1px_2px_rgba(10,10,10,.3),0_8px_18px_-8px_rgba(10,10,10,.5)] transition-transform duration-200 hover:scale-105 disabled:scale-100 disabled:opacity-30"
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

            {/* @ mention menu: skills (and, when typed "@", the attached files) */}
            {slashOpen && (
              <div ref={slashRef} className="absolute bottom-full left-0 right-0 z-30 mb-2 max-h-64 w-full max-w-md overflow-y-auto rounded-xl border border-line bg-surface p-1 shadow-panel sm:left-0 sm:right-auto">
                <div className="flex items-center gap-2 px-2.5 py-2 text-xs font-bold uppercase tracking-[0.14em] text-muted-2">
                  <Search className="h-3.5 w-3.5" />
                  {mentionMode === 'select' ? 'Select a skill' : 'Mention a skill or file'}
                </div>
                {filteredItems.length === 0 ? (
                  <p className="px-2.5 py-2 text-sm text-muted-2">Nothing matches.</p>
                ) : (
                  filteredItems.map((item, i) => {
                    const highlighted = i === slashIndex;

                    if (item.kind === 'attachment') {
                      return (
                        <button
                          key={`att-${item.id}`}
                          type="button"
                          data-item-index={i}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => chooseItem(item)}
                          onMouseEnter={() => setSlashIndex(i)}
                          className={cn(
                            'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors',
                            highlighted ? 'bg-line-soft' : 'hover:bg-paper',
                          )}
                        >
                          {item.mediaType === 'image' ? (
                            <img src={item.url} alt="" className="h-7 w-7 flex-none rounded-md object-cover" />
                          ) : (
                            <FileText className="h-4 w-4 flex-none text-muted-2" />
                          )}
                          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink-2">{item.name}</span>
                          <span className="flex-none rounded-full bg-line-soft px-1.5 py-0.5 text-micro font-bold uppercase tracking-wide text-muted-2">
                            File
                          </span>
                        </button>
                      );
                    }

                    return (
                      <button
                        key={`skill-${item.id}`}
                        type="button"
                        data-item-index={i}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => chooseItem(item)}
                        onMouseEnter={() => setSlashIndex(i)}
                        className={cn(
                          'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors',
                          highlighted ? 'bg-line-soft' : item.active ? 'bg-paper' : 'hover:bg-paper',
                        )}
                      >
                        <span className="text-base leading-none">{item.emoji}</span>
                        <span className="min-w-0 flex-1">
                          <span className={cn('block truncate text-sm font-semibold', item.active ? 'text-ink' : 'text-ink-2')}>
                            {item.name}
                          </span>
                          <span className="block truncate text-xs text-muted-2">{item.description}</span>
                        </span>
                        {item.active && <Check className="h-3.5 w-3.5 flex-none text-orange-ink" />}
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>

          <div className="mt-2 flex items-center justify-between text-xs text-muted-2">
            <span>{authenticated ? 'Enter to send · @ to mention a skill or file' : 'Not signed in — sign in to send'}</span>
            <span>{streaming ? 'Generating…' : contextLabel}</span>
          </div>
        </div>
      </div>
    </main>
  );
}
