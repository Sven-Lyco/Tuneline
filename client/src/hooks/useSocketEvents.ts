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
import {
  clearSessionRoom,
  clearStoredRoom,
  saveLastRoom,
  storeSessionRoom,
} from '../utils/roomStorage';

function shouldPlay(audioMode: AudioMode, isHost: boolean): boolean {
  return audioMode === 'all' || isHost;
}

// Same cap as the server's /api/songs validation.
const MAX_EXCLUDED_SONGS = 1000;

function toFeedback(correct: boolean, timedOut: boolean): Feedback {
  if (correct) return 'ok';
  return timedOut ? 'timeout' : 'no';
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
  /** Leaves the room for good (leave button, logout). */
  exitRoom: () => void;
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
  const roomCodeRef = useRef(roomCode);
  const gameStateRef = useRef(gameState);
  const roundsRef = useRef(rounds);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pendingPauseRef = useRef<PendingPause | null>(null);
  const playedSongIdsRef = useRef(new Set<string>());
  useEffect(() => {
    isHostRef.current = isHost;
    roomCodeRef.current = roomCode;
    gameStateRef.current = gameState;
    roundsRef.current = rounds;
  });

  // Remember the seat beyond this tab, so closing it doesn't lose the game ("back to game" offer).
  useEffect(() => {
    const playerToken = sessionStorage.getItem(STORAGE_KEYS.playerToken);
    const me = (gameState?.players ?? [])
      .concat(lobbyState?.players ?? [])
      .find((p) => p.id === myPlayerId);
    if (roomCode && playerToken && me) saveLastRoom({ roomCode, playerToken, playerName: me.name });
  }, [roomCode, myPlayerId, lobbyState, gameState]);

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

  /** keepLastRoom: another tab now holds the seat and owns the saved room. */
  const teardown = useCallback(
    (keepLastRoom: boolean) => {
      if (keepLastRoom) clearSessionRoom();
      else clearStoredRoom();
      stopSong();
      resetRoom();
      socket.disconnect();
    },
    [stopSong, resetRoom]
  );

  /** Leaves for good: the server drops us from the lobby/result, or closes the room for the host. */
  const exitRoom = useCallback(() => {
    // socket.io buffers emits while offline; a late leave_room would hit the next room we join.
    if (socket.connected) socket.emit('leave_room');
    teardown(false);
  }, [teardown]);

  const placeSong = useCallback((position: number) => {
    setPlacing(true);
    socket.emit('place_song', { position });
  }, []);

  // The server takes at most this many exclusions; the most recent songs matter most.
  const getPlayedSongIds = useCallback(
    () => [...playedSongIdsRef.current].slice(-MAX_EXCLUDED_SONGS),
    []
  );

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
    const leaveRoom = (message: string, keepLastRoom = false) => {
      teardown(keepLastRoom);
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
      isHostRef.current = true;
      roomCodeRef.current = rc;
      setRoomCode(rc);
      setMyPlayerId(playerId);
      setIsHost(true);
      storeSessionRoom(rc, playerToken);
    });

    socket.on('room_joined', ({ playerId, playerToken, room }) => {
      const host = room.players.find((p) => p.id === playerId)?.isHost ?? false;
      const reconnected = roomCodeRef.current === room.roomCode;
      // game_resumed can follow before the next render; it must already see the host role.
      isHostRef.current = host;
      roomCodeRef.current = room.roomCode;
      setMyPlayerId(playerId);
      setIsHost(host);
      setLobbyState(room);
      setRoomCode(room.roomCode);
      setAudioMode(room.audioMode);
      setRounds(room.rounds);
      setTurnLimit(room.turnLimit);
      storeSessionRoom(room.roomCode, playerToken);
      // 'playing' and 'finished' are followed by game_resumed/game_paused/game_over.
      // A reconnect must not pull the host out of the playlist picker or a running song load.
      if (room.status === 'lobby') {
        setScreen((prev) =>
          reconnected && (prev === 'playlists' || prev === 'loading') ? prev : 'lobby'
        );
      }
    });

    socket.on('rejoin_failed', () => leaveRoom('Der Raum existiert nicht mehr.'));
    socket.on('room_closed', () => leaveRoom('Der Host hat den Raum geschlossen.'));
    socket.on('player_kicked', () => leaveRoom('Du wurdest aus dem Raum entfernt.'));
    socket.on('session_replaced', () =>
      leaveRoom('Du spielst jetzt in einem anderen Tab weiter.', true)
    );
    socket.on('server_restarting', () =>
      showError('Der Server startet neu – laufende Spiele gehen dabei leider verloren.')
    );
    // The server caps connections per network (MAX_SOCKETS_PER_IP); it doesn't retry by itself.
    socket.on('connect_error', (err) => {
      if (err.message === 'too_many_connections') {
        showError('Zu viele Verbindungen aus deinem Netzwerk – bitte kurz warten.');
      }
    });

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

    socket.on(
      'game_over',
      ({ players, lastSong, lastCorrect, lastTimedOut, lastPlayerId, winnerLastSong }) => {
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
          setFeedback(toFeedback(lastCorrect, lastTimedOut));
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
      }
    );

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
      socket.off('session_replaced');
      socket.off('server_restarting');
      socket.off('connect_error');
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
  }, [startSong, stopSong, showError, resetRoom, teardown]);

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
    exitRoom,
  };
}
