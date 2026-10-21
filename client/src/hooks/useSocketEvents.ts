import { useState, useEffect, useRef, useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type {
  AudioMode,
  GameStateForClient,
  LobbyState,
  SongFull,
  SongMeta,
} from '@tuneline/shared';
import { REVEAL_DURATION_MS } from '@tuneline/shared';
import type { Feedback, GameResult, Screen } from '../types';
import { socket } from '../socket';
import { STORAGE_KEYS } from '../constants';
import { isAuthenticated } from '../api/spotify';

function shouldPlay(audioMode: AudioMode, isHost: boolean): boolean {
  return audioMode === 'all' || isHost;
}

function toFeedback(correct: boolean, timedOut: boolean): Feedback {
  if (correct) return 'ok';
  return timedOut ? 'timeout' : 'no';
}

/** Forget the room so neither a reload nor a reconnect tries to rejoin it. */
export function clearStoredRoom(): void {
  sessionStorage.removeItem(STORAGE_KEYS.playerToken);
  sessionStorage.removeItem(STORAGE_KEYS.roomCode);
}

type DisconnectedPlayer = { id: string; name: string; isHostDisconnected: boolean };

interface PendingPause {
  gameState: GameStateForClient;
  currentSong: SongMeta;
  player: DisconnectedPlayer;
}

interface UseSocketEventsOptions {
  startSong: (preview: string) => void;
  stopSong: () => void;
  showError: (msg: string) => void;
}

export interface SocketState {
  screen: Screen;
  setScreen: Dispatch<SetStateAction<Screen>>;
  loadingMsg: string;
  setLoadingMsg: Dispatch<SetStateAction<string>>;
  roomCode: string;
  myPlayerId: string;
  isHost: boolean;
  lobbyState: LobbyState | null;
  setLobbyState: Dispatch<SetStateAction<LobbyState | null>>;
  audioMode: AudioMode;
  setAudioMode: Dispatch<SetStateAction<AudioMode>>;
  rounds: number;
  setRounds: Dispatch<SetStateAction<number>>;
  turnLimit: number;
  setTurnLimit: Dispatch<SetStateAction<number>>;
  gameState: GameStateForClient | null;
  /** Local clock time the current turn ends at; null = no limit or paused. */
  turnEndsAt: number | null;
  currentSong: SongMeta | null;
  revealedSong: SongFull | null;
  feedback: Feedback;
  revealed: boolean;
  lastPlacedPlayerId: string | null;
  slot: number | null;
  setSlot: Dispatch<SetStateAction<number | null>>;
  /** A placement was sent and its result hasn't arrived yet. */
  placing: boolean;
  placeSong: (position: number) => void;
  disconnectedPlayer: DisconnectedPlayer | null;
  result: GameResult | null;
  /** Songs already used in this room, so the next game can avoid them. */
  getPlayedSongIds: () => string[];
  resetRoom: () => void;
}

export function useSocketEvents({
  startSong,
  stopSong,
  showError,
}: UseSocketEventsOptions): SocketState {
  const [screen, setScreen] = useState<Screen>('login');
  const [loadingMsg, setLoadingMsg] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [myPlayerId, setMyPlayerId] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [lobbyState, setLobbyState] = useState<LobbyState | null>(null);
  const [audioMode, setAudioMode] = useState<AudioMode>('host-only');
  const [rounds, setRounds] = useState(5);
  const [turnLimit, setTurnLimit] = useState(0);
  const [gameState, setGameState] = useState<GameStateForClient | null>(null);
  const [turnEndsAt, setTurnEndsAt] = useState<number | null>(null);
  const [currentSong, setCurrentSong] = useState<SongMeta | null>(null);
  const [revealedSong, setRevealedSong] = useState<SongFull | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [revealed, setRevealed] = useState(false);
  const [lastPlacedPlayerId, setLastPlacedPlayerId] = useState<string | null>(null);
  const [slot, setSlot] = useState<number | null>(null);
  const [placing, setPlacing] = useState(false);
  const [disconnectedPlayer, setDisconnectedPlayer] = useState<DisconnectedPlayer | null>(null);
  const [result, setResult] = useState<GameResult | null>(null);

  // Refs so socket callbacks always see current values without re-registering
  const isHostRef = useRef(isHost);
  const gameStateRef = useRef(gameState);
  const roundsRef = useRef(rounds);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pendingPauseRef = useRef<PendingPause | null>(null);
  const playedSongIdsRef = useRef(new Set<string>());
  useEffect(() => {
    isHostRef.current = isHost;
    gameStateRef.current = gameState;
    roundsRef.current = rounds;
  });

  const resetRoom = useCallback(() => {
    clearTimeout(revealTimerRef.current);
    revealTimerRef.current = undefined;
    pendingPauseRef.current = null;
    playedSongIdsRef.current = new Set();
    setRoomCode('');
    setMyPlayerId('');
    setIsHost(false);
    setLobbyState(null);
    setGameState(null);
    setTurnEndsAt(null);
    setPlacing(false);
    setDisconnectedPlayer(null);
    setResult(null);
  }, []);

  const placeSong = useCallback((position: number) => {
    setPlacing(true);
    socket.emit('place_song', { position });
  }, []);

  const getPlayedSongIds = useCallback(() => [...playedSongIdsRef.current], []);

  useEffect(() => {
    const clearRevealTimer = () => {
      clearTimeout(revealTimerRef.current);
      revealTimerRef.current = undefined;
    };

    const applyGameState = (gs: GameStateForClient) => {
      setGameState(gs);
      setTurnEndsAt(gs.turnEndsInMs === null ? null : Date.now() + gs.turnEndsInMs);
    };

    // Hides the last placement's reveal and cancels its pending timeout.
    const clearReveal = () => {
      clearRevealTimer();
      setFeedback(null);
      setRevealed(false);
      setRevealedSong(null);
      setLastPlacedPlayerId(null);
      setSlot(null);
    };

    const showTurn = (gs: GameStateForClient, cs: SongMeta) => {
      clearReveal();
      applyGameState(gs);
      setCurrentSong(cs);
      setPlacing(false);
      setScreen('game');
    };

    const playIfAllowed = (gs: GameStateForClient, song: SongMeta) => {
      if (song.preview && shouldPlay(gs.audioMode, isHostRef.current)) startSong(song.preview);
    };

    const applyPause = ({ gameState: gs, currentSong: cs, player }: PendingPause) => {
      stopSong();
      showTurn(gs, cs);
      setDisconnectedPlayer(player);
    };

    // We're no longer in a room (closed, kicked, gone after a restart): back to a start screen.
    const leaveRoom = (message: string) => {
      clearStoredRoom();
      stopSong();
      resetRoom();
      socket.disconnect();
      showError(message);
      void isAuthenticated().then((auth) => setScreen(auth ? 'playlists' : 'login'));
    };

    // Automatic reconnects get a new socket id, so the server must be told who we are again.
    // Manual disconnects (leave, kick, logout) never fire 'reconnect'.
    const handleReconnect = () => {
      const playerToken = sessionStorage.getItem(STORAGE_KEYS.playerToken);
      const roomCode = sessionStorage.getItem(STORAGE_KEYS.roomCode);
      if (playerToken && roomCode) socket.emit('rejoin_room', { roomCode, playerToken });
    };
    socket.io.on('reconnect', handleReconnect);

    socket.on('room_created', ({ roomCode: rc, playerId, playerToken }) => {
      setRoomCode(rc);
      setMyPlayerId(playerId);
      setIsHost(true);
      sessionStorage.setItem(STORAGE_KEYS.playerToken, playerToken);
      sessionStorage.setItem(STORAGE_KEYS.roomCode, rc);
    });

    socket.on('room_joined', ({ playerId, playerToken, room }) => {
      setMyPlayerId(playerId);
      setIsHost(room.players.find((p) => p.id === playerId)?.isHost ?? false);
      setLobbyState(room);
      setRoomCode(room.roomCode);
      setAudioMode(room.audioMode);
      setRounds(room.rounds);
      setTurnLimit(room.turnLimit);
      sessionStorage.setItem(STORAGE_KEYS.playerToken, playerToken);
      sessionStorage.setItem(STORAGE_KEYS.roomCode, room.roomCode);
      // 'playing' and 'finished' are followed by game_resumed/game_paused/game_over
      if (room.status === 'lobby') {
        setScreen('lobby');
      }
    });

    socket.on('rejoin_failed', () => leaveRoom('Der Raum existiert nicht mehr.'));
    socket.on('room_closed', () => leaveRoom('Der Host hat den Raum geschlossen.'));
    socket.on('player_kicked', () => leaveRoom('Du wurdest aus dem Raum entfernt.'));
    socket.on('server_restarting', () =>
      showError('Der Server startet neu – laufende Spiele gehen dabei leider verloren.')
    );

    socket.on('room_updated', ({ room }) => {
      setLobbyState(room);
      setAudioMode(room.audioMode);
      setRounds(room.rounds);
      setTurnLimit(room.turnLimit);
      // Only leave game/result screens (return to lobby); never interrupt playlist or loading screens.
      if (room.status === 'lobby') {
        setScreen((prev) => (prev === 'game' || prev === 'result' ? 'lobby' : prev));
      }
    });

    socket.on('game_loading', () => {
      setLoadingMsg('Host lädt Songs…');
      setScreen('loading');
    });

    socket.on('game_loading_cancelled', () => {
      setScreen((prev) => (prev === 'loading' ? 'lobby' : prev));
    });

    socket.on('game_started', ({ gameState: gs, currentSong: cs }) => {
      pendingPauseRef.current = null;
      setDisconnectedPlayer(null);
      for (const p of gs.players) for (const s of p.timeline) playedSongIdsRef.current.add(s.id);
      if (isHostRef.current && gs.rounds < roundsRef.current) {
        showError(`Nicht genug Songs für ${roundsRef.current} Runden – ihr spielt ${gs.rounds}.`);
      }
      stopSong();
      showTurn(gs, cs);
      playIfAllowed(gs, cs);
    });

    socket.on('placement_result', ({ correct, timedOut, song, gameState: gs, nextSong }) => {
      playedSongIdsRef.current.add(song.id);
      setLastPlacedPlayerId(gameStateRef.current?.currentPlayerId ?? null);
      setRevealedSong(song);
      setFeedback(toFeedback(correct, timedOut));
      setRevealed(true);
      setPlacing(false);
      applyGameState(gs);
      stopSong();

      clearRevealTimer();
      revealTimerRef.current = setTimeout(() => {
        revealTimerRef.current = undefined;
        // The next player went offline meanwhile: show the pause now that the reveal is over.
        const pause = pendingPauseRef.current;
        pendingPauseRef.current = null;
        if (pause) return applyPause(pause);

        clearReveal();
        if (nextSong) {
          setCurrentSong(nextSong);
          playIfAllowed(gs, nextSong);
        }
      }, REVEAL_DURATION_MS);
    });

    socket.on('game_over', ({ players, lastSong, lastCorrect, lastPlayerId, winnerLastSong }) => {
      clearRevealTimer();
      pendingPauseRef.current = null;
      setPlacing(false);
      setDisconnectedPlayer(null);
      stopSong();
      if (lastSong) playedSongIdsRef.current.add(lastSong.id);
      const resultData = {
        players,
        lastSong,
        lastCorrect,
        lastPlayerId,
        winnerLastSong: winnerLastSong ?? null,
      };
      if (lastSong) {
        setLastPlacedPlayerId(lastPlayerId);
        setRevealedSong(lastSong);
        setFeedback(lastCorrect ? 'ok' : 'no');
        setRevealed(true);
        revealTimerRef.current = setTimeout(() => {
          clearReveal();
          setResult(resultData);
          setScreen('result');
        }, REVEAL_DURATION_MS);
      } else {
        setResult(resultData);
        setScreen('result');
      }
    });

    socket.on(
      'game_paused',
      ({
        disconnectedPlayerId,
        disconnectedPlayerName,
        isHostDisconnected,
        gameState: gs,
        currentSong: cs,
      }) => {
        const pause = {
          gameState: gs,
          currentSong: cs,
          player: { id: disconnectedPlayerId, name: disconnectedPlayerName, isHostDisconnected },
        };
        setPlacing(false);
        // Let a running reveal finish first; its timeout applies the pause.
        if (revealTimerRef.current !== undefined) pendingPauseRef.current = pause;
        else applyPause(pause);
      }
    );

    socket.on('game_resumed', ({ gameState: gs, currentSong: cs }) => {
      pendingPauseRef.current = null;
      setDisconnectedPlayer(null);
      showTurn(gs, cs);
      playIfAllowed(gs, cs);
    });

    socket.on('game_state_updated', ({ gameState: gs }) => applyGameState(gs));

    socket.on('error', ({ message }) => {
      setPlacing(false);
      showError(message);
    });

    return () => {
      clearRevealTimer();
      socket.io.off('reconnect', handleReconnect);
      socket.off('room_created');
      socket.off('room_joined');
      socket.off('rejoin_failed');
      socket.off('room_closed');
      socket.off('player_kicked');
      socket.off('server_restarting');
      socket.off('room_updated');
      socket.off('game_loading');
      socket.off('game_loading_cancelled');
      socket.off('game_started');
      socket.off('placement_result');
      socket.off('game_over');
      socket.off('game_paused');
      socket.off('game_resumed');
      socket.off('game_state_updated');
      socket.off('error');
    };
  }, [startSong, stopSong, showError, resetRoom]);

  return {
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
    resetRoom,
  };
}
