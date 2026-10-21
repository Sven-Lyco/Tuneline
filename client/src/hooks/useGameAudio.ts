import { useState, useCallback } from 'react';
import { playAudio, stopAudio, toggleAudio, getVolume, setVolume } from '../utils/audio';

export function useGameAudio() {
  const [playing, setPlaying] = useState(false);
  const [volume, setVolumeState] = useState(() => getVolume());

  const startSong = useCallback((preview: string) => {
    void playAudio(preview, () => setPlaying(false)).then(setPlaying);
  }, []);

  const stopSong = useCallback(() => {
    stopAudio();
    setPlaying(false);
  }, []);

  const toggle = useCallback(() => {
    void toggleAudio().then(setPlaying);
  }, []);

  const changeVolume = useCallback((v: number) => {
    setVolume(v);
    setVolumeState(v);
  }, []);

  return { playing, volume, startSong, stopSong, toggle, changeVolume };
}
