import { useEffect, useState } from 'react';
import { ExternalLink, PackageOpen, Star, Store } from 'lucide-react';
import { toast } from 'sonner';
import PageShell from '../components/PageShell';
import { useAuth } from '../auth/AuthContext';
import { getFavorites, toggleFavorite } from '../lib/favorites';
import type { Skill, View } from '../types';
import { cn } from '../lib/utils';

const PLATFORM_BASE = 'https://useneospark.com';

type TabKey = 'favorites' | 'published' | 'purchased';

/* Badge tints mirrored from the skillhub catalogue (global.css .tag-*). */
const TAG_TONES = {
  yours: 'bg-[rgba(255,246,205,.94)] text-[#6f5600]',
  community: 'bg-[rgba(243,232,250,.94)] text-[#6f3d92]',
  system: 'bg-surface/90 text-muted',
  off: 'bg-[rgba(255,231,220,.94)] text-orange-ink',
} as const;

function CardTag({ children, tone }: { children: React.ReactNode; tone: keyof typeof TAG_TONES }) {
  return (
    <span
      className={cn(
        'rounded-full px-[11px] py-1 text-[12px] font-semibold leading-none tracking-[0.02em] shadow-[0_1px_3px_rgba(10,10,10,.1)] backdrop-blur-[6px]',
        TAG_TONES[tone],
      )}
    >
      {children}
    </span>
  );
}

