import { useState, useCallback } from 'react';
import { playAudio, stopAudio, toggleAudio, getVolume, setVolume } from '../utils/audio';

export function useGameAudio() {
  const [playing, setPlaying] = useState(false);
  const [volume, setVolumeState] = useState(() => getVolume());

  const startSong = useCallback((preview: string) => {
    playAudio(preview, () => setPlaying(false));
    setPlaying(true);
  }, []);

  const stopSong = useCallback(() => {
    stopAudio();
    setPlaying(false);
  }, []);

  const toggle = useCallback(() => {
    setPlaying(toggleAudio());
  }, []);

  const changeVolume = useCallback((v: number) => {
    setVolume(v);
    setVolumeState(v);
  }, []);

  return { playing, volume, startSong, stopSong, toggle, changeVolume };
}
