import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import {
  BookOpen,
  Check,
  Copy,
  Download,
  ExternalLink,
  ImagePlus,
  Loader2,
  Pencil,
  Search,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import PageShell from '../components/PageShell';
import { useAuth } from '../auth/AuthContext';
import { deleteSkill, downloadSkillBundle, updateSkill, updateSkillImages, updateSkillStatus } from '../lib/api';
import { getFavorites, toggleFavorite } from '../lib/favorites';
import type { Skill } from '../types';
import { cn } from '../lib/utils';

const PLATFORM_BASE = 'https://useneospark.com';

/** Mirrors the backend's client skill name so the toast and file match the zip. */
function clientSkillName(skillId: string): string {
  const slug =
    skillId
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^-|-$/g, '') || 'skill';
  return `neospark-${slug}`;
}

function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'mine' | 'off' }) {
  return (
    <span
      className={cn(
        'flex-none rounded-full px-2 py-0.5 text-micro font-bold uppercase tracking-wide',
        tone === 'mine' && 'bg-yellow/60 text-ink',
        tone === 'off' && 'bg-ink/70 text-surface',
        tone === 'neutral' && 'bg-line-soft text-muted-2',
      )}
    >
      {children}
    </span>
  );
}

/** One-line command with a copy button, used by the install guide. */
function CodeBlock({ code }: { code: string }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success('Command copied');
    } catch {
      toast('Copy failed — select the text and copy it manually');
    }
  };
  return (
    <div className="mt-1.5 flex items-start gap-2 rounded-lg bg-ink px-3 py-2">
      <code className="min-w-0 flex-1 whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed text-surface">
        {code}
      </code>
      <button
        type="button"
        onClick={() => void copy()}
        aria-label="Copy command"
        title="Copy"
        className="flex h-6 w-6 flex-none items-center justify-center rounded-md text-surface/70 transition-colors hover:bg-surface/10 hover:text-surface"
      >
        <Copy className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function GuideStep({ index, title, children }: { index: number; title: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-ink text-[10px] font-bold text-surface">
        {index}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">{title}</p>
        <div className="mt-1 text-xs leading-relaxed text-muted">{children}</div>
      </div>
    </div>
  );
}

export default function SkillsPage({
  onBack,
  onOpenNav,
  skills,
  onSkillsChanged,
}: {
  onBack: () => void;
  onOpenNav: () => void;
  skills: Skill[];
  onSkillsChanged: () => void;
}) {
  const { user, openLogin } = useAuth();
  const [query, setQuery] = useState('');
  const favKey = user ? String(user.id) : 'guest';
  const [favorites, setFavorites] = useState<string[]>(() => getFavorites(favKey));

  useEffect(() => {
    setFavorites(getFavorites(favKey));
  }, [favKey]);

  const starSkill = (id: string) => {
    const next = toggleFavorite(favKey, id);
    setFavorites(next);
    toast(next.includes(id) ? 'Added to favorites' : 'Removed from favorites');
  };

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [guideSkill, setGuideSkill] = useState<Skill | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const myId = user?.id ?? null;
  const isMine = (skill: Skill) => myId != null && skill.ownerId != null && skill.ownerId === myId;
  const canManage = (skill: Skill) => !!user && (!!user.is_admin || isMine(skill));
  const editingSkill = editingId ? skills.find((s) => s.id === editingId) ?? null : null;
  const guideSkillId = guideSkill?.id ?? '<skill-id>';
  const guideSlash = guideSkill ? clientSkillName(guideSkill.id) : 'neospark-<skill>';

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

  // The bundle carries a key scoped to this one Skill plus the Claude Code /
  // Codex config. Every download rotates that key, so the link is fetched live
  // rather than cached.
  const downloadBundle = async (skill: Skill) => {
    if (!user) {
      openLogin();
      return;
    }
    setDownloadingId(skill.id);
    try {
      const blob = await downloadSkillBundle(skill.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${clientSkillName(skill.id)}-skill.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setGuideSkill(skill);
      toast.success(`Downloading ${skill.name} — unzip and run the installer`, {
        action: { label: 'How to install', onClick: () => setGuideOpen(true) },
        duration: 8000,
      });
    } catch {
      toast.error('Could not download the skill');
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <PageShell
      title="Skill"
      onBack={onBack}
      onOpenNav={onOpenNav}
      width="wide"
      actions={
        <a
          href={`${PLATFORM_BASE}/publish/`}
          className="flex min-h-9 items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:border-ink"
        >
          Upload a skill
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      }
    >
      <div>
        <h1 className="text-2xl font-bold tracking-[-0.03em]">Skill market</h1>
        <p className="mt-1 text-sm text-muted">
          Every Skill available in chat. Download one as a Claude Code / Codex skill
          (it calls the Skill's MCP tool); Skills you uploaded — or any skill, for admins —
          can also be edited here.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <div className="relative min-w-[240px] flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-2" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search skills…"
              className="min-h-10 w-full rounded-full border border-line bg-surface py-2 pl-9 pr-3 text-base focus:border-ink sm:text-sm"
            />
          </div>
          <span className="text-xs font-semibold text-muted-2">
            {filtered.length} of {skills.length}
          </span>
          <button
            type="button"
            onClick={() => setGuideOpen(true)}
            className="flex min-h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-bold text-ink transition-colors hover:border-ink"
          >
            <BookOpen className="h-3.5 w-3.5" />
            How to install
          </button>
          {!user && (
            <button type="button" onClick={openLogin} className="min-h-9 rounded-full bg-ink px-3 py-1.5 text-xs font-bold text-surface">
              Sign in to edit
            </button>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-line bg-surface p-10 text-center shadow-card">
            <p className="text-sm text-muted">No skills match “{query}”.</p>
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
                  <button
                    type="button"
                    onClick={() => starSkill(skill.id)}
                    title={favorites.includes(skill.id) ? 'Remove from favorites' : 'Add to favorites'}
                    aria-label={favorites.includes(skill.id) ? 'Remove from favorites' : 'Add to favorites'}
                    aria-pressed={favorites.includes(skill.id)}
                    className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full border border-line bg-surface/90 shadow-card backdrop-blur transition-transform hover:scale-110"
                  >
                    <Star className={cn('h-4 w-4', favorites.includes(skill.id) ? 'fill-yellow text-ink-2' : 'text-muted-2')} />
                  </button>
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <div className="flex items-center gap-2">
                    <h2 className="min-w-0 truncate text-sm font-bold tracking-tight">{skill.name}</h2>
                    <Badge tone={isMine(skill) ? 'mine' : 'neutral'}>
                      {isMine(skill) ? 'Yours' : skill.ownerId ? 'Community' : 'System'}
                    </Badge>
                  </div>
                  <p className="mt-1.5 line-clamp-3 flex-1 text-[12px] leading-relaxed text-muted">{skill.description || 'No description yet.'}</p>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="truncate font-mono text-[10px] text-muted-2">{skill.id}</span>
                    <div className="flex flex-none items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => void downloadBundle(skill)}
                        disabled={downloadingId === skill.id}
                        title="Download a Claude Code / Codex skill that calls this Skill, with a key scoped to it"
                        className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-[11px] font-bold text-ink transition-colors hover:border-ink disabled:opacity-60"
                      >
                        {downloadingId === skill.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Download className="h-3 w-3" />
                        )}
                        Download
                      </button>
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
                <div className="truncate text-sm font-bold tracking-tight">{editingSkill.name}</div>
                <div className="truncate font-mono text-micro text-muted-2">{editingSkill.id}</div>
              </div>
              <Badge tone={isMine(editingSkill) ? 'mine' : 'neutral'}>{isMine(editingSkill) ? 'Yours' : 'Admin'}</Badge>
              <button
                type="button"
                onClick={closeEditor}
                className="flex h-9 w-9 flex-none items-center justify-center rounded-md text-muted-2 transition-colors hover:bg-paper hover:text-ink"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <div>
                <div className="mb-1.5 text-xs font-bold uppercase tracking-[0.12em] text-muted-2">Preview images</div>
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
                    <span className="text-micro font-bold">{uploading ? 'Uploading' : 'Replace'}</span>
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
                <p className="mt-1.5 text-xs text-muted-2">Selecting images replaces the current set; the first one becomes the cover.</p>
              </div>

              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase tracking-[0.12em] text-muted-2">Name</span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="min-h-10 w-full rounded-lg border border-line bg-surface px-3 py-2 text-base font-semibold focus:border-ink sm:text-sm"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase tracking-[0.12em] text-muted-2">Description</span>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={4}
                  className="w-full resize-none rounded-lg border border-line bg-surface px-3 py-2 text-base leading-relaxed focus:border-ink sm:text-sm"
                />
              </label>

              <div className="flex items-center justify-between rounded-lg border border-line px-3 py-2.5">
                <div className="min-w-0">
                  <div className="text-xs font-bold">{active ? 'Enabled' : 'Disabled'}</div>
                  <div className="text-xs text-muted-2">
                    {active ? 'Visible in the market and selectable in chat.' : 'Hidden from everyone except you.'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void toggleActive()}
                  disabled={toggling}
                  className={cn(
                    'flex min-h-9 flex-none items-center gap-1 rounded-full px-3 py-1 text-xs font-bold transition-colors disabled:opacity-60',
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
                className="flex min-h-10 w-full items-center justify-center gap-2 rounded-full bg-ink py-2.5 text-sm font-bold text-surface transition-transform hover:-translate-y-0.5 disabled:opacity-60"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Save changes
              </button>
              {!confirmDelete ? (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="flex min-h-9 w-full items-center justify-center gap-1.5 rounded-full py-1.5 text-xs font-bold text-danger transition-colors hover:bg-danger/5"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete skill
                </button>
              ) : (
                <div className="rounded-xl border border-danger/30 bg-danger/5 p-3">
                  <p className="text-xs font-semibold text-ink">
                    Delete “{editingSkill.name}”? It disappears for every user and cannot be recovered.
                  </p>
                  <div className="mt-2 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="min-h-9 rounded-full px-3 py-1 text-xs font-bold text-muted transition-colors hover:text-ink"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => void removeSkill()}
                      disabled={deleting}
                      className="flex min-h-9 items-center gap-1.5 rounded-full bg-danger px-3 py-1 text-xs font-bold text-surface disabled:opacity-60"
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

      {guideOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close install guide"
            onClick={() => setGuideOpen(false)}
            className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
          />
          <div className="relative z-10 flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-lift">
            <div className="flex items-start gap-3 border-b border-line px-5 py-4">
              <BookOpen className="mt-0.5 h-5 w-5 flex-none text-ink-2" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold tracking-tight">
                  {guideSkill ? `Install ${guideSkill.name}` : 'Install a Skill'}
                </div>
                <p className="mt-0.5 text-xs text-muted">
                  The downloaded package is a Claude Code / Codex skill. It calls this Skill's MCP tool;
                  runs and credits stay on NeoSpark.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setGuideOpen(false)}
                aria-label="Close"
                className="flex h-8 w-8 flex-none items-center justify-center rounded-lg text-muted-2 transition-colors hover:bg-line-soft hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
              <GuideStep index={1} title="Download and unzip the package">
                In the Skill market, click <span className="font-semibold text-ink-2">Download</span> and
                unzip <code className="font-mono text-[11px]">neospark-{guideSkillId}-skill.zip</code>.
              </GuideStep>

              <GuideStep index={2} title="Run the installer in the unzipped folder">
                macOS / Linux / Git Bash:
                <CodeBlock code="./install.sh claude" />
                Windows PowerShell:
                <CodeBlock code=".\\install.ps1 claude" />
                <span className="mt-1.5 block">
                  Drop <code className="font-mono text-[11px]">claude</code> to configure Claude Code and
                  Codex at once. The script copies the skill to the client's skills folder, writes the MCP
                  config and runs a self-check.
                </span>
              </GuideStep>

              <GuideStep index={3} title="Restart Claude Code, then use the skill">
                MCP servers and skills load on start, so open a new session first.
                <CodeBlock code={`/${guideSlash} <your request>`} />
              </GuideStep>

              <GuideStep index={4} title="Check the connection">
                <code className="font-mono text-[11px]">claude mcp list</code> should show{' '}
                <code className="font-mono text-[11px]">{guideSkillId}</code> as connected; inside a
                session, <code className="font-mono text-[11px]">/mcp</code> lists one tool.
              </GuideStep>

              <details className="rounded-xl border border-line bg-paper/60 px-4 py-3">
                <summary className="cursor-pointer text-xs font-bold text-ink-2">
                  Manual install (no script)
                </summary>
                <div className="mt-2 space-y-2 text-xs leading-relaxed text-muted">
                  <p>
                    Copy the package's <code className="font-mono text-[11px]">skill/</code> folder to{' '}
                    <code className="font-mono text-[11px]">~/.claude/skills/{guideSlash}/</code>, then add
                    the MCP server (the key is in <code className="font-mono text-[11px]">claude.mcp.json</code>):
                  </p>
                  <CodeBlock
                    code={`claude mcp add --transport http ${guideSkillId} https://api.useneospark.com/mcp/${guideSkillId} --header "Authorization: Bearer <nsk_key>" --scope user`}
                  />
                </div>
              </details>

              <p className="rounded-xl bg-line-soft/60 px-4 py-3 text-xs leading-relaxed text-muted">
                Each call spends the signed-in user's NeoSpark credits. Re-downloading a Skill rotates its
                key and invalidates the old package, so reinstall if a previously working setup suddenly
                gets 401s.
              </p>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
