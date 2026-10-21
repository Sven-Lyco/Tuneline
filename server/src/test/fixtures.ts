import type { SongFull } from '@tuneline/shared';
import type { InternalPlayer, Room } from '../types.js';

export const PREVIEW = 'https://audio-ssl.itunes.apple.com/preview.m4a';

export function song(year: number, id = `song-${year}`): SongFull {
  return { id, title: `Title ${id}`, artist: 'Artist', cover: null, preview: PREVIEW, year };
}

/** `count` songs with distinct, ascending years. */
export function songs(count: number, firstYear = 1960): SongFull[] {
  return Array.from({ length: count }, (_, i) => song(firstYear + i, `s${i}`));
}

export function player(id: string, overrides: Partial<InternalPlayer> = {}): InternalPlayer {
  return {
    id,
    name: id,
    isHost: false,
    isConnected: true,
    token: `token-${id}`,
    socketId: `socket-${id}`,
    score: 0,
    timeline: [],
    ...overrides,
  };
}

/** A room whose first player is the host; game fields are ready to be overridden per test. */
export function room(playerIds: string[], overrides: Partial<Room> = {}): Room {
  const players = playerIds.map((id, i) => player(id, { isHost: i === 0 }));
  return {
    code: 'ROOM01',
    players: new Map(players.map((p) => [p.id, p])),
    socketToPlayer: new Map(players.map((p) => [p.socketId, p.id])),
    playerOrder: [...playerIds],
    status: 'lobby',
    deck: [],
    currentSongIndex: 0,
    currentPlayerIndex: 0,
    round: 1,
    rounds: 5,
    audioMode: 'all',
    turnLimit: 0,
    turnDeadline: null,
    lastCorrectSong: new Map(),
    hostIp: '127.0.0.1',
    cleanupTimer: setTimeout(() => {}, 0),
    ...overrides,
  };
}

/** A playing room where every player already holds the given timeline. */
export function playingRoom(
  playerIds: string[],
  deck: SongFull[],
  timelines: Record<string, SongFull[]> = {},
  overrides: Partial<Room> = {},
): Room {
  const r = room(playerIds, { status: 'playing', deck, ...overrides });
  for (const p of r.players.values()) p.timeline = [...(timelines[p.id] ?? [])];
  return r;
}
