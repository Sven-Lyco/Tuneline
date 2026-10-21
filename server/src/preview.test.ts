import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { findPreview, previewHandler } from './preview.js';

type Track = { previewUrl: string | null; trackName: string; artistName: string };

const fetchMock = vi.fn();

function itunes(results: Track[], ok = true) {
  fetchMock.mockResolvedValueOnce({ ok, status: ok ? 200 : 429, json: async () => ({ results }) });
}

const track = (artistName: string, trackName: string, previewUrl: string | null = `https://audio/${trackName}`) => ({
  artistName,
  trackName,
  previewUrl,
});

// The cache is module-wide, so every test uses its own artist.
let n = 0;
const artist = () => `Artist ${++n}`;

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('findPreview', () => {
  it('prefers the exact title by the same artist', async () => {
    const a = artist();
    itunes([track(a, 'Dream On (Live)'), track(a, 'Dream On'), track('Other', 'Dream On')]);
    expect(await findPreview(a, 'Dream On')).toBe('https://audio/Dream On');
  });

  it('accepts remaster and edit variants of the title', async () => {
    const a = artist();
    itunes([track(a, 'Bohemian Rhapsody (Remastered 2011)')]);
    expect(await findPreview(a, 'Bohemian Rhapsody')).toBe('https://audio/Bohemian Rhapsody (Remastered 2011)');

    const b = artist();
    itunes([track(b, 'Shout - Radio Edit')]);
    expect(await findPreview(b, 'Shout')).toBe('https://audio/Shout - Radio Edit');
  });

  it('ignores accents and case', async () => {
    itunes([track('Beyonce', 'HALO')]);
    expect(await findPreview('Beyoncé', 'Halo')).toBe('https://audio/HALO');
  });

  it('never falls back to another song or artist', async () => {
    const a = artist();
    itunes([track(a, 'Love'), track('Someone Else', 'Love Me Do')]);
    expect(await findPreview(a, 'Love Me Do')).toBeNull();
  });

  it('skips results without a preview and titles without letters', async () => {
    const a = artist();
    itunes([track(a, 'Song', null)]);
    expect(await findPreview(a, 'Song')).toBeNull();
    expect(await findPreview(artist(), '!!!')).toBeNull();
  });

  it('caches answers but retries after throttling or network errors', async () => {
    const a = artist();
    itunes([], false);
    expect(await findPreview(a, 'Hit')).toBeNull();
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    expect(await findPreview(a, 'Hit')).toBeNull();
    itunes([track(a, 'Hit')]);
    expect(await findPreview(a, 'Hit')).toBe('https://audio/Hit');
    expect(await findPreview(a, 'Hit')).toBe('https://audio/Hit');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('evicts the oldest entry once the cache is full', async () => {
    fetchMock.mockImplementation(async () => ({ ok: true, json: async () => ({ results: [] }) }));
    const first = artist();
    await findPreview(first, 'Oldest');
    for (let i = 0; i < 2000; i++) await findPreview(`Filler ${i}`, 'Song');
    const calls = fetchMock.mock.calls.length;
    await findPreview(first, 'Oldest');
    expect(fetchMock.mock.calls.length).toBe(calls + 1);
  });
});

describe('previewHandler', () => {
  function call(query: Record<string, string>) {
    const res = { status: vi.fn(), json: vi.fn() };
    res.status.mockReturnValue(res);
    return previewHandler({ query } as unknown as Request, res as unknown as Response).then(() => res);
  }

  it('validates the query', async () => {
    expect((await call({ artist: 'A' })).status).toHaveBeenCalledWith(400);
    expect((await call({ artist: 'A', title: 'x'.repeat(201) })).status).toHaveBeenCalledWith(400);
  });

  it('answers with the preview url', async () => {
    const a = artist();
    itunes([track(a, 'Song')]);
    const res = await call({ artist: a, title: 'Song' });
    expect(res.json).toHaveBeenCalledWith({ previewUrl: 'https://audio/Song' });
  });
});
