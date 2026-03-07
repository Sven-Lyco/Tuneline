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

const PLAYER_TOKEN_KEY = 'tuneline_player_token';

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
  const [slot, setSlot] = useState<number | null>(null);
  const [disconnectedPlayer, setDisconnectedPlayer] = useState<{
    id: string;
    name: string;
    isHostDisconnected: boolean;
  } | null>(null);
  const [result, setResult] = useState<GameResult | null>(null);

  // Ref so socket callbacks always see the current isHost value without re-registering
  const isHostRef = useRef(isHost);
  isHostRef.current = isHost;

  const resetRoom = useCallback(() => {
    setRoomCode('');
    setMyPlayerId('');
    setIsHost(false);
    setLobbyState(null);
    setGameState(null);
    setDisconnectedPlayer(null);
    setResult(null);
  }, []);

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
      setAudioMode(room.audioMode);
      setRounds(room.rounds);
      sessionStorage.setItem(PLAYER_TOKEN_KEY, playerToken);
      sessionStorage.setItem('tuneline_room_code', room.roomCode);
      if (room.status !== 'playing') {
        setScreen('lobby');
      }
    });

    socket.on('room_updated', ({ room }) => {
      setLobbyState(room);
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
      stopSong();
      setScreen('game');
      if (cs.preview && shouldPlay(gs.audioMode, isHostRef.current)) {
        startSong(cs.preview);
      }
    });

    socket.on('placement_result', ({ correct, song, gameState: gs, nextSong }) => {
      setRevealedSong(song);
      setFeedback(correct ? 'ok' : 'no');
      setRevealed(true);
      setGameState(gs);
      stopSong();

      setTimeout(() => {
        setFeedback(null);
        setRevealed(false);
        setRevealedSong(null);
        setSlot(null);
        if (nextSong) {
          setCurrentSong(nextSong);
          if (nextSong.preview && shouldPlay(gs.audioMode, isHostRef.current)) {
            startSong(nextSong.preview);
          }
        }
      }, 2200);
    });

    socket.on('game_over', ({ players, lastSong, lastCorrect, lastPlayerId, winnerLastSong }) => {
      stopSong();
      setResult({ players, lastSong, lastCorrect, lastPlayerId, winnerLastSong: winnerLastSong ?? null });
      setScreen('result');
    });

    socket.on('player_kicked', () => {
      stopSong();
      socket.disconnect();
      setScreen('login');
      showError('Du wurdest aus dem Raum entfernt.');
    });

    socket.on('game_paused', ({ disconnectedPlayerId, disconnectedPlayerName, isHostDisconnected, gameState: gs }) => {
      setGameState(gs);
      stopSong();
      setDisconnectedPlayer({
        id: disconnectedPlayerId,
        name: disconnectedPlayerName,
        isHostDisconnected,
      });
    });

    socket.on('game_resumed', ({ gameState: gs, currentSong: cs }) => {
      setDisconnectedPlayer(null);
      setGameState(gs);
      setCurrentSong(cs);
      setRevealedSong(null);
      setFeedback(null);
      setRevealed(false);
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
    slot,
    setSlot,
    disconnectedPlayer,
    result,
    resetRoom,
  };
}
