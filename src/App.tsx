import { useState, useEffect, useCallback } from 'react';
import styled from '@emotion/styled';
import type { Feedback, Player, Screen, Song, SpotifyPlaylist } from './types';
import {
  handleAuthCallback,
  isAuthenticated,
  getValidToken,
  loadSongsFromPlaylists,
  logout,
} from './api/spotify';
import { initSpotifyPlayer, playTrack, stopTrack, toggleTrack } from './utils/audio';
import { shuffle } from './utils/shuffle';
import { GlobalStyles } from './components/GlobalStyles';
import { LoginScreen } from './screens/LoginScreen';
import { PlaylistScreen } from './screens/PlaylistScreen';
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

// ── App ────────────────────────────────────────────────────────

export default function App() {
  // Navigation
  const [screen, setScreen] = useState<Screen>('login');

  // Setup
  const [selectedPlaylists, setSelectedPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [players, setPlayers] = useState<Player[]>([{ name: 'Spieler 1' }, { name: 'Spieler 2' }]);
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

  // ── Auth init ────────────────────────────────────────────────

  useEffect(() => {
    const init = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');

      if (code) {
        window.history.replaceState({}, '', window.location.pathname);
        const success = await handleAuthCallback(code);
        if (success) {
          setScreen('playlists');
          void initSpotifyPlayer(getValidToken);
        }
      } else if (isAuthenticated()) {
        const token = await getValidToken();
        if (token) {
          setScreen('playlists');
          void initSpotifyPlayer(getValidToken);
        }
      }
    };

    void init();
  }, []);

  // ── Playlist selection ───────────────────────────────────────

  const togglePlaylist = useCallback((playlist: SpotifyPlaylist) => {
    setSelectedPlaylists((prev) =>
      prev.some((p) => p.id === playlist.id)
        ? prev.filter((p) => p.id !== playlist.id)
        : [...prev, playlist]
    );
  }, []);

  const handleLogout = useCallback(() => {
    void stopTrack();
    logout();
    setSelectedPlaylists([]);
    setScreen('login');
  }, []);

  // ── Start Game ───────────────────────────────────────────────

  const start = useCallback(async () => {
    setScreen('loading');
    setLoadingMsg('Songs werden von Spotify geladen...');

    const needed = rounds * players.length + players.length + 5;
    const songs = await loadSongsFromPlaylists(
      selectedPlaylists.map((p) => p.id),
      needed
    );

    if (songs.length < players.length + 3) {
      setLoadingMsg('Nicht genug Songs gefunden. Bitte andere Playlisten wählen.');
      await new Promise((r) => setTimeout(r, 2000));
      setScreen('playlists');
      return;
    }

    const tls: Record<number, Song[]> = {};
    const scs: Record<number, number> = {};
    players.forEach((_, i) => {
      tls[i] = [songs[i]];
      scs[i] = 0;
    });
    const dk = shuffle(songs.slice(players.length));

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

    if (dk[0]?.uri) {
      void playTrack(dk[0].uri);
      setPlaying(true);
    }
  }, [selectedPlaylists, rounds, players]);

  // ── Place Song ───────────────────────────────────────────────

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
    void stopTrack();
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
        void stopTrack();
        setScreen('result');
      } else {
        setSongIndex(nextSongIndex);
        setPlayerIndex(nextPlayerIndex);
        setRound(nextRound);
        setSlot(null);
        setFeedback(null);
        setRevealed(false);

        if (deck[nextSongIndex]?.uri) {
          void playTrack(deck[nextSongIndex].uri);
          setPlaying(true);
        } else {
          setPlaying(false);
        }
      }
    }, 2200);
  }, [slot, deck, songIndex, timelines, playerIndex, players, round, rounds]);

  const handleToggleAudio = useCallback(() => {
    toggleTrack()
      .then(setPlaying)
      .catch(() => {});
  }, []);

  const handleRestart = useCallback(() => {
    void stopTrack();
    setScreen('menu');
  }, []);

  const currentSong = deck[songIndex];
  const currentTimeline = [...(timelines[playerIndex] || [])].sort((a, b) => a.year - b.year);

  return (
    <Root>
      <GlobalStyles />
      <BgGrid />
      <BgGlowTop />
      <BgGlowBottom />

      {screen === 'login' && <LoginScreen />}

      {screen === 'playlists' && (
        <PlaylistScreen
          selected={selectedPlaylists}
          onToggle={togglePlaylist}
          onConfirm={() => setScreen('menu')}
          onLogout={handleLogout}
        />
      )}

      {screen === 'menu' && (
        <MenuScreen
          playlists={selectedPlaylists}
          players={players}
          setPlayers={setPlayers}
          rounds={rounds}
          setRounds={setRounds}
          onStart={() => void start()}
          onChangePlaylists={() => setScreen('playlists')}
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
