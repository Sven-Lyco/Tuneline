import { STORAGE_KEYS } from '../constants';
let gAudio: HTMLAudioElement | null = null;

export function getVolume(): number {
  const stored = localStorage.getItem(STORAGE_KEYS.volume);
  return stored !== null ? parseFloat(stored) : 0.8;
}

export function setVolume(v: number): void {
  localStorage.setItem(STORAGE_KEYS.volume, String(v));
  if (gAudio) gAudio.volume = v;
}

/**
 * Resolves to whether playback really started — it doesn't when the browser blocks
 * autoplay (no user gesture yet) or the preview fails to load.
 */
export async function playAudio(url: string, onStop?: () => void): Promise<boolean> {
  stopAudio();
  const audio = new Audio(url);
  gAudio = audio;
  audio.volume = getVolume();
  if (onStop) {
    audio.addEventListener('ended', onStop, { once: true });
    audio.addEventListener('error', onStop, { once: true });
  }
  try {
    await audio.play();
    return gAudio === audio;
  } catch {
    return false;
  }
}

export function stopAudio(): void {
  if (gAudio) {
    gAudio.pause();
    gAudio.currentTime = 0;
    gAudio = null;
  }
}

/** Resolves to whether audio is playing afterwards. */
export async function toggleAudio(): Promise<boolean> {
  if (!gAudio) return false;
  if (!gAudio.paused) {
    gAudio.pause();
    return false;
  }
  try {
    await gAudio.play();
    return true;
  } catch {
    return false;
  }
}
