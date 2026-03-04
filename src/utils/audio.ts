let gAudio: HTMLAudioElement | null = null;

export function playAudio(url: string): void {
  stopAudio();
  gAudio = new Audio(url);
  gAudio.volume = 0.7;
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
    gAudio.play();
    return true;
  } else {
    gAudio.pause();
    return false;
  }
}