function SkillCard({
  skill,
  starred,
  isMine,
  onToggleStar,
}: {
  skill: Skill;
  starred: boolean;
  isMine: boolean;
  onToggleStar: () => void;
}) {
  const origin = isMine ? 'Yours' : skill.ownerId ? 'Community' : 'System';
  return (
    <article className="group flex flex-col overflow-hidden rounded-[20px] bg-surface shadow-card transition-[transform,box-shadow] duration-[220ms] ease-[cubic-bezier(.2,.7,.3,1)] hover:-translate-y-1 hover:shadow-lift">
      {/* Shot — 4:3 cover, top-anchored like the catalogue cards. */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-line-soft">
        {skill.preview ? (
          <img src={skill.preview} alt="" className="h-full w-full object-cover object-top" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-5xl">{skill.emoji ?? '⚙️'}</div>
        )}
        <div className="absolute left-2.5 top-2.5 flex gap-1.5">
          <CardTag tone={isMine ? 'yours' : skill.ownerId ? 'community' : 'system'}>{origin}</CardTag>
          {skill.isActive === false && <CardTag tone="off">Disabled</CardTag>}
        </div>
        <button
          type="button"
          onClick={onToggleStar}
          title={starred ? 'Remove from favorites' : 'Add to favorites'}
          aria-label={starred ? 'Remove from favorites' : 'Add to favorites'}
          className="absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-full border border-line bg-surface/90 shadow-card backdrop-blur-md transition-transform hover:scale-110"
        >
          <Star className={cn('h-4 w-4', starred ? 'fill-yellow-dark text-yellow-dark' : 'text-muted-2')} />
        </button>
      </div>

      {/* Body — eyebrow label, clamped title/description, hairline foot. */}
      <div className="flex flex-1 flex-col px-[18px] pb-4 pt-2">
        <p className="text-[0.72rem] font-bold uppercase tracking-[0.09em] text-muted-2">
          {origin} · {skill.executionMode ?? 'skill'}
        </p>
        <h2 className="mb-2 mt-2 line-clamp-2 text-[1.02rem] font-bold leading-[1.2]">{skill.name}</h2>
        <p className="min-h-[4.5em] line-clamp-3 text-sm leading-normal text-muted">
          {skill.description || 'No description yet.'}
        </p>
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-line-soft pt-[13px]">
          <span className="font-mono text-micro text-muted-2">{skill.id}</span>
          <span className="text-base leading-none">{skill.emoji ?? '⚙️'}</span>
        </div>
      </div>
    </article>
  );
}

function EmptyState({ icon, title, body, action }: { icon: React.ReactNode; title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-line bg-surface px-6 py-12 text-center shadow-card">
      <div className="text-muted-2">{icon}</div>
      <p className="mt-3 text-sm font-bold tracking-tight">{title}</p>
      <p className="mt-1 max-w-sm text-sm leading-relaxed text-muted">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export default function SkillStorePage({
  onBack,
  onOpenNav,
  skills,
  onNavigate,
}: {
  onBack: () => void;
  onOpenNav: () => void;
  skills: Skill[];
  onNavigate: (view: View) => void;
}) {
  const { user, openLogin } = useAuth();
  const userKey = user ? String(user.id) : 'guest';
  const [tab, setTab] = useState<TabKey>('favorites');
  const [favorites, setFavorites] = useState<string[]>(() => getFavorites(userKey));

  // Re-read when the account changes so two users on one browser don't share stars.
  useEffect(() => {
    setFavorites(getFavorites(userKey));
  }, [userKey]);

  const myId = user?.id ?? null;
  const published = skills.filter((s) => myId != null && s.ownerId === myId);
  const favoriteSkills = favorites
    .map((id) => skills.find((s) => s.id === id))
    .filter((s): s is Skill => Boolean(s));
  // The backend does not expose purchase records yet; keep the shelf ready.
  const purchased: Skill[] = [];

  const star = (id: string) => {
    const next = toggleFavorite(userKey, id);
    setFavorites(next);
    toast(next.includes(id) ? 'Added to favorites' : 'Removed from favorites');
  };

  const TABS: { key: TabKey; label: string; count: number }[] = [
    { key: 'favorites', label: 'Favorites', count: favoriteSkills.length },
    { key: 'published', label: 'Published', count: published.length },
    { key: 'purchased', label: 'Purchased', count: purchased.length },
  ];

  return (
    <PageShell title="Skill Store" onBack={onBack} onOpenNav={onOpenNav} width="wide">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.03em]">Skill Store</h1>
          <p className="mt-1 text-sm text-muted">Your collection: skills you starred, published or purchased.</p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('skills')}
          className="flex min-h-9 items-center gap-1.5 rounded-full border border-line px-3.5 py-1.5 text-xs font-semibold text-ink transition-colors hover:border-ink"
        >
          <Store className="h-3.5 w-3.5" />
          Browse market
        </button>
      </div>

      {/* Tabs */}
      <div className="mt-5 flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            aria-pressed={tab === t.key}
            className={cn(
              'flex min-h-9 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors',
              tab === t.key ? 'bg-ink text-surface' : 'border border-line text-muted hover:border-ink hover:text-ink',
            )}
          >
            {t.label}
            <span className={cn('rounded-full px-1.5 py-0.5 text-micro', tab === t.key ? 'bg-surface/20' : 'bg-line-soft text-muted-2')}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-5">
        {tab === 'favorites' ? (
          favoriteSkills.length === 0 ? (
            <EmptyState
              icon={<Star className="h-8 w-8" />}
              title="No favorites yet"
              body="Tap the star on any skill in the market to save it here for quick access."
              action={
                <button
                  type="button"
                  onClick={() => onNavigate('skills')}
                  className="min-h-10 rounded-full bg-ink px-5 py-2 text-sm font-semibold text-surface"
                >
                  Open the market
                </button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-5 min-[620px]:grid-cols-2 min-[980px]:grid-cols-3">
              {favoriteSkills.map((skill) => (
                <SkillCard
                  key={skill.id}
                  skill={skill}
                  starred
                  isMine={myId != null && skill.ownerId === myId}
                  onToggleStar={() => star(skill.id)}
                />
              ))}
            </div>
          )
        ) : tab === 'published' ? (
          published.length === 0 ? (
            <EmptyState
              icon={<PackageOpen className="h-8 w-8" />}
              title={user ? 'Nothing published yet' : 'Sign in to see your skills'}
              body={
                user
                  ? 'Publish a Skill and it shows up here the moment it passes review.'
                  : 'Skills you publish will be listed here.'
              }
              action={
                user ? (
                  <a
                    href={`${PLATFORM_BASE}/publish/`}
                    className="flex min-h-10 items-center gap-1.5 rounded-full bg-ink px-5 py-2 text-sm font-semibold text-surface"
                  >
                    Publish a skill
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : (
                  <button type="button" onClick={openLogin} className="min-h-10 rounded-full bg-ink px-5 py-2 text-sm font-semibold text-surface">
                    Sign in
                  </button>
                )
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-5 min-[620px]:grid-cols-2 min-[980px]:grid-cols-3">
              {published.map((skill) => (
                <SkillCard
                  key={skill.id}
                  skill={skill}
                  starred={favorites.includes(skill.id)}
                  isMine
                  onToggleStar={() => star(skill.id)}
                />
              ))}
            </div>
          )
        ) : purchased.length === 0 ? (
          <EmptyState
            icon={<PackageOpen className="h-8 w-8" />}
            title="No purchased skills"
            body="Premium skills you buy will appear here, ready to use in chat."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {purchased.map((skill) => (
              <SkillCard
                key={skill.id}
                skill={skill}
                starred={favorites.includes(skill.id)}
                isMine={myId != null && skill.ownerId === myId}
                onToggleStar={() => star(skill.id)}
              />
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
}
