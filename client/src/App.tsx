import { useState, useEffect, useCallback } from 'react';
import styled from '@emotion/styled';
import type { Feedback, Screen, SpotifyPlaylist } from './types';
import type {
  AudioMode,
  GameStateForClient,
  LobbyState,
  RoomPlayer,
  SongFull,
  SongMeta,
} from '@tuneline/shared';
import {
  handleAuthCallback,
  isAuthenticated,
  getValidToken,
  loadSongsFromPlaylists,
  logout,
} from './api/spotify';
import { playAudio, stopAudio, toggleAudio, getVolume, setVolume } from './utils/audio';
import { socket } from './socket';
import { GlobalStyles } from './components/GlobalStyles';
import { LoginScreen } from './screens/LoginScreen';
import { JoinScreen } from './screens/JoinScreen';
import { PlaylistScreen } from './screens/PlaylistScreen';
import { MenuScreen } from './screens/MenuScreen';
import { LoadingScreen } from './screens/LoadingScreen';
import { LobbyScreen } from './screens/LobbyScreen';
import { GameScreen } from './screens/GameScreen';
import { ResultScreen } from './screens/ResultScreen';

// ── Background ─────────────────────────────────────────────────

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
  background-image:
    linear-gradient(rgba(255, 45, 120, 0.015) 1px, transparent 1px),
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

const ErrorToast = styled.div`
  position: fixed;
  bottom: 1.5rem;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(255, 68, 68, 0.12);
  border: 1px solid #ff4444;
  border-radius: 12px;
  padding: 0.75rem 1.25rem;
  color: #ff6b6b;
  font-size: 0.85rem;
  z-index: 100;
  animation: slideIn 0.3s ease-out;
  max-width: 90vw;
  text-align: center;
`;

// ── App ─────────────────────────────────────────────────────────

const PLAYER_TOKEN_KEY = 'tuneline_player_token';

function shouldPlayAudio(mode: AudioMode, isHost: boolean): boolean {
  return mode === 'all' || isHost;
}

