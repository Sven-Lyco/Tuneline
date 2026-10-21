import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import styled from '@emotion/styled';
import type { SpotifyPlaylist } from './types';
import { STORAGE_KEYS } from './constants';
import type { AudioMode } from '@tuneline/shared';
import { isAuthenticated, loadSongsFromPlaylists, logout } from './api/spotify';
import { socket } from './socket';
import { useGameAudio } from './hooks/useGameAudio';
import { useSocketEvents } from './hooks/useSocketEvents';
import {
  clearSessionRoom,
  discardLastRoom,
  readLastRoom,
  storeSessionRoom,
  type LastRoom,
} from './utils/roomStorage';
import { isSeatActiveElsewhere } from './utils/tabPresence';
import { GlobalStyles } from './components/GlobalStyles';
import { ResumeBanner } from './components/ResumeBanner';
import { LoginScreen } from './screens/LoginScreen';
import { JoinScreen } from './screens/JoinScreen';
import { PlaylistScreen } from './screens/PlaylistScreen';
import { MenuScreen } from './screens/MenuScreen';
import { LoadingScreen } from './screens/LoadingScreen';
import { LobbyScreen } from './screens/LobbyScreen';
import { GameScreen } from './screens/GameScreen';
import { ResultScreen } from './screens/ResultScreen';
const HelpScreen = lazy(() =>
  import('./screens/HelpScreen').then((m) => ({ default: m.HelpScreen }))
);

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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function loadStoredPlaylists(): SpotifyPlaylist[] {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEYS.selectedPlaylists) ?? '[]');
  } catch {
    return [];
  }
}

type Settings = { rounds: number; audioMode: AudioMode; turnLimit: number };

/** Screens where a tab without a room may offer to go back to the last one. */
const RESUME_SCREENS = new Set(['login', 'playlists', 'menu', 'join']);

// ── App ─────────────────────────────────────────────────────────

