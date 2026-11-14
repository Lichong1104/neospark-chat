import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Link2, Loader2, Star, Trash2, X } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import {
  deleteSkillReview,
  listSkillReviews,
  reviewErrorCode,
  saveSkillReview,
} from '../lib/api';
import type { Skill, SkillReviewItem, SkillReviewsSummary } from '../types';
import { cn } from '../lib/utils';

const MARKETING_BASE = 'https://useneospark.com';

export function shareUrlFor(skillId: string): string {
  return `${MARKETING_BASE}/skills/${encodeURIComponent(skillId)}/`;
}

function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`${value} out of 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={cn(
            'h-3.5 w-3.5',
            i < Math.round(value) ? 'fill-yellow text-ink-2' : 'text-line',
            className,
          )}
        />
      ))}
    </span>
  );
}

function ReviewRow({
  review,
  onDelete,
  deleting,
}: {
  review: SkillReviewItem;
  onDelete: (() => void) | null;
  deleting: boolean;
}) {
  return (
    <li className="rounded-xl border border-line-soft p-3">
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-line-soft text-[11px] font-bold text-muted-2">
          {review.user_name.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-xs font-bold">{review.user_name}</span>
            {review.is_mine && (
              <span className="rounded-full bg-yellow/60 px-1.5 py-0.5 text-micro font-bold uppercase tracking-wide text-ink">
                You
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-[10px] text-muted-2">
            {review.rating != null && <Stars value={review.rating} />}
            {review.created_at && <span>{new Date(review.created_at).toLocaleDateString()}</span>}
          </div>
        </div>
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            title="Delete your review"
            className="flex h-8 w-8 flex-none items-center justify-center rounded-md text-muted-2 transition-colors hover:bg-danger/5 hover:text-danger disabled:opacity-60"
          >
            {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>
      {review.comment && <p className="mt-2 whitespace-pre-wrap text-[12px] leading-relaxed text-muted">{review.comment}</p>}
      {review.is_hidden && (
        <p className="mt-2 rounded-lg bg-danger/5 px-2.5 py-2 text-[11px] font-semibold text-danger">
          Hidden by a moderator
          {review.hidden_reason ? `: ${review.hidden_reason}` : '.'} It isn't counted in the public rating.
        </p>
      )}
    </li>
  );
}

export default function SkillDetailDialog({
  skill,
  onClose,
  onChanged,
}: {
  skill: Skill;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { user, openLogin } = useAuth();
  const [summary, setSummary] = useState<SkillReviewsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [sort, setSort] = useState<'newest' | 'rating'>('newest');
  const [loadingMore, setLoadingMore] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(
    async (nextSort: 'newest' | 'rating') => {
      setLoading(true);
      setLoadError(false);
      try {
        const data = await listSkillReviews(skill.id, { sort: nextSort, limit: 10 });
        setSummary(data);
        setRating(data.my_review?.rating ?? 0);
        setComment(data.my_review?.comment ?? '');
      } catch {
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    },
    [skill.id],
  );

  useEffect(() => {
    void load(sort);
  }, [load, sort]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const loadMore = async () => {
    if (!summary || loadingMore) return;
    setLoadingMore(true);
    try {
      const next = await listSkillReviews(skill.id, {
        sort,
        offset: summary.comments.length,
        limit: 10,
      });
      setSummary({
        ...next,
        comments: [...summary.comments, ...next.comments],
        offset: 0,
      });
    } catch {
      toast.error('Could not load more reviews');
    } finally {
      setLoadingMore(false);
    }
  };

  const share = async () => {
    const url = shareUrlFor(skill.id);
    if (navigator.share) {
      try {
        await navigator.share({ title: skill.name, text: skill.description, url });
        return;
      } catch {
        // user dismissed the share sheet — fall through to copy
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied');
    } catch {
      toast.error('Could not copy the link');
    }
  };

  const submit = async () => {
    if (!summary?.can_review) return;
    if (rating === 0 && !comment.trim()) {
      toast.error('Add a rating or a comment first');
      return;
    }
    setSaving(true);
    try {
      await saveSkillReview(skill.id, { rating: rating || null, comment: comment.trim() || null });
      toast.success(summary.my_review ? 'Review updated' : 'Thanks for the review');
      await load(sort);
      onChanged();
    } catch (err) {
      const code = reviewErrorCode(err);
      if (code === 'usage_required') {
        toast.error('Use this Skill in chat first, then review it');
      } else if (code === 'owner_cannot_review') {
        toast.error("You can't review your own Skill");
      } else {
        toast.error('Could not save your review');
      }
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!summary?.my_review) return;
    setDeleting(true);
    try {
      await deleteSkillReview(skill.id, summary.my_review.id);
      toast.success('Review deleted');
      await load(sort);
      onChanged();
    } catch {
      toast.error('Could not delete your review');
    } finally {
      setDeleting(false);
    }
  };

  const avg = summary?.rating_avg;
  const ratingCount = summary?.rating_count ?? skill.ratingCount ?? 0;
  const installs = skill.installs ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${skill.name} details`}
        className="relative flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-surface shadow-panel"
      >
        <div className="flex items-center gap-2 border-b border-line-soft px-5 py-3.5">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold tracking-tight">{skill.name}</div>
            <div className="truncate font-mono text-micro text-muted-2">{skill.id}</div>
          </div>
          <button
            type="button"
            onClick={() => void share()}
            className="flex min-h-9 items-center gap-1.5 rounded-full border border-line px-3 py-1 text-xs font-bold text-ink transition-colors hover:border-ink"
            title="Share this Skill"
          >
            <Link2 className="h-3.5 w-3.5" />
            Share
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 flex-none items-center justify-center rounded-md text-muted-2 transition-colors hover:bg-paper hover:text-ink"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <div className="flex gap-4">
            <div className="h-24 w-36 flex-none overflow-hidden rounded-xl border border-line bg-line-soft">
              {skill.preview ? (
                <img src={skill.preview} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-4xl">{skill.emoji ?? '⚙️'}</div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] leading-relaxed text-muted">{skill.description || 'No description yet.'}</p>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-muted-2">
                <span className="flex items-center gap-1">
                  <Star className={cn('h-3.5 w-3.5', avg ? 'fill-yellow text-ink-2' : 'text-line')} />
                  {avg != null ? avg.toFixed(1) : 'No ratings yet'}
                  {ratingCount > 0 && <span className="font-normal">({ratingCount})</span>}
                </span>
                <span>{installs} installs</span>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-muted-2">Reviews</h3>
              <div className="flex items-center gap-1 rounded-full border border-line p-0.5">
                {(['newest', 'rating'] as const).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSort(key)}
                    className={cn(
                      'rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors',
                      sort === key ? 'bg-ink text-surface' : 'text-muted-2 hover:text-ink',
                    )}
                  >
                    {key === 'newest' ? 'Newest' : 'Highest rated'}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="mt-4 flex items-center justify-center py-8 text-muted-2">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : loadError ? (
              <p className="mt-4 rounded-xl border border-line-soft p-4 text-center text-xs text-muted-2">
                Could not load reviews right now.
              </p>
            ) : summary && summary.comments.length === 0 ? (
              <p className="mt-4 rounded-xl border border-line-soft p-4 text-center text-xs text-muted-2">
                No reviews yet. Used this Skill? Be the first to rate it.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {summary?.comments.map((review) => (
                  <ReviewRow key={review.id} review={review} onDelete={null} deleting={false} />
                ))}
              </ul>
            )}

            {summary && summary.comments.length < summary.total && (
              <button
                type="button"
                onClick={() => void loadMore()}
                disabled={loadingMore}
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-full border border-line py-2 text-xs font-bold text-ink transition-colors hover:border-ink disabled:opacity-60"
              >
                {loadingMore && <Loader2 className="h-3 w-3 animate-spin" />}
                Load more
              </button>
            )}
          </div>

          {summary && summary.my_review && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-muted-2">Your review</h3>
              <ul className="mt-3">
                <ReviewRow
                  review={summary.my_review}
                  onDelete={() => void remove()}
                  deleting={deleting}
                />
              </ul>
            </div>
          )}

          <div className="rounded-xl border border-line p-3">
            <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-muted-2">
              {summary?.my_review ? 'Update your review' : 'Write a review'}
            </h3>

            {!summary ? null : !summary.can_review ? (
              <p className="mt-2 text-xs text-muted">
                {summary.block_reason === 'login_required' ? (
                  <button type="button" onClick={openLogin} className="font-bold text-ink underline">
                    Sign in
                  </button>
                ) : summary.block_reason === 'owner' ? (
                  "You can't review your own Skill."
                ) : (
                  "Only users who've actually used this Skill can review it — try it in a chat first, then come back."
                )}
              </p>
            ) : (
              <>
                <div className="mt-2 flex items-center gap-1">
                  {Array.from({ length: 5 }, (_, i) => {
                    const value = i + 1;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setRating(rating === value ? 0 : value)}
                        aria-label={`${value} star${value > 1 ? 's' : ''}`}
                        aria-pressed={rating === value}
                        className="p-0.5 transition-transform hover:scale-110"
                      >
                        <Star
                          className={cn(
                            'h-5 w-5',
                            value <= rating ? 'fill-yellow text-ink-2' : 'text-line',
                          )}
                        />
                      </button>
                    );
                  })}
                  {rating > 0 && (
                    <button type="button" onClick={() => setRating(0)} className="ml-1 text-[11px] font-semibold text-muted-2 hover:text-ink">
                      Clear
                    </button>
                  )}
                </div>
                <textarea
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  rows={3}
                  maxLength={2000}
                  placeholder="What did you make with it? What worked, what didn't?"
                  className="mt-2 w-full resize-none rounded-lg border border-line bg-surface px-3 py-2 text-base leading-relaxed focus:border-ink sm:text-sm"
                />
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[11px] text-muted-2">Published right away; a moderator can hide it.</span>
                  <button
                    type="button"
                    onClick={() => void submit()}
                    disabled={saving}
                    className="flex min-h-9 items-center gap-1.5 rounded-full bg-ink px-4 py-1.5 text-xs font-bold text-surface disabled:opacity-60"
                  >
                    {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                    {summary.my_review ? 'Update' : 'Post review'}
                  </button>
                </div>
              </>
            )}

            {!user && summary?.block_reason === 'login_required' && (
              <p className="mt-1 text-[11px] text-muted-2">Reviews are tied to your account.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
