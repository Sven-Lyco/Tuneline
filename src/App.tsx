import { useState, useEffect, useCallback } from 'react';
import styled from '@emotion/styled';
import type { Feedback, Genre, Player, Screen, Song } from './types';
import { FALLBACK_SONGS } from './constants';
import { loadSongsForGenres } from './api/deezer';
import { shuffle } from './utils/shuffle';
import { playAudio, stopAudio, toggleAudio } from './utils/audio';
import { GlobalStyles } from './components/GlobalStyles';
import { MenuScreen } from './screens/MenuScreen';
import { LoadingScreen } from './screens/LoadingScreen';
import { GameScreen } from './screens/GameScreen';
import { ResultScreen } from './screens/ResultScreen';

// ── Background decorations ─────────────────────────────────────

const Root = styled.div`
  min-height: 100vh;
  background: #08080d;
  color: #e8e8f0;
  font-family: 'Outfit', sans-serif;
  position: relative;
  overflow: hidden;
`;

const BgGrid = styled.div`
  position: fixed;
  inset: 0;
  background-image: linear-gradient(rgba(255, 45, 120, 0.015) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 45, 120, 0.015) 1px, transparent 1px);
  background-size: 50px 50px;
  pointer-events: none;
`;

const BgGlowTop = styled.div`
  position: fixed;
  width: 500px;
  height: 500px;
  border-radius: 50%;
  filter: blur(140px);
  background: rgba(255, 45, 120, 0.06);
  top: -180px;
  right: -180px;
  pointer-events: none;
`;

const BgGlowBottom = styled.div`
  position: fixed;
  width: 350px;
  height: 350px;
  border-radius: 50%;
  filter: blur(110px);
  background: rgba(6, 214, 160, 0.04);
  bottom: -80px;
  left: -80px;
  pointer-events: none;
`;

// ── App State ─────────────────────────────────────────────────

export default function App() {
  // Navigation
  const [screen, setScreen] = useState<Screen>('menu');

  // Setup
  const [players, setPlayers] = useState<Player[]>([{ name: 'Spieler 1' }, { name: 'Spieler 2' }]);
  const [genres, setGenres] = useState<Genre[]>(['pop']);
  const [rounds, setRounds] = useState(10);
  const [loadingMsg, setLoadingMsg] = useState('');

  // Game state
  const [deck, setDeck] = useState<Song[]>([]);
  const [songIndex, setSongIndex] = useState(0);
  const [playerIndex, setPlayerIndex] = useState(0);
  const [timelines, setTimelines] = useState<Record<number, Song[]>>({});
  const [scores, setScores] = useState<Record<number, number>>({});
  const [slot, setSlot] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [revealed, setRevealed] = useState(false);
  const [round, setRound] = useState(1);
  const [playing, setPlaying] = useState(false);

  const toggleGenre = (g: Genre) =>
    setGenres((prev) =>
      prev.includes(g) ? (prev.length > 1 ? prev.filter((x) => x !== g) : prev) : [...prev, g]
    );

  // ── Start Game ────────────────────────────────────────────

  const start = useCallback(async () => {
    setScreen('loading');
    setLoadingMsg('Songs werden von Deezer geladen...');

    const needed = rounds * players.length + players.length + 5;
    let songs = await loadSongsForGenres(genres, needed);

    if (songs.length < players.length + 3) {
      setLoadingMsg('Deezer nicht erreichbar – nutze Fallback-Songs...');
      songs = shuffle(FALLBACK_SONGS);
      await new Promise((r) => setTimeout(r, 800));
    }

    const tls: Record<number, Song[]> = {};
    const scs: Record<number, number> = {};
    players.forEach((_, i) => {
      tls[i] = [songs[i]];
      scs[i] = 0;
    });
    const dk = songs.slice(players.length);

    setDeck(dk);
    setTimelines(tls);
    setScores(scs);
    setSongIndex(0);
    setPlayerIndex(0);
    setSlot(null);
    setFeedback(null);
    setRevealed(false);
    setRound(1);
    setScreen('game');

    if (dk[0]?.preview) {
      playAudio(dk[0].preview);
      setPlaying(true);
    }
  }, [genres, rounds, players]);

  // ── Place Song ────────────────────────────────────────────

  const place = useCallback(() => {
    if (slot === null || !deck[songIndex]) return;

    const song = deck[songIndex];
    const sorted = [...(timelines[playerIndex] || [])].sort((a, b) => a.year - b.year);
    const next = [...sorted];
    next.splice(slot, 0, song);

    let correct = true;
    for (let i = 1; i < next.length; i++) {
      if (next[i].year < next[i - 1].year) {
        correct = false;
        break;
      }
    }

    setRevealed(true);
    stopAudio();
    setPlaying(false);

    if (correct) {
      setFeedback('ok');
      setScores((s) => ({ ...s, [playerIndex]: s[playerIndex] + 1 }));
      setTimelines((t) => ({ ...t, [playerIndex]: next }));
    } else {
      setFeedback('no');
    }

    setTimeout(() => {
      const nextSongIndex = songIndex + 1;
      const nextPlayerIndex = (playerIndex + 1) % players.length;
      const nextRound = nextPlayerIndex === 0 ? round + 1 : round;

      const gameOver =
        nextSongIndex >= deck.length || (nextPlayerIndex === 0 && round >= rounds);

      if (gameOver) {
        stopAudio();
        setScreen('result');
      } else {
        setSongIndex(nextSongIndex);
        setPlayerIndex(nextPlayerIndex);
        setRound(nextRound);
        setSlot(null);
        setFeedback(null);
        setRevealed(false);

        if (deck[nextSongIndex]?.preview) {
          playAudio(deck[nextSongIndex].preview);
          setPlaying(true);
        } else {
          setPlaying(false);
        }
      }
    }, 2200);
  }, [slot, deck, songIndex, timelines, playerIndex, players, round, rounds]);

  const handleToggleAudio = useCallback(() => {
    const isNowPlaying = toggleAudio();
    setPlaying(isNowPlaying);
  }, []);

  const handleRestart = useCallback(() => {
    stopAudio();
    setScreen('menu');
  }, []);

  useEffect(() => () => stopAudio(), []);

  const currentSong = deck[songIndex];
  const currentTimeline = [...(timelines[playerIndex] || [])].sort((a, b) => a.year - b.year);

  return (
    <Root>
      <GlobalStyles />
      <BgGrid />
      <BgGlowTop />
      <BgGlowBottom />

      {screen === 'menu' && (
        <MenuScreen
          players={players}
          setPlayers={setPlayers}
          genres={genres}
          onToggleGenre={toggleGenre}
          rounds={rounds}
          setRounds={setRounds}
          onStart={start}
        />
      )}

      {screen === 'loading' && <LoadingScreen message={loadingMsg} />}

      {screen === 'game' && currentSong && (
        <GameScreen
          players={players}
          playerIndex={playerIndex}
          round={round}
          rounds={rounds}
          scores={scores}
          song={currentSong}
          timeline={currentTimeline}
          slot={slot}
          setSlot={setSlot}
          feedback={feedback}
          revealed={revealed}
          playing={playing}
          onToggleAudio={handleToggleAudio}
          onPlace={place}
        />
      )}

      {screen === 'result' && (
        <ResultScreen players={players} scores={scores} onRestart={handleRestart} />
      )}
    </Root>
  );
}
