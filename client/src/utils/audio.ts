const VOLUME_KEY = 'tuneline_volume';
let gAudio: HTMLAudioElement | null = null;

export function getVolume(): number {
  const stored = localStorage.getItem(VOLUME_KEY);
  return stored !== null ? parseFloat(stored) : 0.8;
}

export function setVolume(v: number): void {
  localStorage.setItem(VOLUME_KEY, String(v));
  if (gAudio) gAudio.volume = v;
}

export function playAudio(url: string): void {
  stopAudio();
  gAudio = new Audio(url);
  gAudio.volume = getVolume();
  gAudio.play().catch(() => {});
}

export function stopAudio(): void {
  if (gAudio) {
    gAudio.pause();
    gAudio.currentTime = 0;
    gAudio = null;
  }
}

export function toggleAudio(): boolean {
  if (!gAudio) return false;
  if (gAudio.paused) {
    gAudio.play().catch(() => {});
    return true;
  } else {
    gAudio.pause();
    return false;
  }
}
