import { useEffect, useRef, useState } from 'react';
import type { ComponentType, ReactNode } from 'react';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Coins,
  CreditCard,
  ExternalLink,
  ImagePlus,
  KeyRound,
  Loader2,
  LogOut,
  Pencil,
  Shield,
  Tag,
  Trash2,
  User as UserIcon,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import {
  deleteSkill,
  getBalance,
  getBillingState,
  updateSkill,
  updateSkillImages,
  updateSkillStatus,
} from '../lib/api';
import type { BalanceInfo, BillingState, Skill } from '../types';
import { cn } from '../lib/utils';

const PLATFORM_BASE = 'https://platform.useneospark.com';

type Tab = 'user' | 'skills';

interface UserMenuProps {
  collapsed: boolean;
  skills: Skill[];
  onSkillsChanged: () => void;
  onNavigate: (view: 'chat' | 'pricing' | 'balance' | 'subscription') => void;
}

/** A single row in the account list. `href` renders an external link instead of a button. */
function MenuRow({
  icon: Icon,
  label,
  hint,
  onClick,
  href,
  danger,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  hint?: string;
  onClick?: () => void;
  href?: string;
  danger?: boolean;
}) {
  const className = cn(
    'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-paper',
    danger ? 'text-orange-dark' : 'text-ink-2',
  );
  const content = (
    <>
      <Icon className="h-4 w-4 flex-none" />
      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{label}</span>
      {hint && <span className="flex-none truncate text-[11px] text-muted-2">{hint}</span>}
      {href && <ExternalLink className="h-3.5 w-3.5 flex-none text-muted-2" />}
    </>
  );

  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={className} onClick={onClick}>
        {content}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  );
}

function SkillBadge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'mine' | 'off' }) {
  return (
    <span
      className={cn(
        'flex-none rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide',
        tone === 'mine' && 'bg-yellow/60 text-ink',
        tone === 'off' && 'bg-orange/15 text-orange-deep',
        tone === 'neutral' && 'bg-line-soft text-muted-2',
      )}
    >
      {children}
    </span>
  );
}

/**
 * Bottom-left account menu. One click opens two lists: the account list (profile,
 * credits, platform links, sign out) and the Skill market, where a skill the user
 * owns — or any skill, for admins — can be renamed, re-described, disabled,
 * re-imaged and deleted without leaving the chat.
 */
