import type { SongFull, AudioMode, RoomStatus } from '@tuneline/shared';
import { TURN_LIMITS } from '@tuneline/shared';

export const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const TOKEN_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';
export const ROOM_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
export const EMPTY_ROOM_TTL_MS = 10 * 60 * 1000;
export const HOST_RECONNECT_GRACE_MS = 2 * 60 * 1000;
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

export function toTurnLimit(value: unknown): number {
  return (TURN_LIMITS as readonly unknown[]).includes(value) ? (value as number) : 0;
}

export function sameName(a: string, b: string): boolean {
  return a.trim().toLocaleLowerCase('de') === b.trim().toLocaleLowerCase('de');
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
  turnLimit: number; // seconds, 0 = unlimited
  turnDeadline: number | null; // epoch ms while a turn timer runs
  lastCorrectSong: Map<string, SongFull>; // playerId → last correctly placed song
  hostIp: string;
  cleanupTimer: ReturnType<typeof setTimeout>;
  hostTimeout?: ReturnType<typeof setTimeout>; // ends a paused game if the host never returns
  turnTimer?: ReturnType<typeof setTimeout>;
}

export type SimpleResult = { ok: true } | { ok: false; error: string };

export type SkipResult = { ok: true; gameOver: boolean } | { ok: false; error: string };

export type CreateRoomResult =
  | { ok: true; roomCode: string; playerId: string; playerToken: string }
  | { ok: false; error: string };

export type JoinResult =
  | { ok: true; playerId: string; playerToken: string }
  | { ok: false; error: string };

export type TurnResult = {
  correct: boolean;
  timedOut: boolean;
  song: SongFull;
  gameOver: boolean;
  lastPlayerId: string;
};

export type PlaceResult = ({ ok: true } & TurnResult) | { ok: false; error: string };

export type KickResult =
  | { ok: true; kickedSocketId: string | null }
  | { ok: false; error: string };

/** closed = the host left the lobby and the room is gone. */
export type LeaveResult = { closed: boolean; roomCode: string };

export interface RoomEvents {
  /** The host stayed away too long; the game was finished. */
  onHostTimeout: (roomCode: string) => void;
  /** The current player ran out of time; their turn was resolved as wrong. */
  onTurnTimeout: (roomCode: string, result: TurnResult) => void;
}
