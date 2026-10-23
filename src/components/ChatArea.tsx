import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUp, Check, ChevronDown, FileText, Loader2, Paperclip, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import type { Attachment, Message as ChatMessage, ModelOption, Skill } from '../types';
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
  authenticated: boolean;
  onRequestLogin: () => void;
  skills: Skill[];
  selectedSkills: string[];
  onToggleSkill: (id: string) => void;
  models: ModelOption[];
  model: string;
  onModelChange: (id: string) => void;
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
  loadingHistory,
  draft,
  onDraftChange,
  onSend,
  onConfirmSelect,
  authenticated,
  onRequestLogin,
  skills,
  selectedSkills,
  onToggleSkill,
  models,
  model,
  onModelChange,
}: ChatAreaProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modelRef = useRef<HTMLDivElement>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState('');
  const [slashIndex, setSlashIndex] = useState(0);
  const [mentionMode, setMentionMode] = useState<'select' | 'mention'>('select');
  const slashRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  // Sync an externally-set draft (jump-in from the marketing site) into the editor.
  useEffect(() => {
    const el = editorRef.current;
    if (el && draft && el.innerText !== draft) {
      el.innerText = draft;
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
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
        setSlashOpen(false);
        setSlashQuery('');
        const trigger = mentionMode === 'mention' ? '@' : '/';
        const idx = draft.lastIndexOf(trigger);
        if (idx >= 0) onDraftChange(draft.slice(0, idx).trimEnd());
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [slashOpen, draft, mentionMode, onDraftChange]);

  useEffect(() => {
    if (!slashOpen) return;
    const el = slashRef.current?.querySelector(`[data-skill-index="${slashIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [slashIndex, slashOpen]);

  const modelLabel = model ? models.find((m) => m.id === model)?.label ?? model : 'Model';

  const filteredSkills = useMemo(() => {
    const q = slashQuery.trim().toLowerCase();
    return skills.filter((s) => !q || s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q));
  }, [skills, slashQuery]);

  const removeTriggerText = (trigger: string) => {
    const el = editorRef.current;
    if (!el) return;
    const text = el.innerText;
    const idx = text.lastIndexOf(trigger);
    if (idx < 0) return;
    const next = text.slice(0, idx).trimEnd();
    el.innerText = next;
    onDraftChange(next);
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    sel?.removeAllRanges();
    sel?.addRange(range);
  };

  const insertMention = (skill: Skill) => {
    const el = editorRef.current;
    if (!el) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const node = range.startContainer;
    if (!(node instanceof Text)) return;
    const before = node.textContent || '';
    const offset = range.startOffset;
    const atIdx = before.lastIndexOf('@', offset - 1);
    const slashIdx = before.lastIndexOf('/', offset - 1);
    const triggerIdx = Math.max(atIdx, slashIdx);
    if (triggerIdx < 0) return;

    range.setStart(node, triggerIdx);
    range.setEnd(node, offset);
    range.deleteContents();

    const chip = document.createElement('span');
    chip.contentEditable = 'false';
    chip.className = 'mention-chip';
    chip.textContent = `@${skill.name}`;
    const space = document.createTextNode(' ');
    range.insertNode(space);
    range.insertNode(chip);
    range.setStartAfter(space);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);

    onDraftChange(el.innerText || '');
  };

  const closeSlash = (skillId?: string) => {
    if (skillId) {
      const skill = skills.find((s) => s.id === skillId);
      if (mentionMode === 'mention' && skill) {
        insertMention(skill);
      } else {
        onToggleSkill(skillId);
        removeTriggerText('/');
      }
    } else if (mentionMode === 'select') {
      removeTriggerText('/');
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
      const slashIdx = before.lastIndexOf('/');
      const triggerIdx = Math.max(atIdx, slashIdx);
      if (triggerIdx >= 0) {
        const trigger = before[triggerIdx];
        setMentionMode(trigger === '@' ? 'mention' : 'select');
        setSlashQuery(before.slice(triggerIdx + 1));
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
    onSend(text, attachments);
    setAttachments([]);
    if (editorRef.current) editorRef.current.innerText = '';
    onDraftChange('');
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (slashOpen) {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeSlash();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlashIndex((i) => Math.min(i + 1, filteredSkills.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const skill = filteredSkills[slashIndex];
        if (skill) closeSlash(skill.id);
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
    if (e.key === '/') {
      setMentionMode('select');
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
        {loadingHistory ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-2" />
          </div>
        ) : messages.length === 0 ? (
          <div className="mx-auto flex max-w-2xl flex-col items-center pt-[10vh] text-center">
            <Eyebrow>NeoSpark Conversation</Eyebrow>
            <h1 className="mt-6 text-[2rem] font-bold leading-[1.15] tracking-[-0.03em]">
              One conversation, all your Skills
            </h1>
            <p className="mt-3 max-w-md text-[15px] leading-relaxed text-muted">
              Pick one or more skills and a model below the input, then describe the result you want.
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
              <Message key={m.id} message={m} onConfirmSelect={onConfirmSelect} disabled={streaming} />
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

        <div className="mx-auto max-w-3xl">
          {/* Skill + model row */}
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
                  className="flex items-center gap-1.5 rounded-full border border-ink bg-ink px-2.5 py-1 text-[12px] font-semibold text-surface transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="text-[13px] leading-none">{skill.emoji}</span>
                  {skill.name}
                  <X className="h-3 w-3 opacity-70" />
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => {
                setSlashOpen(true);
                setSlashQuery('');
                editorRef.current?.focus();
              }}
              disabled={streaming}
              title="Add a skill"
              className="flex items-center gap-1 rounded-full border border-dashed border-line px-2.5 py-1 text-[12px] font-semibold text-muted transition-colors hover:border-ink hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="text-[13px] leading-none">+</span>
              Skill
            </button>

            <div className="relative ml-auto" ref={modelRef}>
              <button
                type="button"
                onClick={() => setModelOpen((v) => !v)}
                disabled={streaming}
                className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-[12px] font-semibold text-ink-2 transition-colors hover:border-ink disabled:cursor-not-allowed disabled:opacity-50"
              >
                {modelLabel}
                <ChevronDown className={cn('h-3.5 w-3.5 text-muted-2 transition-transform', modelOpen && 'rotate-180')} />
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
                        'flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] font-semibold transition-colors',
                        model === m.id ? 'bg-line-soft text-ink' : 'text-ink-2 hover:bg-paper',
                      )}
                    >
                      {m.label}
                      {model === m.id && <Check className="h-3.5 w-3.5 flex-none text-orange-deep" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Input shell */}
          <div className="relative flex items-end gap-1.5 rounded-2xl border border-line bg-surface p-2 shadow-card">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || streaming}
              className="flex h-9 w-9 flex-none items-center justify-center rounded-xl text-muted-2 transition-colors hover:bg-line-soft hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Add attachment"
              title="Add attachment"
            >
              <Paperclip className="h-4 w-4" />
            </button>
            <div className="relative min-w-0 flex-1">
              {!draft && !streaming && (
                <span className="pointer-events-none absolute left-2 top-1.5 text-[0.95rem] leading-relaxed text-muted-2">
                  {authenticated ? 'Message NeoSpark… use @ to mention a skill' : 'Sign in to start chatting…'}
                </span>
              )}
              <div
                ref={editorRef}
                contentEditable={!streaming}
                suppressContentEditableWarning
                onInput={handleEditorInput}
                onKeyDown={handleKeyDown}
                className={cn(
                  'max-h-[180px] min-h-[24px] overflow-y-auto whitespace-pre-wrap break-words px-2 py-1.5 text-[0.95rem] leading-relaxed outline-none',
                  streaming && 'cursor-not-allowed opacity-60',
                )}
              />
            </div>
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

            {/* Slash skill menu */}
            {slashOpen && (
              <div ref={slashRef} className="absolute bottom-full left-0 right-0 z-30 mb-1 max-h-64 overflow-y-auto rounded-xl border border-line bg-surface p-1 shadow-panel">
                <div className="flex items-center gap-2 px-2.5 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-2">
                  <Search className="h-3.5 w-3.5" />
                  Select a skill
                </div>
                {filteredSkills.length === 0 ? (
                  <p className="px-2.5 py-2 text-[13px] text-muted-2">No skills match.</p>
                ) : (
                  filteredSkills.map((skill, i) => {
                    const active = selectedSkills.includes(skill.id);
                    const highlighted = i === slashIndex;
                    return (
                      <button
                        key={skill.id}
                        type="button"
                        data-skill-index={i}
                        onClick={() => closeSlash(skill.id)}
                        onMouseEnter={() => setSlashIndex(i)}
                        className={cn(
                          'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors',
                          highlighted ? 'bg-line-soft' : active ? 'bg-paper' : 'hover:bg-paper',
                        )}
                      >
                        <span className="text-[15px] leading-none">{skill.emoji}</span>
                        <span className="min-w-0 flex-1">
                          <span className={cn('block truncate text-[13px] font-semibold', active ? 'text-ink' : 'text-ink-2')}>
                            {skill.name}
                          </span>
                          <span className="block truncate text-[11px] text-muted-2">{skill.description}</span>
                        </span>
                        {active && <Check className="h-3.5 w-3.5 flex-none text-orange-deep" />}
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>

          <div className="mt-2 flex items-center justify-between text-[11px] text-muted-2">
            <span>{authenticated ? 'Enter to send · / to pick a skill · @ to mention' : 'Not signed in — sign in to send'}</span>
            <span>{streaming ? 'Generating…' : contextLabel}</span>
          </div>
        </div>
      </div>
    </main>
  );
}
