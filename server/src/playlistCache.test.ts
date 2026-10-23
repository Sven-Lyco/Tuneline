import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetSession, listedPlaylist, playlistPages, rememberPlaylists } from './playlistCache.js';

const HOUR = 60 * 60 * 1000;
const page = (n: number) => ({ items: [n], total: 1 });

let n = 0;
const session = () => `session-${++n}`;

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('playlistCache', () => {
  it('caches only playlists listed with a snapshot', () => {
    const s = session();
    expect(playlistPages(s, 'p1')).toBeNull();
    rememberPlaylists(s, [
      { id: 'p1', snapshotId: 'v1', followed: false },
      { id: 'p2', snapshotId: null, followed: true },
    ]);
    expect(listedPlaylist(s, 'p2')).toEqual({ id: 'p2', snapshotId: null, followed: true });
    expect(playlistPages(s, 'p2')).toBeNull();

    const pages = playlistPages<number>(s, 'p1')!;
    expect(pages.get('/a')).toBeUndefined();
    pages.set('/a', page(1));
    expect(playlistPages<number>(s, 'p1')!.get('/a')).toEqual(page(1));
  });

  it('lets listings and pages expire after six hours', () => {
    const s = session();
    rememberPlaylists(s, [{ id: 'p1', snapshotId: 'v1', followed: false }]);
    playlistPages<number>(s, 'p1')!.set('/a', page(1));

    vi.advanceTimersByTime(5 * HOUR);
    // Listing again renews the listing, not the pages read before.
    rememberPlaylists(s, [{ id: 'p1', snapshotId: 'v1', followed: false }]);
    vi.advanceTimersByTime(HOUR);
    expect(playlistPages<number>(s, 'p1')!.get('/a')).toBeUndefined();

    vi.advanceTimersByTime(5 * HOUR);
    expect(listedPlaylist(s, 'p1')).toBeUndefined();
  });

  it('keeps at most 2000 pages, dropping the oldest', () => {
    const s = session();
    rememberPlaylists(s, [{ id: 'p1', snapshotId: 'v1', followed: false }]);
    const pages = playlistPages<number>(s, 'p1')!;
    for (let i = 0; i <= 2000; i++) pages.set(`/${i}`, page(i));
    expect(pages.get('/0')).toBeUndefined();
    expect(pages.get('/1')).toEqual(page(1));
    expect(pages.get('/2000')).toEqual(page(2000));
    forgetSession(s);
  });

  it('forgets a session completely', () => {
    const s = session();
    const other = session();
    for (const id of [s, other]) {
      rememberPlaylists(id, [{ id: 'p1', snapshotId: 'v1', followed: false }]);
      playlistPages<number>(id, 'p1')!.set('/a', page(1));
    }
    forgetSession(s);
    expect(listedPlaylist(s, 'p1')).toBeUndefined();
    rememberPlaylists(s, [{ id: 'p1', snapshotId: 'v1', followed: false }]);
    expect(playlistPages<number>(s, 'p1')!.get('/a')).toBeUndefined();
    expect(playlistPages<number>(other, 'p1')!.get('/a')).toEqual(page(1));
  });
});
