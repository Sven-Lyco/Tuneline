import type { SongFull, AudioMode, RoomStatus } from '@tuneline/shared';

export const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const TOKEN_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';
export const ROOM_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
export const EMPTY_ROOM_TTL_MS = 10 * 60 * 1000;
export const MAX_PLAYERS = 10;
export const MAX_NAME_LENGTH = 30;
export const MAX_ROOMS = 500;
export const MAX_ROOMS_PER_IP = 5;
export const MAX_FIELD_LENGTH = 200;
export const MAX_SONGS = 500;
const DEFAULT_ROUNDS = 5;
const MAX_ROUNDS = 20;

export function isValidAudioMode(mode: unknown): mode is AudioMode {
  return mode === 'all' || mode === 'host-only';
}

export function clampRounds(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_ROUNDS;
  return Math.max(1, Math.min(Math.round(value), MAX_ROUNDS));
}

export interface InternalPlayer {
  id: string;
  name: string;
  isHost: boolean;
  isConnected: boolean;
  token: string;
  socketId: string;
  score: number;
  timeline: SongFull[];
}

export interface Room {
  code: string;
  players: Map<string, InternalPlayer>; // playerId → player
  socketToPlayer: Map<string, string>; // socketId → playerId
  playerOrder: string[]; // ordered player ids
  status: RoomStatus;
  deck: SongFull[];
  currentSongIndex: number;
  currentPlayerIndex: number;
  round: number;
  rounds: number;
  audioMode: AudioMode;
  lastCorrectSong: Map<string, SongFull>; // playerId → last correctly placed song
  pausedForPlayerId: string | null;
  hostIp: string;
  cleanupTimer: ReturnType<typeof setTimeout>;
}

export type SimpleResult = { ok: true } | { ok: false; error: string };

export type SkipResult = { ok: true; gameOver: boolean } | { ok: false; error: string };

export type CreateRoomResult =
  | { ok: true; roomCode: string; playerId: string; playerToken: string }
  | { ok: false; error: string };

export type JoinResult =
  | { ok: true; playerId: string; playerToken: string }
  | { ok: false; error: string };

export type PlaceResult =
  | { ok: false; error: string }
  | { ok: true; correct: boolean; song: SongFull; gameOver: boolean; lastPlayerId: string };

export type KickResult =
  | { ok: true; kickedSocketId: string | null }
  | { ok: false; error: string };
