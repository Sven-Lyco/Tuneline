import { describe, expect, it, vi } from 'vitest';
import { STORAGE_KEYS } from '../constants';
import { MAX_PLAYED_SONGS, readPlayedSongs, savePlayedSongs } from './playedSongs';

describe('played songs', () => {
  it('round-trips the most recent songs', () => {
    expect(readPlayedSongs()).toEqual([]);
    savePlayedSongs(new Set(['a', 'b']));
    expect(readPlayedSongs()).toEqual(['a', 'b']);

    savePlayedSongs(Array.from({ length: MAX_PLAYED_SONGS + 5 }, (_, i) => `s${i}`));
    const ids = readPlayedSongs();
    expect(ids).toHaveLength(MAX_PLAYED_SONGS);
    expect(ids.at(-1)).toBe(`s${MAX_PLAYED_SONGS + 4}`);
  });

  it('forgets them a day after the last game', () => {
    vi.useFakeTimers();
    savePlayedSongs(['a']);
    vi.advanceTimersByTime(23 * 60 * 60 * 1000);
    expect(readPlayedSongs()).toEqual(['a']);
    vi.advanceTimersByTime(60 * 60 * 1000);
    expect(readPlayedSongs()).toEqual([]);
    vi.useRealTimers();
  });

  it('survives broken or blocked storage', () => {
    localStorage.setItem(STORAGE_KEYS.playedSongs, '{not json');
    expect(readPlayedSongs()).toEqual([]);
    localStorage.setItem(
      STORAGE_KEYS.playedSongs,
      JSON.stringify({ ids: 'a', savedAt: Date.now() })
    );
    expect(readPlayedSongs()).toEqual([]);

    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    expect(() => savePlayedSongs(['a'])).not.toThrow();
    setItem.mockRestore();
  });
});
