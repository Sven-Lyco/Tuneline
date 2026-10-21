import { useState, useEffect, useRef, useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type {
  AudioMode,
  GameStateForClient,
  LobbyState,
  SongFull,
  SongMeta,
} from '@tuneline/shared';
import type { Feedback, GameResult, Screen } from '../types';
import { socket } from '../socket';
import { STORAGE_KEYS } from '../constants';

function shouldPlay(audioMode: AudioMode, isHost: boolean): boolean {
  return audioMode === 'all' || isHost;
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
  gameState: GameStateForClient | null;
  setGameState: Dispatch<SetStateAction<GameStateForClient | null>>;
  currentSong: SongMeta | null;
  revealedSong: SongFull | null;
  feedback: Feedback;
  revealed: boolean;
  lastPlacedPlayerId: string | null;
  slot: number | null;
  setSlot: Dispatch<SetStateAction<number | null>>;
  disconnectedPlayer: { id: string; name: string; isHostDisconnected: boolean } | null;
  result: GameResult | null;
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
  const [gameState, setGameState] = useState<GameStateForClient | null>(null);
  const [currentSong, setCurrentSong] = useState<SongMeta | null>(null);
  const [revealedSong, setRevealedSong] = useState<SongFull | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [revealed, setRevealed] = useState(false);
  const [lastPlacedPlayerId, setLastPlacedPlayerId] = useState<string | null>(null);
  const [slot, setSlot] = useState<number | null>(null);
  const [disconnectedPlayer, setDisconnectedPlayer] = useState<{
    id: string;
    name: string;
    isHostDisconnected: boolean;
  } | null>(null);
  const [result, setResult] = useState<GameResult | null>(null);

  // Refs so socket callbacks always see current values without re-registering
  const isHostRef = useRef(isHost);
  const gameStateRef = useRef(gameState);
  const myNameRef = useRef('');
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    isHostRef.current = isHost;
  });
  useEffect(() => {
    gameStateRef.current = gameState;
  });
  useEffect(() => {
    const me = (gameState?.players ?? [])
      .concat(lobbyState?.players ?? [])
      .find((p) => p.id === myPlayerId);
    if (me) myNameRef.current = me.name;
  });

  const resetRoom = useCallback(() => {
    clearTimeout(revealTimerRef.current);
    myNameRef.current = '';
    setRoomCode('');
    setMyPlayerId('');
    setIsHost(false);
    setLobbyState(null);
    setGameState(null);
    setDisconnectedPlayer(null);
    setResult(null);
  }, []);

  useEffect(() => {
    const clearRevealTimer = () => clearTimeout(revealTimerRef.current);

    // Automatic reconnects get a new socket id, so the server must be told who we are again.
    // Manual disconnects (leave, kick, logout) never fire 'reconnect'.
    const handleReconnect = () => {
      const playerToken = sessionStorage.getItem(STORAGE_KEYS.playerToken);
      const roomCode = sessionStorage.getItem(STORAGE_KEYS.roomCode);
      const playerName = myNameRef.current;
      if (playerToken && roomCode && playerName) {
        socket.emit('join_room', { roomCode, playerName, playerToken });
      }
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
      sessionStorage.setItem(STORAGE_KEYS.playerToken, playerToken);
      sessionStorage.setItem(STORAGE_KEYS.roomCode, room.roomCode);
      // 'playing' and 'finished' are followed by game_resumed/game_paused/game_over
      if (room.status === 'lobby') {
        setScreen('lobby');
      }
    });

    socket.on('room_updated', ({ room }) => {
      setLobbyState(room);
      setAudioMode(room.audioMode);
      setRounds(room.rounds);
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
      clearRevealTimer();
      setGameState(gs);
      setCurrentSong(cs);
      setRevealedSong(null);
      setFeedback(null);
      setRevealed(false);
      setSlot(null);
      stopSong();
      setScreen('game');
      if (cs.preview && shouldPlay(gs.audioMode, isHostRef.current)) {
        startSong(cs.preview);
      }
    });

    socket.on('placement_result', ({ correct, song, gameState: gs, nextSong }) => {
      setLastPlacedPlayerId(gameStateRef.current?.currentPlayerId ?? null);
      setRevealedSong(song);
      setFeedback(correct ? 'ok' : 'no');
      setRevealed(true);
      setGameState(gs);
      stopSong();

      clearRevealTimer();
      revealTimerRef.current = setTimeout(() => {
        setFeedback(null);
        setRevealed(false);
        setRevealedSong(null);
        setLastPlacedPlayerId(null);
        setSlot(null);
        if (nextSong) {
          setCurrentSong(nextSong);
          if (nextSong.preview && shouldPlay(gs.audioMode, isHostRef.current)) {
            startSong(nextSong.preview);
          }
        }
      }, 3000);
    });

    socket.on('game_over', ({ players, lastSong, lastCorrect, lastPlayerId, winnerLastSong }) => {
      clearRevealTimer();
      stopSong();
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
          setFeedback(null);
          setRevealed(false);
          setRevealedSong(null);
          setLastPlacedPlayerId(null);
          setSlot(null);
          setResult(resultData);
          setScreen('result');
        }, 3000);
      } else {
        setResult(resultData);
        setScreen('result');
      }
    });

    socket.on('player_kicked', () => {
      clearRevealTimer();
      stopSong();
      socket.disconnect();
      setScreen('login');
      showError('Du wurdest aus dem Raum entfernt.');
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
        clearRevealTimer();
        stopSong();
        setGameState(gs);
        setCurrentSong(cs);
        setRevealedSong(null);
        setFeedback(null);
        setRevealed(false);
        setLastPlacedPlayerId(null);
        setSlot(null);
        setScreen('game');
        setDisconnectedPlayer({
          id: disconnectedPlayerId,
          name: disconnectedPlayerName,
          isHostDisconnected,
        });
      }
    );

    socket.on('game_resumed', ({ gameState: gs, currentSong: cs }) => {
      clearRevealTimer();
      setDisconnectedPlayer(null);
      setGameState(gs);
      setCurrentSong(cs);
      setRevealedSong(null);
      setFeedback(null);
      setRevealed(false);
      setLastPlacedPlayerId(null);
      setSlot(null);
      setScreen('game');
      if (cs.preview && shouldPlay(gs.audioMode, isHostRef.current)) {
        startSong(cs.preview);
      }
    });

    socket.on('player_disconnected', () => {
      // handled via game_paused or room_updated
    });

    socket.on('error', ({ message }) => {
      showError(message);
    });

    return () => {
      clearRevealTimer();
      socket.io.off('reconnect', handleReconnect);
      socket.off('room_created');
      socket.off('room_joined');
      socket.off('room_updated');
      socket.off('game_loading');
      socket.off('game_loading_cancelled');
      socket.off('game_started');
      socket.off('game_paused');
      socket.off('game_resumed');
      socket.off('placement_result');
      socket.off('game_over');
      socket.off('player_kicked');
      socket.off('player_disconnected');
      socket.off('error');
    };
  }, [startSong, stopSong, showError]);

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
    gameState,
    setGameState,
    currentSong,
    revealedSong,
    feedback,
    revealed,
    lastPlacedPlayerId,
    slot,
    setSlot,
    disconnectedPlayer,
    result,
    resetRoom,
  };
}