export default function UserMenu({ collapsed, skills, onSkillsChanged, onNavigate }: UserMenuProps) {
  const { user, isLoading, openLogin, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('user');
  const [balance, setBalance] = useState<BalanceInfo | null>(null);
  const [billing, setBilling] = useState<BillingState | null>(null);
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  // Skill editor state
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

  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) {
      setBalance(null);
      setBilling(null);
      return;
    }
    getBalance().then(setBalance).catch(() => {});
    getBillingState().then(setBilling).catch(() => {});
  }, [user]);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const close = () => {
    setOpen(false);
    setEditingId(null);
    setConfirmDelete(false);
    setConfirmSignOut(false);
  };

  const editingSkill = editingId ? skills.find((s) => s.id === editingId) ?? null : null;
  const myId = user?.id ?? null;
  const isMine = (skill: Skill) => myId != null && skill.ownerId != null && skill.ownerId === myId;
  const canManage = (skill: Skill) => !!user && (!!user.is_admin || isMine(skill));

  // Mine first, then system skills, then everyone else's uploads.
  const orderedSkills = [...skills].sort((a, b) => {
    const rank = (s: Skill) => (isMine(s) ? 0 : s.ownerId == null ? 1 : 2);
    return rank(a) - rank(b);
  });

  const planLabel = billing?.subscription?.planKey;
  const credits = balance ? balance.available_points : user?.balance ?? 0;

  const openEditor = (skill: Skill) => {
    setName(skill.name);
    setDescription(skill.description ?? '');
    setActive(skill.isActive ?? true);
    setConfirmDelete(false);
    setEditingId(skill.id);
  };

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
      setEditingId(null);
      setConfirmDelete(false);
      onSkillsChanged();
    } catch {
      toast.error('Could not delete the skill');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      {user ? (
        <button
          type="button"
          onClick={() => (open ? close() : setOpen(true))}
          aria-expanded={open}
          aria-haspopup="menu"
          title={collapsed ? user.name || user.email : undefined}
          className={cn(
            'flex w-full items-center gap-2.5 rounded-xl px-1.5 py-1.5 text-left transition-colors hover:bg-line-soft',
            collapsed && 'justify-center px-0',
            open && 'bg-line-soft',
          )}
        >
          {user.avatar_url ? (
            <img src={user.avatar_url} alt="" referrerPolicy="no-referrer" className="h-8 w-8 flex-none rounded-full object-cover" />
          ) : (
            <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-orange/15 text-sm font-bold text-orange-deep">
              {(user.name || user.email)[0]?.toUpperCase() ?? <UserIcon className="h-4 w-4" />}
            </div>
          )}
          {!collapsed && (
            <>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold leading-tight">{user.name || user.email}</div>
                <div className="truncate text-[11px] text-muted-2">
                  {planLabel ? <span className="capitalize">{planLabel}</span> : 'Free'}
                  {' · '}
                  {credits.toLocaleString('en-US')} credits
                </div>
              </div>
              {open ? (
                <ChevronDown className="h-4 w-4 flex-none text-muted-2" />
              ) : (
                <ChevronUp className="h-4 w-4 flex-none text-muted-2" />
              )}
            </>
          )}
        </button>
      ) : (
        <button
          type="button"
          onClick={openLogin}
          disabled={isLoading}
          title={collapsed ? 'Sign in' : undefined}
          className={cn('flex w-full items-center justify-center gap-2 rounded-full border border-ink py-2.5 text-sm font-semibold transition-colors hover:bg-ink hover:text-surface', collapsed && 'px-0')}
        >
          <UserIcon className="h-4 w-4" />
          {!collapsed && (isLoading ? 'Loading…' : 'Sign in')}
        </button>
      )}

      {open && user && (
        <div
          className="absolute bottom-full left-0 z-50 mb-2 flex max-h-[min(78vh,620px)] w-[380px] max-w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-panel"
        >
          {/* Identity */}
          <div className="flex items-center gap-3 border-b border-line-soft px-4 py-3.5">
            {user.avatar_url ? (
              <img src={user.avatar_url} alt="" referrerPolicy="no-referrer" className="h-10 w-10 flex-none rounded-full object-cover" />
            ) : (
              <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-orange/15 text-base font-bold text-orange-deep">
                {(user.name || user.email)[0]?.toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] font-bold leading-tight">{user.name || 'NeoSpark user'}</div>
              <div className="truncate text-[11px] text-muted-2">{user.email}</div>
            </div>
            <span className="flex-none rounded-full bg-line-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted">
              {planLabel ? planLabel : 'Free'}
            </span>
          </div>

          {/* Two lists */}
          <div className="flex gap-1 border-b border-line-soft px-2 py-1.5">
            {(['user', 'skills'] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setTab(key);
                  setEditingId(null);
                }}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px] font-bold transition-colors',
                  tab === key ? 'bg-ink text-surface' : 'text-muted hover:bg-paper hover:text-ink',
                )}
              >
                {key === 'user' ? <UserIcon className="h-3.5 w-3.5" /> : <Tag className="h-3.5 w-3.5" />}
                {key === 'user' ? 'User' : 'Skill market'}
                {key === 'skills' && <span className="text-[10px] font-bold opacity-70">{skills.length}</span>}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {tab === 'user' ? (
              <div className="p-2">
                {/* Credits */}
                <div className="mb-1 rounded-xl border border-line bg-paper px-3 py-2.5">
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.14em] text-muted-2">
                    <span>Credits</span>
                    <span>{planLabel ? 'Subscriber' : 'Pay as you go'}</span>
                  </div>
                  <div className="mt-1 flex items-end justify-between gap-2">
                    <span className="text-[22px] font-bold leading-none">{credits.toLocaleString('en-US')}</span>
                    <button
                      type="button"
                      onClick={() => {
                        close();
                        onNavigate('pricing');
                      }}
                      className="rounded-full bg-ink px-3 py-1 text-[11px] font-bold text-surface transition-transform hover:-translate-y-0.5"
                    >
                      Top up
                    </button>
                  </div>
                </div>

                <div className="space-y-0.5">
                  <MenuRow
                    icon={Coins}
                    label="Balance & usage"
                    onClick={() => {
                      close();
                      onNavigate('balance');
                    }}
                  />
                  <MenuRow
                    icon={CreditCard}
                    label="Subscription"
                    hint={planLabel ?? undefined}
                    onClick={() => {
                      close();
                      onNavigate('subscription');
                    }}
                  />
                  <MenuRow
                    icon={Tag}
                    label="Pricing & plans"
                    onClick={() => {
                      close();
                      onNavigate('pricing');
                    }}
                  />
                  <MenuRow icon={UserIcon} label="Account center" href={`${PLATFORM_BASE}/account`} onClick={close} />
                  <MenuRow icon={KeyRound} label="API keys" href={`${PLATFORM_BASE}/api-keys`} onClick={close} />
                  <MenuRow icon={Tag} label="Skill market & uploads" href={`${PLATFORM_BASE}/skills`} onClick={close} />
                  {user.is_admin && (
                    <MenuRow icon={Shield} label="Admin console" href={`${PLATFORM_BASE}/admin`} onClick={close} />
                  )}
                </div>

                <div className="my-1.5 h-px bg-line-soft" />

                {!confirmSignOut ? (
                  <MenuRow icon={LogOut} label="Sign out" danger onClick={() => setConfirmSignOut(true)} />
                ) : (
                  <div className="rounded-xl border border-orange/40 bg-orange/5 p-2.5">
                    <p className="text-[12px] font-semibold text-ink">Sign out of this device?</p>
                    <div className="mt-2 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmSignOut(false)}
                        className="rounded-full px-3 py-1 text-[11px] font-bold text-muted transition-colors hover:text-ink"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmSignOut(false);
                          close();
                          void signOut();
                        }}
                        className="rounded-full bg-orange-dark px-3 py-1 text-[11px] font-bold text-surface"
                      >
                        Sign out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : editingSkill ? (
              /* ---- Skill editor ---- */
              <div className="p-2">
                <div className="flex items-center gap-1.5 px-1 py-1">
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="rounded-md p-1 text-muted-2 transition-colors hover:bg-paper hover:text-ink"
                    title="Back to the list"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-muted-2">Edit skill</span>
                  <span className="min-w-0 flex-1" />
                  <SkillBadge tone="mine">{isMine(editingSkill) ? 'Yours' : 'Admin'}</SkillBadge>
                </div>

                <div className="space-y-3 px-1 pb-2 pt-1">
                  {/* Preview images */}
                  <div>
                    <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-2">Preview images</div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {(editingSkill.previews ?? []).map((src) => (
                        <img key={src} src={src} alt="" className="h-12 w-16 rounded-lg border border-line object-cover" />
                      ))}
                      <button
                        type="button"
                        onClick={() => imageInputRef.current?.click()}
                        disabled={uploading}
                        className="flex h-12 w-16 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-line text-muted-2 transition-colors hover:border-ink hover:text-ink disabled:opacity-60"
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
                    <p className="mt-1 text-[10px] text-muted-2">
                      Selecting images replaces the current set; the first one becomes the cover.
                    </p>
                  </div>

                  <label className="block">
                    <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.12em] text-muted-2">Name</span>
                    <input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[13px] font-semibold outline-none focus:border-ink"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.12em] text-muted-2">Description</span>
                    <textarea
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      rows={3}
                      className="w-full resize-none rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[13px] leading-relaxed outline-none focus:border-ink"
                    />
                  </label>

                  <div className="flex items-center justify-between rounded-lg border border-line px-2.5 py-2">
                    <div className="min-w-0">
                      <div className="text-[12px] font-bold">{active ? 'Enabled' : 'Disabled'}</div>
                      <div className="text-[10px] text-muted-2">
                        {active ? 'Visible in the market and selectable in chat.' : 'Hidden from everyone except you.'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void toggleActive()}
                      disabled={toggling}
                      className={cn(
                        'flex flex-none items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors disabled:opacity-60',
                        active ? 'bg-line-soft text-ink' : 'bg-ink text-surface',
                      )}
                    >
                      {toggling ? <Loader2 className="h-3 w-3 animate-spin" /> : active ? null : <Check className="h-3 w-3" />}
                      {active ? 'Disable' : 'Enable'}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => void saveEdits()}
                    disabled={saving}
                    className="flex w-full items-center justify-center gap-2 rounded-full bg-ink py-2 text-[13px] font-bold text-surface transition-transform hover:-translate-y-0.5 disabled:opacity-60"
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
                    <div className="rounded-xl border border-orange/40 bg-orange/5 p-2.5">
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
            ) : (
              /* ---- Skill list ---- */
              <div className="p-2">
                {orderedSkills.length === 0 ? (
                  <p className="px-2.5 py-3 text-[13px] text-muted-2">No skills yet.</p>
                ) : (
                  orderedSkills.map((skill) => (
                    <div
                      key={skill.id}
                      className="flex items-start gap-2.5 rounded-xl px-2 py-2 transition-colors hover:bg-paper"
                    >
                      {skill.preview ? (
                        <img src={skill.preview} alt="" className="h-8 w-8 flex-none rounded-lg border border-line object-cover" />
                      ) : (
                        <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-line-soft text-[15px] leading-none">
                          {skill.emoji ?? '⚙️'}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="min-w-0 truncate text-[13px] font-semibold">{skill.name}</span>
                          <SkillBadge tone={isMine(skill) ? 'mine' : 'neutral'}>
                            {isMine(skill) ? 'Yours' : skill.ownerId ? 'Community' : 'System'}
                          </SkillBadge>
                          {skill.isActive === false && <SkillBadge tone="off">Off</SkillBadge>}
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-2">
                          {skill.description || 'No description yet.'}
                        </p>
                      </div>
                      {canManage(skill) ? (
                        <button
                          type="button"
                          onClick={() => openEditor(skill)}
                          className="flex flex-none items-center gap-1 rounded-full border border-line px-2 py-1 text-[11px] font-bold text-ink transition-colors hover:border-ink"
                        >
                          <Pencil className="h-3 w-3" />
                          Edit
                        </button>
                      ) : (
                        <span className="flex-none px-1 pt-1 text-[10px] font-semibold text-muted-2">Read only</span>
                      )}
                    </div>
                  ))
                )}

                <a
                  href={`${PLATFORM_BASE}/skills`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-[11px] font-bold text-muted transition-colors hover:bg-paper hover:text-ink"
                >
                  Upload or submit a skill
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
