import { describe, expect, it, vi } from 'vitest';
import { getVolume, playAudio, setVolume, stopAudio, toggleAudio } from './audio';

const lastAudio = () =>
  vi.mocked(HTMLMediaElement.prototype.play).mock.contexts.at(-1) as HTMLAudioElement;

describe('volume', () => {
  it('defaults to 0.8 and is remembered', () => {
    expect(getVolume()).toBe(0.8);
    setVolume(0.3);
    expect(getVolume()).toBe(0.3);
  });

  it('applies to the playing preview', async () => {
    await playAudio('https://a/1.m4a');
    setVolume(0.2);
    expect(lastAudio().volume).toBe(0.2);
    stopAudio();
  });
});

describe('playAudio', () => {
  it('reports whether playback really started', async () => {
    expect(await playAudio('https://a/ok.m4a')).toBe(true);
    vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValueOnce(new Error('NotAllowedError'));
    expect(await playAudio('https://a/blocked.m4a')).toBe(false);
  });

  it('reports false when the song was stopped before it started', async () => {
    const pending = playAudio('https://a/slow.m4a');
    stopAudio();
    expect(await pending).toBe(false);
  });

  it('calls onStop when the preview ends or fails', async () => {
    const onStop = vi.fn();
    await playAudio('https://a/end.m4a', onStop);
    lastAudio().dispatchEvent(new Event('ended'));
    await playAudio('https://a/err.m4a', onStop);
    lastAudio().dispatchEvent(new Event('error'));
    expect(onStop).toHaveBeenCalledTimes(2);
  });
});

describe('toggleAudio', () => {
  it('does nothing without a song', async () => {
    stopAudio();
    expect(await toggleAudio()).toBe(false);
  });

  it('pauses a playing song and resumes a paused one', async () => {
    await playAudio('https://a/t.m4a');
    const audio = lastAudio();
    Object.defineProperty(audio, 'paused', { configurable: true, value: false });
    expect(await toggleAudio()).toBe(false);
    expect(audio.pause).toHaveBeenCalled();

    Object.defineProperty(audio, 'paused', { configurable: true, value: true });
    expect(await toggleAudio()).toBe(true);

    vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValueOnce(new Error('blocked'));
    expect(await toggleAudio()).toBe(false);
  });
});
