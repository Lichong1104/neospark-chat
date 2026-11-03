/**
 * Favorite skills, kept client-side: the backend has no favorites endpoint
 * yet, so the id list lives in localStorage keyed by user id ('guest' when
 * signed out).
 */
const KEY = 'neospark_skill_favorites';

function readAll(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, string[]>;
    }
  } catch {
    // corrupted entry — start clean
  }
  return {};
}

export function getFavorites(userKey: string): string[] {
  return readAll()[userKey] ?? [];
}

/** Toggle a skill id and return the updated favorite list for this user. */
export function toggleFavorite(userKey: string, skillId: string): string[] {
  const all = readAll();
  const list = all[userKey] ?? [];
  const next = list.includes(skillId) ? list.filter((id) => id !== skillId) : [...list, skillId];
  all[userKey] = next;
  localStorage.setItem(KEY, JSON.stringify(all));
  return next;
}
