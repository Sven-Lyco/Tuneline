import { useState, useEffect, useCallback } from 'react';
import styled from '@emotion/styled';
import type { SpotifyPlaylist } from './types';
import type { AudioMode, SongFull } from '@tuneline/shared';
import {
  handleAuthCallback,
  isAuthenticated,
  getValidToken,
  loadSongsFromPlaylists,
  logout,
} from './api/spotify';
import { stopAudio } from './utils/audio';
import { socket } from './socket';
import { useGameAudio } from './hooks/useGameAudio';
import { useSocketEvents } from './hooks/useSocketEvents';
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

export default function App() {
  const [selectedPlaylists, setSelectedPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [hostName, setHostName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const showError = useCallback((msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(''), 4000);
  }, []);

  const { playing, volume, startSong, stopSong, toggle, changeVolume } = useGameAudio();

  const {
    screen, setScreen,
    loadingMsg, setLoadingMsg,
    roomCode,
    myPlayerId,
    isHost,
    lobbyState, setLobbyState,
    audioMode, setAudioMode,
    rounds, setRounds,
    gameState,
    currentSong,
    revealedSong,
    feedback,
    revealed,
    slot, setSlot,
    disconnectedPlayer,
    result,
    resetRoom,
  } = useSocketEvents({ startSong, stopSong, showError });

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
  }, [setScreen]);

  // ── Playlist selection ────────────────────────────────────────

  const togglePlaylist = useCallback((playlist: SpotifyPlaylist) => {
    setSelectedPlaylists((prev) =>
      prev.some((p) => p.id === playlist.id)
        ? prev.filter((p) => p.id !== playlist.id)
        : [...prev, playlist]
    );
  }, []);

  const handleLogout = useCallback(() => {
    stopSong();
    socket.disconnect();
    logout();
    setSelectedPlaylists([]);
    setScreen('login');
  }, [stopSong, setScreen]);

  // ── Create / Join Room ────────────────────────────────────────

  const handleCreateRoom = useCallback(() => {
    const name = hostName.trim() || 'Host';
    if (!socket.connected) socket.connect();
    socket.emit('create_room', { hostName: name, rounds, audioMode });
    setLobbyState({ roomCode: '', players: [], rounds, audioMode, status: 'lobby' });
    setScreen('lobby');
  }, [hostName, rounds, audioMode, setLobbyState, setScreen]);

  const handleJoinRoom = useCallback((code: string, name: string) => {
    if (!socket.connected) socket.connect();
    const playerToken = sessionStorage.getItem('tuneline_player_token') ?? undefined;
    socket.emit('join_room', { roomCode: code, playerName: name, playerToken });
  }, []);

  // ── Lobby settings (host) ─────────────────────────────────────

  const handleAudioModeChange = useCallback(
    (mode: AudioMode) => {
      setAudioMode(mode);
      setLobbyState((prev) => (prev ? { ...prev, audioMode: mode } : prev));
      socket.emit('update_settings', { rounds, audioMode: mode });
    },
    [rounds, setAudioMode, setLobbyState]
  );

  const handleRoundsChange = useCallback(
    (r: number) => {
      setRounds(r);
      setLobbyState((prev) => (prev ? { ...prev, rounds: r } : prev));
      socket.emit('update_settings', { rounds: r, audioMode });
    },
    [audioMode, setRounds, setLobbyState]
  );

  // ── Start Game ────────────────────────────────────────────────

  const handleStartGame = useCallback(async () => {
    setLoadingMsg('Songs werden geladen…');
    setScreen('loading');
    socket.emit('start_loading');

    const playerCount = lobbyState?.players.length ?? 1;
    const songs = await loadSongsFromPlaylists(selectedPlaylists.map((p) => p.id));

    if (songs.length < playerCount + 3) {
      setLoadingMsg('Nicht genug Songs. Bitte andere Playlisten wählen.');
      await new Promise((r) => setTimeout(r, 2000));
      setScreen('lobby');
      return;
    }

    const songsFull: SongFull[] = songs.map((s) => ({
      id: s.id,
      title: s.title,
      artist: s.artist,
      year: s.year,
      cover: s.cover,
      preview: s.preview,
    }));

    socket.emit('start_game', { songs: songsFull, rounds, audioMode });
  }, [lobbyState, selectedPlaylists, rounds, audioMode, setLoadingMsg, setScreen]);

  // ── Game actions ──────────────────────────────────────────────

  const handlePlace = useCallback(() => {
    if (slot === null || !gameState) return;
    socket.emit('place_song', { position: slot });
  }, [slot, gameState]);

  const handleKick = useCallback((playerId: string) => {
    socket.emit('kick_player', { playerId });
  }, []);

  const handleSkipPlayer = useCallback(() => {
    socket.emit('skip_player');
  }, []);

  const handleLeave = useCallback(() => {
    stopAudio();
    socket.disconnect();
    resetRoom();
    setScreen('menu');
  }, [resetRoom, setScreen]);

  const handleRestart = useCallback(() => {
    stopSong();
    socket.emit('return_to_lobby');
  }, [stopSong]);

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
          onToggleAudio={toggle}
          onVolumeChange={changeVolume}
          onPlace={handlePlace}
          disconnectedPlayer={disconnectedPlayer}
          onSkipPlayer={handleSkipPlayer}
        />
      )}

      {screen === 'result' && result && (
        <ResultScreen
          players={result.players}
          isHost={isHost}
          lastSong={result.lastSong}
          lastCorrect={result.lastCorrect}
          lastPlayerId={result.lastPlayerId}
          winnerLastSong={result.winnerLastSong}
          onRestart={handleRestart}
        />
      )}

      {errorMsg && <ErrorToast>{errorMsg}</ErrorToast>}
    </Root>
  );
}
