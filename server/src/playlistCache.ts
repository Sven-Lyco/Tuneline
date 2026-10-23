/**
 * Per host session: the playlists as last listed (snapshot, followed or not) and the pages already
 * read from them. A page belongs to one snapshot — when a playlist changes, Spotify gives it a new
 * snapshot_id and the old pages no longer match. Spotify's terms allow only temporary caching, so
 * everything expires after a few hours, and goes with the session (logout, failed token refresh).
 */

const TTL_MS = 6 * 60 * 60 * 1000;
const MAX_PAGES = 2000;

export interface ListedPlaylist {
  id: string;
  snapshotId: string | null;
  /** Neither owned by the host nor collaborative. */
  followed: boolean;
}

/** A page of a playlist, already parsed: what's left after filtering, and the playlist's size. */
export interface CachedPage<T> {
  items: T[];
  total: number;
}

const listings = new Map<string, { playlists: Map<string, ListedPlaylist>; expiresAt: number }>();
const pages = new Map<string, { page: CachedPage<unknown>; expiresAt: number }>();

export function rememberPlaylists(sessionId: string, playlists: ListedPlaylist[]): void {
  listings.set(sessionId, {
    playlists: new Map(playlists.map((p) => [p.id, p])),
    expiresAt: Date.now() + TTL_MS,
  });
}

export function listedPlaylist(sessionId: string, playlistId: string): ListedPlaylist | undefined {
  const listing = listings.get(sessionId);
  if (!listing) return undefined;
  if (Date.now() >= listing.expiresAt) {
    listings.delete(sessionId);
    return undefined;
  }
  return listing.playlists.get(playlistId);
}

export interface PageCache<T> {
  get(path: string): CachedPage<T> | undefined;
  set(path: string, page: CachedPage<T>): void;
}

/**
 * The pages of one playlist in the snapshot the host saw when listing it; null if that's unknown
 * (not listed in this session, or Spotify sent no snapshot), and then nothing is cached.
 */
export function playlistPages<T>(sessionId: string, playlistId: string): PageCache<T> | null {
  const snapshotId = listedPlaylist(sessionId, playlistId)?.snapshotId;
  if (!snapshotId) return null;
  const prefix = `${sessionId}|${playlistId}|${snapshotId}|`;
  return {
    get(path) {
      const entry = pages.get(prefix + path);
      if (!entry) return undefined;
      if (Date.now() >= entry.expiresAt) {
        pages.delete(prefix + path);
        return undefined;
      }
      return entry.page as CachedPage<T>;
    },
    set(path, page) {
      if (pages.size >= MAX_PAGES) evict();
      pages.set(prefix + path, { page, expiresAt: Date.now() + TTL_MS });
    },
  };
}

/** Drops expired pages, and the oldest ones if that's not enough. */
function evict(): void {
  const now = Date.now();
  for (const [key, entry] of pages) if (now >= entry.expiresAt) pages.delete(key);
  for (const key of pages.keys()) {
    if (pages.size < MAX_PAGES) break;
    pages.delete(key);
  }
}

/** Everything cached for a session: on logout and when the session ends. */
export function forgetSession(sessionId: string): void {
  listings.delete(sessionId);
  const prefix = `${sessionId}|`;
  for (const key of pages.keys()) if (key.startsWith(prefix)) pages.delete(key);
}
