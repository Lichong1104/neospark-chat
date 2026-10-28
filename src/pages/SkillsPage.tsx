import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Check,
  ExternalLink,
  ImagePlus,
  Loader2,
  Pencil,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { deleteSkill, updateSkill, updateSkillImages, updateSkillStatus } from '../lib/api';
import type { Skill } from '../types';
import { cn } from '../lib/utils';

const PLATFORM_BASE = 'https://platform.useneospark.com';

function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'mine' | 'off' }) {
  return (
    <span
      className={cn(
        'flex-none rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
        tone === 'mine' && 'bg-yellow/60 text-ink',
        tone === 'off' && 'bg-orange/15 text-orange-deep',
        tone === 'neutral' && 'bg-line-soft text-muted-2',
      )}
    >
      {children}
    </span>
  );
}

export default function SkillsPage({
  onBack,
  skills,
  onSkillsChanged,
}: {
  onBack: () => void;
  skills: Skill[];
  onSkillsChanged: () => void;
}) {
  const { user, openLogin } = useAuth();
  const [query, setQuery] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const myId = user?.id ?? null;
  const isMine = (skill: Skill) => myId != null && skill.ownerId != null && skill.ownerId === myId;
  const canManage = (skill: Skill) => !!user && (!!user.is_admin || isMine(skill));
  const editingSkill = editingId ? skills.find((s) => s.id === editingId) ?? null : null;

  // Mine first, then system skills, then everyone else's uploads.
  const ordered = useMemo(() => {
    const rank = (s: Skill) => (myId != null && s.ownerId === myId ? 0 : s.ownerId == null ? 1 : 2);
    return [...skills].sort((a, b) => rank(a) - rank(b));
  }, [skills, myId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ordered;
    return ordered.filter(
      (s) => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q) || s.id.includes(q),
    );
  }, [ordered, query]);

  const openEditor = (skill: Skill) => {
    setName(skill.name);
    setDescription(skill.description ?? '');
    setActive(skill.isActive ?? true);
    setConfirmDelete(false);
    setEditingId(skill.id);
  };

  const closeEditor = () => {
    setEditingId(null);
    setConfirmDelete(false);
  };

  useEffect(() => {
    if (!editingId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeEditor();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [editingId]);

  const saveEdits = async () => {
    if (!editingSkill) return;
    const nextName = name.trim();
    if (!nextName) {
      toast.error('Skill name cannot be empty');
      return;
    }
    setSaving(true);
    try {
      await updateSkill(editingSkill.id, { name: nextName, description: description.trim() });
      toast.success('Skill updated');
      onSkillsChanged();
      closeEditor();
    } catch {
      toast.error('Could not save the skill');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async () => {
    if (!editingSkill) return;
    setToggling(true);
    try {
      await updateSkillStatus(editingSkill.id, !active);
      setActive((v) => !v);
      toast.success(active ? 'Skill disabled' : 'Skill enabled');
      onSkillsChanged();
    } catch {
      toast.error('Could not change the skill status');
    } finally {
      setToggling(false);
    }
  };

  const uploadImages = async (files: File[]) => {
    if (!editingSkill || files.length === 0) return;
    setUploading(true);
    try {
      await updateSkillImages(editingSkill.id, files);
      toast.success('Preview images updated');
      onSkillsChanged();
    } catch {
      toast.error('Could not upload the preview images');
    } finally {
      setUploading(false);
    }
  };

  const removeSkill = async () => {
    if (!editingSkill) return;
    setDeleting(true);
    try {
      await deleteSkill(editingSkill.id);
      toast.success('Skill deleted');
      closeEditor();
      onSkillsChanged();
    } catch {
      toast.error('Could not delete the skill');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <main className="flex h-full min-w-0 flex-1 flex-col overflow-y-auto">
      <header className="flex items-center gap-3 border-b border-line bg-surface/70 px-6 py-3 backdrop-blur">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-semibold text-muted transition-colors hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to chat
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold tracking-tight">Skill</div>
        </div>
        <a
          href={`${PLATFORM_BASE}/skills`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-[12px] font-semibold text-ink transition-colors hover:border-ink"
        >
          Upload a skill
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </header>

      <div className="mx-auto w-full max-w-5xl px-6 py-8">
        <h1 className="text-[1.5rem] font-bold tracking-[-0.03em]">Skill market</h1>
        <p className="mt-1 text-[14px] text-muted">
          Every Skill available in chat. Skills you uploaded — or any skill, for admins — can be edited here.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <div className="relative min-w-[240px] flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-2" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search skills…"
              className="w-full rounded-full border border-line bg-surface py-2 pl-9 pr-3 text-[13px] outline-none focus:border-ink"
            />
          </div>
          <span className="text-[12px] font-semibold text-muted-2">
            {filtered.length} of {skills.length}
          </span>
          {!user && (
            <button type="button" onClick={openLogin} className="rounded-full bg-ink px-3 py-1.5 text-[12px] font-bold text-surface">
              Sign in to edit
            </button>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-line bg-surface p-10 text-center shadow-card">
            <p className="text-[14px] text-muted">No skills match “{query}”.</p>
          </div>
        ) : (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((skill) => (
              <article
                key={skill.id}
                className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-card transition-shadow hover:shadow-lift"
              >
                <div className="relative h-32 w-full overflow-hidden bg-line-soft">
                  {skill.preview ? (
                    <img src={skill.preview} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-4xl">{skill.emoji ?? '⚙️'}</div>
                  )}
                  {skill.isActive === false && (
                    <span className="absolute left-2 top-2">
                      <Badge tone="off">Disabled</Badge>
                    </span>
                  )}
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <div className="flex items-center gap-2">
                    <h2 className="min-w-0 truncate text-[14px] font-bold tracking-tight">{skill.name}</h2>
                    <Badge tone={isMine(skill) ? 'mine' : 'neutral'}>
                      {isMine(skill) ? 'Yours' : skill.ownerId ? 'Community' : 'System'}
                    </Badge>
                  </div>
                  <p className="mt-1.5 line-clamp-3 flex-1 text-[12px] leading-relaxed text-muted">{skill.description || 'No description yet.'}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="font-mono text-[10px] text-muted-2">{skill.id}</span>
                    {canManage(skill) ? (
                      <button
                        type="button"
                        onClick={() => openEditor(skill)}
                        className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-[11px] font-bold text-ink transition-colors hover:border-ink"
                      >
                        <Pencil className="h-3 w-3" />
                        Edit
                      </button>
                    ) : (
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-2">Read only</span>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {/* Editor dialog */}
      {editingSkill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" aria-label="Close" className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={closeEditor} />
          <div className="relative flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-surface shadow-panel" role="dialog" aria-modal="true">
            <div className="flex items-center gap-2 border-b border-line-soft px-5 py-3.5">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-bold tracking-tight">{editingSkill.name}</div>
                <div className="truncate font-mono text-[10px] text-muted-2">{editingSkill.id}</div>
              </div>
              <Badge tone={isMine(editingSkill) ? 'mine' : 'neutral'}>{isMine(editingSkill) ? 'Yours' : 'Admin'}</Badge>
              <button
                type="button"
                onClick={closeEditor}
                className="rounded-md p-1 text-muted-2 transition-colors hover:bg-paper hover:text-ink"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <div>
                <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-2">Preview images</div>
                <div className="flex flex-wrap items-center gap-2">
                  {(editingSkill.previews ?? []).map((src) => (
                    <img key={src} src={src} alt="" className="h-16 w-24 rounded-lg border border-line object-cover" />
                  ))}
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    disabled={uploading}
                    className="flex h-16 w-24 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-line text-muted-2 transition-colors hover:border-ink hover:text-ink disabled:opacity-60"
                  >
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                    <span className="text-[10px] font-bold">{uploading ? 'Uploading' : 'Replace'}</span>
                  </button>
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(event) => {
                      const files = Array.from(event.target.files ?? []);
                      event.target.value = '';
                      void uploadImages(files);
                    }}
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-muted-2">Selecting images replaces the current set; the first one becomes the cover.</p>
              </div>

              <label className="block">
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.12em] text-muted-2">Name</span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-[13px] font-semibold outline-none focus:border-ink"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.12em] text-muted-2">Description</span>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={4}
                  className="w-full resize-none rounded-lg border border-line bg-surface px-3 py-2 text-[13px] leading-relaxed outline-none focus:border-ink"
                />
              </label>

              <div className="flex items-center justify-between rounded-lg border border-line px-3 py-2.5">
                <div className="min-w-0">
                  <div className="text-[12px] font-bold">{active ? 'Enabled' : 'Disabled'}</div>
                  <div className="text-[11px] text-muted-2">
                    {active ? 'Visible in the market and selectable in chat.' : 'Hidden from everyone except you.'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void toggleActive()}
                  disabled={toggling}
                  className={cn(
                    'flex flex-none items-center gap-1 rounded-full px-3 py-1 text-[11px] font-bold transition-colors disabled:opacity-60',
                    active ? 'bg-line-soft text-ink' : 'bg-ink text-surface',
                  )}
                >
                  {toggling ? <Loader2 className="h-3 w-3 animate-spin" /> : active ? null : <Check className="h-3 w-3" />}
                  {active ? 'Disable' : 'Enable'}
                </button>
              </div>
            </div>

            <div className="space-y-2 border-t border-line-soft px-5 py-3">
              <button
                type="button"
                onClick={() => void saveEdits()}
                disabled={saving}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-ink py-2.5 text-[13px] font-bold text-surface transition-transform hover:-translate-y-0.5 disabled:opacity-60"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Save changes
              </button>
              {!confirmDelete ? (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-full py-1.5 text-[12px] font-bold text-orange-dark transition-colors hover:bg-orange/5"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete skill
                </button>
              ) : (
                <div className="rounded-xl border border-orange/40 bg-orange/5 p-3">
                  <p className="text-[12px] font-semibold text-ink">
                    Delete “{editingSkill.name}”? It disappears for every user and cannot be recovered.
                  </p>
                  <div className="mt-2 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="rounded-full px-3 py-1 text-[11px] font-bold text-muted transition-colors hover:text-ink"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => void removeSkill()}
                      disabled={deleting}
                      className="flex items-center gap-1.5 rounded-full bg-orange-dark px-3 py-1 text-[11px] font-bold text-surface disabled:opacity-60"
                    >
                      {deleting && <Loader2 className="h-3 w-3 animate-spin" />}
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