export default function App() {
  // Navigation
  const [screen, setScreen] = useState<Screen>('login');

  // Spotify / host setup
  const [selectedPlaylists, setSelectedPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [hostName, setHostName] = useState('');
  const [rounds, setRounds] = useState(5);
  const [audioMode, setAudioMode] = useState<AudioMode>('host-only');
  const [loadingMsg, setLoadingMsg] = useState('');

  // Room
  const [roomCode, setRoomCode] = useState('');
  const [myPlayerId, setMyPlayerId] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [lobbyState, setLobbyState] = useState<LobbyState | null>(null);
  const [joinCode, setJoinCode] = useState('');

  // Game state (from server)
  const [gameState, setGameState] = useState<GameStateForClient | null>(null);
  const [currentSong, setCurrentSong] = useState<SongMeta | null>(null);
  const [revealedSong, setRevealedSong] = useState<SongFull | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [revealed, setRevealed] = useState(false);
  const [resultPlayers, setResultPlayers] = useState<RoomPlayer[]>([]);
  const [resultLastSong, setResultLastSong] = useState<SongFull | null>(null);
  const [resultLastCorrect, setResultLastCorrect] = useState(false);
  const [resultLastPlayerId, setResultLastPlayerId] = useState('');
  const [resultWinnerLastSong, setResultWinnerLastSong] = useState<SongFull | null>(null);
  const [slot, setSlot] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolumeState] = useState(() => getVolume());
  const [errorMsg, setErrorMsg] = useState('');
  const [disconnectedPlayer, setDisconnectedPlayer] = useState<{
    id: string;
    name: string;
    isHostDisconnected: boolean;
  } | null>(null);

  const showError = useCallback((msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(''), 4000);
  }, []);

  // ── Auth init ─────────────────────────────────────────────────

  useEffect(() => {
    const init = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const room = params.get('room');

      if (code) {
        window.history.replaceState({}, '', window.location.pathname);
        const success = await handleAuthCallback(code);
        if (success) setScreen('playlists');
      } else if (room) {
        window.history.replaceState({}, '', window.location.pathname);
        setJoinCode(room.toUpperCase());
        setScreen('join');
      } else if (isAuthenticated()) {
        const token = await getValidToken();
        if (token) setScreen('playlists');
      }
    };
    void init();
  }, []);

  // ── Socket event listeners ────────────────────────────────────

  useEffect(() => {
    socket.on('room_created', ({ roomCode: rc, playerId, playerToken }) => {
      setRoomCode(rc);
      setMyPlayerId(playerId);
      setIsHost(true);
      sessionStorage.setItem(PLAYER_TOKEN_KEY, playerToken);
      sessionStorage.setItem('tuneline_room_code', rc);
    });

    socket.on('room_joined', ({ playerId, playerToken, room }) => {
      setMyPlayerId(playerId);
      setIsHost(false);
      setLobbyState(room);
      setRoomCode(room.roomCode);
      sessionStorage.setItem(PLAYER_TOKEN_KEY, playerToken);
      sessionStorage.setItem('tuneline_room_code', room.roomCode);
      if (room.status !== 'playing') {
        setScreen('lobby');
      }
    });

    socket.on('room_updated', ({ room }) => {
      setLobbyState(room);
      // Sync audioMode and rounds into local state for host
      setAudioMode(room.audioMode);
      setRounds(room.rounds);
      if (room.status === 'lobby') {
        setScreen('lobby');
      }
    });

    socket.on('game_loading', () => {
      setLoadingMsg('Host lädt Songs…');
      setScreen('loading');
    });

    socket.on('game_started', ({ gameState: gs, currentSong: cs }) => {
      setGameState(gs);
      setCurrentSong(cs);
      setRevealedSong(null);
      setFeedback(null);
      setRevealed(false);
      setSlot(null);
      stopAudio();
      setPlaying(false);
      setScreen('game');

      if (cs.preview && shouldPlayAudio(gs.audioMode, isHost)) {
        playAudio(cs.preview);
        setPlaying(true);
      }
    });

    socket.on('placement_result', ({ correct, song, gameState: gs, nextSong }) => {
      setRevealedSong(song);
      setFeedback(correct ? 'ok' : 'no');
      setRevealed(true);
      setGameState(gs);
      stopAudio();
      setPlaying(false);

      setTimeout(() => {
        setFeedback(null);
        setRevealed(false);
        setRevealedSong(null);
        setSlot(null);

        if (nextSong) {
          setCurrentSong(nextSong);
          if (nextSong.preview && shouldPlayAudio(gs.audioMode, isHost)) {
            playAudio(nextSong.preview);
            setPlaying(true);
          }
        }
      }, 2200);
    });

    socket.on('game_over', ({ players, lastSong, lastCorrect, lastPlayerId, winnerLastSong }) => {
      stopAudio();
      setPlaying(false);
      setResultPlayers(players);
      setResultLastSong(lastSong);
      setResultLastCorrect(lastCorrect);
      setResultLastPlayerId(lastPlayerId);
      setResultWinnerLastSong(winnerLastSong ?? null);
      setScreen('result');
    });

    socket.on('player_kicked', () => {
      stopAudio();
      socket.disconnect();
      setScreen('login');
      showError('Du wurdest aus dem Raum entfernt.');
    });

    socket.on(
      'game_paused',
      ({ disconnectedPlayerId, disconnectedPlayerName, isHostDisconnected, gameState: gs }) => {
        setGameState(gs);
        stopAudio();
        setPlaying(false);
        setDisconnectedPlayer({
          id: disconnectedPlayerId,
          name: disconnectedPlayerName,
          isHostDisconnected,
        });
      }
    );

    socket.on('game_resumed', ({ gameState: gs, currentSong: cs }) => {
      setDisconnectedPlayer(null);
      setGameState(gs);
      setCurrentSong(cs);
      setRevealedSong(null);
      setFeedback(null);
      setRevealed(false);
      setSlot(null);
      setScreen('game');
      if (cs.preview && shouldPlayAudio(gs.audioMode, isHost)) {
        playAudio(cs.preview);
        setPlaying(true);
      }
    });

    socket.on('player_disconnected', () => {
      // handled via game_paused or room_updated
    });

    socket.on('error', ({ message }) => {
      showError(message);
    });

    return () => {
      socket.off('room_created');
      socket.off('room_joined');
      socket.off('room_updated');
      socket.off('game_loading');
      socket.off('game_started');
      socket.off('game_paused');
      socket.off('game_resumed');
      socket.off('placement_result');
      socket.off('game_over');
      socket.off('player_kicked');
      socket.off('player_disconnected');
      socket.off('error');
    };
  }, [isHost, showError]);

  // ── Playlist selection ────────────────────────────────────────

  const togglePlaylist = useCallback((playlist: SpotifyPlaylist) => {
    setSelectedPlaylists((prev) =>
      prev.some((p) => p.id === playlist.id)
        ? prev.filter((p) => p.id !== playlist.id)
        : [...prev, playlist]
    );
  }, []);

  const handleLogout = useCallback(() => {
    stopAudio();
    socket.disconnect();
    logout();
    setSelectedPlaylists([]);
    setScreen('login');
  }, []);

  // ── Create Room ───────────────────────────────────────────────

  const handleCreateRoom = useCallback(() => {
    const name = hostName.trim() || 'Host';
    if (!socket.connected) socket.connect();
    socket.emit('create_room', { hostName: name, rounds, audioMode });
    setLobbyState({
      roomCode: '',
      players: [],
      rounds,
      audioMode,
      status: 'lobby',
    });
    setScreen('lobby');
  }, [hostName, rounds, audioMode]);

  // ── Join Room ─────────────────────────────────────────────────

  const handleJoinRoom = useCallback((code: string, name: string) => {
    if (!socket.connected) socket.connect();
    const playerToken = sessionStorage.getItem(PLAYER_TOKEN_KEY) ?? undefined;
    socket.emit('join_room', { roomCode: code, playerName: name, playerToken });
    // screen transitions in socket.on('room_joined')
  }, []);

  // ── Lobby: host changes audioMode / rounds ────────────────────

  const handleAudioModeChange = useCallback(
    (mode: AudioMode) => {
      setAudioMode(mode);
      setLobbyState((prev) => (prev ? { ...prev, audioMode: mode } : prev));
      socket.emit('update_settings', { rounds, audioMode: mode });
    },
    [rounds]
  );

  const handleRoundsChange = useCallback(
    (r: number) => {
      setRounds(r);
      setLobbyState((prev) => (prev ? { ...prev, rounds: r } : prev));
      socket.emit('update_settings', { rounds: r, audioMode });
    },
    [audioMode]
  );

  // ── Start Game (host only) ────────────────────────────────────

  const handleStartGame = useCallback(async () => {
    setScreen('loading');
    setLoadingMsg('Songs werden geladen…');
    socket.emit('start_loading');

    const playerCount = lobbyState?.players.length ?? 1;

    const songs = await loadSongsFromPlaylists(selectedPlaylists.map((p) => p.id));

    if (songs.length < playerCount + 3) {
      setLoadingMsg('Nicht genug Songs. Bitte andere Playlisten wählen.');
      await new Promise((r) => setTimeout(r, 2000));
      setScreen('lobby');
      return;
    }

    // Convert client Song → SongFull for server
    const songsFull: SongFull[] = songs.map((s) => ({
      id: s.id,
      title: s.title,
      artist: s.artist,
      year: s.year,
      cover: s.cover,
      preview: s.preview,
    }));

    socket.emit('start_game', { songs: songsFull, rounds, audioMode });
    // Screen transitions to 'game' via socket.on('game_started')
  }, [lobbyState, selectedPlaylists, rounds, audioMode]);

  // ── Place Song ────────────────────────────────────────────────

  const handlePlace = useCallback(() => {
    if (slot === null || !gameState) return;
    socket.emit('place_song', { position: slot });
  }, [slot, gameState]);

  // ── Audio ─────────────────────────────────────────────────────

  const handleToggleAudio = useCallback(() => {
    setPlaying(toggleAudio());
  }, []);

  const handleVolumeChange = useCallback((v: number) => {
    setVolume(v);
    setVolumeState(v);
  }, []);

  // ── Kick / Leave ──────────────────────────────────────────────

  const handleKick = useCallback((playerId: string) => {
    socket.emit('kick_player', { playerId });
  }, []);

  const handleLeave = useCallback(() => {
    stopAudio();
    socket.disconnect();
    setRoomCode('');
    setMyPlayerId('');
    setLobbyState(null);
    setGameState(null);
    setScreen('menu');
  }, []);

  const handleSkipPlayer = useCallback(() => {
    socket.emit('skip_player');
  }, []);

  const handleRestart = useCallback(() => {
    stopAudio();
    setPlaying(false);
    setDisconnectedPlayer(null);
    socket.emit('return_to_lobby');
    // screen transitions to 'lobby' via socket.on('room_updated')
  }, []);

  // ── Render ────────────────────────────────────────────────────

  return (
    <Root>
      <GlobalStyles />
      <BgGrid />
      <BgGlowTop />
      <BgGlowBottom />

      {screen === 'login' && (
        <LoginScreen
          onJoinAsGuest={() => {
            const savedCode = sessionStorage.getItem('tuneline_room_code') ?? '';
            setJoinCode(savedCode);
            setScreen('join');
          }}
        />
      )}

      {screen === 'join' && (
        <JoinScreen
          initialCode={joinCode}
          onJoin={handleJoinRoom}
          onBack={() => setScreen('login')}
        />
      )}

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
          hostName={hostName}
          setHostName={setHostName}
          rounds={rounds}
          setRounds={setRounds}
          audioMode={audioMode}
          setAudioMode={setAudioMode}
          onCreateRoom={handleCreateRoom}
          onChangePlaylists={() => setScreen('playlists')}
        />
      )}

      {screen === 'loading' && <LoadingScreen message={loadingMsg} />}

      {screen === 'lobby' && lobbyState && (
        <LobbyScreen
          roomCode={roomCode}
          lobbyState={lobbyState}
          myPlayerId={myPlayerId}
          isHost={isHost}
          onStart={() => void handleStartGame()}
          onKick={handleKick}
          onLeave={handleLeave}
          onAudioModeChange={handleAudioModeChange}
          onRoundsChange={handleRoundsChange}
        />
      )}

      {screen === 'game' && gameState && currentSong && (
        <GameScreen
          myPlayerId={myPlayerId}
          roomCode={roomCode}
          isHost={isHost}
          gameState={gameState}
          currentSong={currentSong}
          revealedSong={revealedSong}
          feedback={feedback}
          revealed={revealed}
          playing={playing}
          volume={volume}
          slot={slot}
          setSlot={setSlot}
          onToggleAudio={handleToggleAudio}
          onVolumeChange={handleVolumeChange}
          onPlace={handlePlace}
          disconnectedPlayer={disconnectedPlayer}
          onSkipPlayer={handleSkipPlayer}
        />
      )}

      {screen === 'result' && (
        <ResultScreen
          players={resultPlayers}
          isHost={isHost}
          lastSong={resultLastSong}
          lastCorrect={resultLastCorrect}
          lastPlayerId={resultLastPlayerId}
          winnerLastSong={resultWinnerLastSong}
          onRestart={handleRestart}
        />
      )}

      {errorMsg && <ErrorToast>{errorMsg}</ErrorToast>}
    </Root>
  );
}
