// ─── Spotify ─────────────────────────────────────────────────────────────────

export interface SpotifyPlaylist {
  id: string;
  name: string;
  coverUrl: string | null;
  trackCount: number;
  ownerName: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

export const REACTION_EMOJIS = ['🔥', '😂', '👏', '😱', '🥳', '❤️', '🤯'] as const;

/** How long a placement result is shown before the next turn starts. */
export const REVEAL_DURATION_MS = 3000;

/** Seconds per turn; 0 = no limit. */
export const TURN_LIMITS = [0, 30, 60, 90] as const;

// ─── Song types ─────────────────────────────────────────────────────────────

/** Song metadata without the release year — safe to send to the active player */
export interface SongMeta {
  id: string;
  title: string;
  artist: string;
  cover: string | null;
  preview: string | null;
}

/** Full song including year — only revealed after placement */
export interface SongFull extends SongMeta {
  year: number;
}

// ─── Room & Player ───────────────────────────────────────────────────────────

export type AudioMode = 'all' | 'host-only';

export interface RoomPlayer {
  id: string;
  name: string;
  isHost: boolean;
  isConnected: boolean;
  score: number;
  timeline: SongFull[];
}

export type RoomStatus = 'lobby' | 'playing' | 'finished';

export interface LobbyState {
  roomCode: string;
  players: RoomPlayer[];
  rounds: number;
  audioMode: AudioMode;
  turnLimit: number;
  status: RoomStatus;
}

export interface GameStateForClient {
  players: RoomPlayer[];
  currentPlayerId: string;
  round: number;
  rounds: number;
  audioMode: AudioMode;
  deckRemaining: number;
  /** Time left for the current turn when this state was sent; null = no limit or paused. */
  turnEndsInMs: number | null;
}

// ─── Socket.io Events ────────────────────────────────────────────────────────

export interface ClientToServerEvents {
  create_room: (data: {
    hostName: string;
    rounds: number;
    audioMode: AudioMode;
    turnLimit: number;
  }) => void;
  join_room: (data: {
    roomCode: string;
    playerName: string;
    playerToken?: string;
  }) => void;
  /** Reconnect with a stored token only; never creates a new player. */
  rejoin_room: (data: { roomCode: string; playerToken: string }) => void;
  leave_room: () => void;
  start_loading: () => void;
  cancel_loading: () => void;
  start_game: (data: {
    songs: SongFull[];
    rounds: number;
    audioMode: AudioMode;
  }) => void;
  update_settings: (data: { rounds: number; audioMode: AudioMode; turnLimit: number }) => void;
  place_song: (data: { position: number }) => void;
  kick_player: (data: { playerId: string }) => void;
  skip_player: () => void;
  return_to_lobby: () => void;
  send_reaction: (data: { emoji: string }) => void;
}

export interface ServerToClientEvents {
  room_created: (data: {
    roomCode: string;
    playerId: string;
    playerToken: string;
  }) => void;
  room_joined: (data: {
    playerId: string;
    playerToken: string;
    room: LobbyState;
  }) => void;
  room_updated: (data: { room: LobbyState }) => void;
  game_started: (data: {
    gameState: GameStateForClient;
    currentSong: SongMeta;
  }) => void;
  turn_started: (data: {
    currentSong: SongMeta;
    currentPlayerId: string;
  }) => void;
  placement_result: (data: {
    correct: boolean;
    timedOut: boolean;
    song: SongFull;
    gameState: GameStateForClient;
    nextSong: SongMeta | null;
  }) => void;
  game_over: (data: {
    players: RoomPlayer[];
    lastSong: SongFull | null;
    lastCorrect: boolean;
    lastPlayerId: string;
    winnerLastSong: SongFull | null;
  }) => void;
  game_paused: (data: {
    disconnectedPlayerId: string;
    disconnectedPlayerName: string;
    isHostDisconnected: boolean;
    gameState: GameStateForClient;
    currentSong: SongMeta;
  }) => void;
  game_resumed: (data: {
    gameState: GameStateForClient;
    currentSong: SongMeta;
  }) => void;
  /** Player list/connectivity changed without affecting the current turn. */
  game_state_updated: (data: { gameState: GameStateForClient }) => void;
  rejoin_failed: () => void;
  room_closed: () => void;
  server_restarting: () => void;
  player_disconnected: (data: { playerId: string }) => void;
  player_reconnected: (data: { playerId: string }) => void;
  player_kicked: (data: { playerId: string }) => void;
  game_loading: () => void;
  game_loading_cancelled: () => void;
  error: (data: { message: string }) => void;
  reaction_received: (data: { playerId: string; playerName: string; emoji: string }) => void;
}