export default function App() {
  // Kept in sessionStorage so a host who reloads can start the next game right away.
  const [selectedPlaylists, setSelectedPlaylists] = useState(loadStoredPlaylists);
  const [hostName, setHostName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [playlistReturnTarget, setPlaylistReturnTarget] = useState<'menu' | 'lobby'>('menu');
  const [songLoad, setSongLoad] = useState<AbortController | null>(null);

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEYS.selectedPlaylists, JSON.stringify(selectedPlaylists));
  }, [selectedPlaylists]);

  const showError = useCallback((msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(''), 4000);
  }, []);

  const { playing, volume, startSong, stopSong, toggle, changeVolume } = useGameAudio();

  const {
    screen,
    setScreen,
    loadingMsg,
    setLoadingMsg,
    roomCode,
    myPlayerId,
    isHost,
    lobbyState,
    setLobbyState,
    audioMode,
    setAudioMode,
    rounds,
    setRounds,
    turnLimit,
    setTurnLimit,
    gameState,
    turnEndsAt,
    currentSong,
    revealedSong,
    feedback,
    revealed,
    lastPlacedPlayerId,
    slot,
    setSlot,
    placing,
    placeSong,
    disconnectedPlayer,
    result,
    getPlayedSongIds,
    exitRoom,
  } = useSocketEvents({ startSong, stopSong, showError });

  // ── Auth init ─────────────────────────────────────────────────

  /** Takes a stored seat back (reload or "back to game"); the socket hook routes on the answer. */
  const rejoin = useCallback(
    (code: string, playerToken: string) => {
      // Lets a failed rejoin find and drop the saved room, and a reload retry it.
      storeSessionRoom(code, playerToken);
      setLoadingMsg('Verbinde mit dem Raum…');
      setScreen('loading');
      if (!socket.connected) socket.connect();
      socket.emit('rejoin_room', { roomCode: code, playerToken });
    },
    [setLoadingMsg, setScreen]
  );

  // Read once: StrictMode runs the init effect twice and the first run strips the query string.
  const [initialParams] = useState(() => new URLSearchParams(window.location.search));

  useEffect(() => {
    const init = async () => {
      const authenticated = initialParams.get('authenticated');
      const authError = initialParams.get('auth_error');
      const room = initialParams.get('room')?.toUpperCase();
      const storedRoom = sessionStorage.getItem(STORAGE_KEYS.roomCode);
      const storedToken = sessionStorage.getItem(STORAGE_KEYS.playerToken);
      // (URLSearchParams.size is missing in Safari < 17.)
      if (window.location.search) window.history.replaceState({}, '', window.location.pathname);

      if (authenticated) {
        setScreen('playlists');
        return;
      }
      if (authError) {
        showError('Spotify-Login fehlgeschlagen. Bitte erneut versuchen.');
        return;
      }
      if (storedRoom && storedToken && (!room || room === storedRoom)) {
        // A duplicated tab copies sessionStorage — the original keeps the seat, this one starts fresh.
        if (!(await isSeatActiveElsewhere(storedToken))) {
          rejoin(storedRoom, storedToken);
          return;
        }
        clearSessionRoom();
      }
      if (room) {
        setJoinCode(room);
        setScreen('join');
        return;
      }
      setScreen((await isAuthenticated()) ? 'playlists' : 'login');
    };
    void init();
  }, [initialParams, rejoin, setScreen, showError]);

  // ── Back to the last room after the tab was closed ────────────

  const [freeSeatToken, setFreeSeatToken] = useState<string | null>(null);
  const resumeCandidate = !roomCode && RESUME_SCREENS.has(screen) ? readLastRoom() : null;
  const candidateToken = resumeCandidate?.playerToken ?? null;

  useEffect(() => {
    if (!candidateToken) return;
    let cancelled = false;
    // Offering a seat another open tab still plays would let this tab steal it.
    void isSeatActiveElsewhere(candidateToken).then((active) => {
      if (!cancelled) setFreeSeatToken(active ? null : candidateToken);
    });
    return () => {
      cancelled = true;
    };
  }, [candidateToken]);

  const resumable = resumeCandidate && freeSeatToken === candidateToken ? resumeCandidate : null;

  const handleResume = useCallback(
    (last: LastRoom) => rejoin(last.roomCode, last.playerToken),
    [rejoin]
  );

  const handleDismissResume = useCallback(() => {
    discardLastRoom();
    setFreeSeatToken(null);
  }, []);

  // ── Playlist selection ────────────────────────────────────────

  const togglePlaylist = useCallback((playlist: SpotifyPlaylist) => {
    setSelectedPlaylists((prev) =>
      prev.some((p) => p.id === playlist.id)
        ? prev.filter((p) => p.id !== playlist.id)
        : [...prev, playlist]
    );
  }, []);

  // ── Create / Join / Leave Room ────────────────────────────────

  const handleCreateRoom = useCallback(() => {
    const name = hostName.trim() || 'Host';
    if (!socket.connected) socket.connect();
    socket.emit('create_room', { hostName: name, rounds, audioMode, turnLimit });
    setLobbyState({ roomCode: '', players: [], rounds, audioMode, turnLimit, status: 'lobby' });
    setScreen('lobby');
  }, [hostName, rounds, audioMode, turnLimit, setLobbyState, setScreen]);

  const handleJoinRoom = useCallback((code: string, name: string) => {
    if (!socket.connected) socket.connect();
    const playerToken = sessionStorage.getItem(STORAGE_KEYS.playerToken) ?? undefined;
    socket.emit('join_room', { roomCode: code, playerName: name, playerToken });
  }, []);

  const handleLeave = useCallback(() => {
    exitRoom();
    setScreen(isHost ? 'menu' : 'login');
  }, [isHost, exitRoom, setScreen]);

  const handleLogout = useCallback(() => {
    exitRoom();
    void logout();
    setSelectedPlaylists([]);
    setScreen('login');
  }, [exitRoom, setScreen]);

  // ── Lobby settings (host) ─────────────────────────────────────

  const updateSettings = useCallback(
    (patch: Partial<Settings>) => {
      const next: Settings = { rounds, audioMode, turnLimit, ...patch };
      setRounds(next.rounds);
      setAudioMode(next.audioMode);
      setTurnLimit(next.turnLimit);
      setLobbyState((prev) => (prev ? { ...prev, ...next } : prev));
      socket.emit('update_settings', next);
    },
    [rounds, audioMode, turnLimit, setRounds, setAudioMode, setTurnLimit, setLobbyState]
  );

  // ── Start Game ────────────────────────────────────────────────

  const handleStartGame = useCallback(async () => {
    const load = new AbortController();
    setSongLoad(load);
    setLoadingMsg('Songs werden geladen…');
    setScreen('loading');
    socket.emit('start_loading');

    const playerCount = lobbyState?.players.filter((p) => p.isConnected).length ?? 1;
    const songsNeeded = Math.ceil(playerCount * (rounds + 1) * 1.5);
    const songs = await loadSongsFromPlaylists(
      selectedPlaylists.map((p) => p.id),
      songsNeeded,
      getPlayedSongIds(),
      load.signal
    );
    if (load.signal.aborted) return;
    setSongLoad(null);

    // Matches the server's minimum: a starting card plus at least one turn per player.
    if (songs.length < Math.max(playerCount + 3, playerCount * 2)) {
      socket.emit('cancel_loading');
      setLoadingMsg('Nicht genug Songs gefunden. Bitte andere Playlisten wählen.');
      await sleep(2000);
      setScreen('lobby');
      return;
    }

    socket.emit('start_game', { songs, rounds, audioMode });
  }, [
    lobbyState,
    selectedPlaylists,
    rounds,
    audioMode,
    getPlayedSongIds,
    setLoadingMsg,
    setScreen,
  ]);

  const handleCancelLoading = useCallback(() => {
    songLoad?.abort();
    setSongLoad(null);
    socket.emit('cancel_loading');
    setScreen('lobby');
  }, [songLoad, setScreen]);

  // ── Game actions ──────────────────────────────────────────────

  const handlePlace = useCallback(() => {
    if (slot === null || placing) return;
    placeSong(slot);
  }, [slot, placing, placeSong]);

  const handleKick = useCallback((playerId: string) => {
    socket.emit('kick_player', { playerId });
  }, []);

  const handleSkipPlayer = useCallback(() => {
    socket.emit('skip_player');
  }, []);

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
            const savedCode = sessionStorage.getItem(STORAGE_KEYS.roomCode) ?? '';
            setJoinCode(savedCode);
            setScreen('join');
          }}
          onHelp={() => setScreen('help')}
        />
      )}

      {screen === 'help' && (
        <Suspense fallback={null}>
          <HelpScreen onBack={() => setScreen('login')} />
        </Suspense>
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
          onConfirm={() => setScreen(playlistReturnTarget)}
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
          turnLimit={turnLimit}
          setTurnLimit={setTurnLimit}
          onCreateRoom={handleCreateRoom}
          onChangePlaylists={() => {
            setPlaylistReturnTarget('menu');
            setScreen('playlists');
          }}
        />
      )}

      {screen === 'loading' && (
        <LoadingScreen message={loadingMsg} onCancel={songLoad ? handleCancelLoading : undefined} />
      )}

      {screen === 'lobby' && lobbyState && (
        <LobbyScreen
          roomCode={roomCode}
          lobbyState={lobbyState}
          myPlayerId={myPlayerId}
          isHost={isHost}
          selectedPlaylists={selectedPlaylists}
          onStart={() => void handleStartGame()}
          onKick={handleKick}
          onLeave={handleLeave}
          onAudioModeChange={(mode) => updateSettings({ audioMode: mode })}
          onRoundsChange={(r) => updateSettings({ rounds: r })}
          onTurnLimitChange={(s) => updateSettings({ turnLimit: s })}
          onChangePlaylists={() => {
            setPlaylistReturnTarget('lobby');
            setScreen('playlists');
          }}
        />
      )}

      {screen === 'game' && gameState && currentSong && (
        <GameScreen
          myPlayerId={myPlayerId}
          roomCode={roomCode}
          isHost={isHost}
          gameState={gameState}
          turnEndsAt={turnEndsAt}
          revealedSong={revealedSong}
          feedback={feedback}
          revealed={revealed}
          lastPlacedPlayerId={lastPlacedPlayerId}
          playing={playing}
          volume={volume}
          slot={slot}
          setSlot={setSlot}
          placing={placing}
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
          onLeave={handleLeave}
        />
      )}

      {resumable && (
        <ResumeBanner
          room={resumable}
          onResume={() => handleResume(resumable)}
          onDismiss={handleDismissResume}
        />
      )}

      {errorMsg && <ErrorToast>{errorMsg}</ErrorToast>}
    </Root>
  );
}
