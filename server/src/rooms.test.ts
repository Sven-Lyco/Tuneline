import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { REVEAL_DURATION_MS } from '@tuneline/shared';
import { RoomManager } from './rooms.js';
import {
  EMPTY_ROOM_TTL_MS,
  HOST_RECONNECT_GRACE_MS,
  MAX_PLAYERS,
  MAX_ROOMS,
  MAX_ROOMS_PER_IP,
  ROOM_TTL_MS,
} from './types.js';
import { songs } from './test/fixtures.js';

const events = { onHostTimeout: vi.fn(), onTurnTimeout: vi.fn() };

function setup() {
  const rooms = new RoomManager(events);
  const created = rooms.createRoom('host-socket', '1.1.1.1', ' Host ', 5, 'all', 0);
  if (!created.ok) throw new Error(created.error);
  return { rooms, code: created.roomCode, host: created };
}

function join(rooms: RoomManager, code: string, name: string) {
  const joined = rooms.joinRoom(`${name}-socket`, code, name);
  if (!joined.ok) throw new Error(joined.error);
  return joined;
}

/** Host plus guests in a running game; the host is on turn. */
function playing(guests = ['Anna'], turnLimit = 0) {
  const rooms = new RoomManager(events);
  const created = rooms.createRoom('host-socket', '1.1.1.1', 'Host', 5, 'all', turnLimit);
  if (!created.ok) throw new Error(created.error);
  const code = created.roomCode;
  const joined = guests.map((g) => join(rooms, code, g));
  const started = rooms.startGame('host-socket', code, songs(20), 5, 'all');
  if (!started.ok) throw new Error(started.error);
  return { rooms, code, host: created, guests: joined };
}

/** Plays every remaining turn until the game is over. */
function finish(rooms: RoomManager, code: string) {
  while (rooms.getLobbyState(code)!.status === 'playing') {
    const gs = rooms.getGameState(code)!;
    const current = gs.players.find((p) => p.id === gs.currentPlayerId)!;
    rooms.placeSong(current.isHost ? 'host-socket' : `${current.name}-socket`, code, 0);
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  events.onHostTimeout.mockReset();
  events.onTurnTimeout.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('createRoom', () => {
  it('creates a lobby with the trimmed host and sane settings', () => {
    const rooms = new RoomManager(events);
    const res = rooms.createRoom('s1', 'ip', '  Alex  ', 99, 'weird' as never, 45);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.roomCode).toMatch(/^[A-Z0-9]{6}$/);
    expect(res.playerToken).toHaveLength(48);
    const lobby = rooms.getLobbyState(res.roomCode)!;
    expect(lobby).toMatchObject({ rounds: 20, audioMode: 'all', turnLimit: 0, status: 'lobby' });
    expect(lobby.players).toEqual([expect.objectContaining({ name: 'Alex', isHost: true })]);
    expect(rooms.isHost('s1', res.roomCode)).toBe(true);
    expect(rooms.getRoomCodeForSocket('s1')).toBe(res.roomCode);
  });

  it('allows one room per socket and a few per IP', () => {
    const rooms = new RoomManager(events);
    rooms.createRoom('s0', 'ip', 'A', 5, 'all', 0);
    expect(rooms.createRoom('s0', 'ip', 'A', 5, 'all', 0)).toEqual({
      ok: false,
      error: 'Du bist bereits in einem Raum.',
    });
    for (let i = 1; i < MAX_ROOMS_PER_IP; i++) {
      expect(rooms.createRoom(`s${i}`, 'ip', 'A', 5, 'all', 0).ok).toBe(true);
    }
    expect(rooms.createRoom('another', 'ip', 'A', 5, 'all', 0)).toMatchObject({ ok: false });
    expect(rooms.createRoom('another', 'other-ip', 'A', 5, 'all', 0).ok).toBe(true);
  });

  it('stops at the global room limit', () => {
    const rooms = new RoomManager(events);
    for (let i = 0; i < MAX_ROOMS; i++) rooms.createRoom(`s${i}`, `ip${i}`, 'A', 5, 'all', 0);
    expect(rooms.createRoom('late', 'new-ip', 'A', 5, 'all', 0)).toEqual({
      ok: false,
      error: 'Server ist ausgelastet. Bitte später erneut versuchen.',
    });
  });
});

describe('joinRoom', () => {
  it('adds new players to the lobby', () => {
    const { rooms, code } = setup();
    const res = rooms.joinRoom('anna-socket', code, ' Anna ');
    expect(res).toMatchObject({ ok: true });
    expect(rooms.getLobbyState(code)!.players.map((p) => p.name)).toEqual(['Host', 'Anna']);
    expect(rooms.getPlayerForSocket('anna-socket')).toMatchObject({ name: 'Anna' });
  });

  it('rejects unknown rooms, empty names, duplicate names and full rooms', () => {
    const { rooms, code } = setup();
    expect(rooms.joinRoom('x', 'NOPE00', 'Anna')).toEqual({ ok: false, error: 'Raum nicht gefunden.' });
    expect(rooms.joinRoom('x', code, '   ')).toEqual({ ok: false, error: 'Bitte gib einen Namen ein.' });
    expect(rooms.joinRoom('x', code, 'HOST')).toMatchObject({ ok: false, error: expect.stringContaining('vergeben') });

    for (let i = 1; i < MAX_PLAYERS; i++) join(rooms, code, `P${i}`);
    expect(rooms.joinRoom('x', code, 'Eleven')).toEqual({ ok: false, error: 'Der Raum ist voll.' });
  });

  it('reconnects with a known token instead of creating a player', () => {
    const { rooms, code } = setup();
    const anna = join(rooms, code, 'Anna');
    rooms.handleDisconnect('Anna-socket');
    const res = rooms.joinRoom('anna-new', code, 'Whatever', anna.playerToken);
    expect(res).toMatchObject({ ok: true, playerId: anna.playerId, replacedSocketId: undefined });
    expect(rooms.getLobbyState(code)!.players).toHaveLength(2);
  });

  it('treats an unknown token as a new player', () => {
    const { rooms, code } = setup();
    const res = rooms.joinRoom('s', code, 'Ben', 'unknown-token');
    expect(res).toMatchObject({ ok: true });
    expect(rooms.getLobbyState(code)!.players).toHaveLength(2);
  });

  it('seats late joiners mid-game and parks newcomers of a finished game', () => {
    const { rooms, code } = playing();
    join(rooms, code, 'Late');
    expect(rooms.getGameState(code)!.players.map((p) => p.name)).toContain('Late');

    finish(rooms, code);
    join(rooms, code, 'Later');
    expect(rooms.getPlayers(code)!.map((p) => p.name)).not.toContain('Later');
  });
});

describe('rejoinRoom', () => {
  it('reports the socket it takes over from', () => {
    const { rooms, code } = setup();
    const anna = join(rooms, code, 'Anna');
    const res = rooms.rejoinRoom('second-tab', code, anna.playerToken);
    expect(res).toMatchObject({ ok: true, replacedSocketId: 'Anna-socket' });
    expect(rooms.getRoomCodeForSocket('Anna-socket')).toBeNull();
    expect(rooms.getPlayerForSocket('second-tab')).toMatchObject({ name: 'Anna' });
  });

  it('fails for unknown rooms or tokens', () => {
    const { rooms, code } = setup();
    expect(rooms.rejoinRoom('s', code, 'nope')).toEqual({ ok: false, error: 'Raum nicht gefunden.' });
    expect(rooms.rejoinRoom('s', 'NOPE00', 'nope')).toEqual({ ok: false, error: 'Raum nicht gefunden.' });
  });

  it('seats a skipped player again', () => {
    const { rooms, code, guests } = playing(['Anna', 'Ben']);
    rooms.placeSong('host-socket', code, 0);
    rooms.handleDisconnect('Anna-socket'); // Anna is on turn now
    rooms.skipDisconnectedPlayer('host-socket', code);
    expect(rooms.getGameState(code)!.players.map((p) => p.name)).toEqual(['Host', 'Ben']);

    rooms.rejoinRoom('anna-back', code, guests[0].playerToken);
    expect(rooms.getGameState(code)!.players.map((p) => p.name)).toEqual(['Host', 'Ben', 'Anna']);
  });
});

describe('leaveRoom', () => {
  it('removes a guest from the lobby and closes the room when the host leaves', () => {
    const { rooms, code } = setup();
    join(rooms, code, 'Anna');
    expect(rooms.leaveRoom('Anna-socket')).toEqual({ closed: false, roomCode: code });
    expect(rooms.getLobbyState(code)!.players).toHaveLength(1);

    expect(rooms.leaveRoom('host-socket')).toEqual({ closed: true, roomCode: code });
    expect(rooms.getLobbyState(code)).toBeNull();
    expect(rooms.getRoomCodeForSocket('host-socket')).toBeNull();
  });

  it('works on the result screen but not mid-game', () => {
    const { rooms, code } = playing();
    expect(rooms.leaveRoom('Anna-socket')).toBeNull();
    finish(rooms, code);
    expect(rooms.leaveRoom('Anna-socket')).toEqual({ closed: false, roomCode: code });
    expect(rooms.getPlayers(code)!.map((p) => p.name)).toEqual(['Host']);
  });

  it('ignores sockets that are not in a room', () => {
    expect(new RoomManager(events).leaveRoom('ghost')).toBeNull();
  });
});

describe('kickPlayer', () => {
  it('lets only the host kick other players in the lobby', () => {
    const { rooms, code, host } = setup();
    const anna = join(rooms, code, 'Anna');
    expect(rooms.kickPlayer('host-socket', 'NOPE00', anna.playerId)).toMatchObject({ ok: false });
    expect(rooms.kickPlayer('Anna-socket', code, host.playerId)).toMatchObject({ ok: false });
    expect(rooms.kickPlayer('host-socket', code, host.playerId)).toMatchObject({ ok: false });
    expect(rooms.kickPlayer('host-socket', code, 'nobody')).toEqual({ ok: false, error: 'Spieler nicht gefunden.' });
    expect(rooms.kickPlayer('host-socket', code, anna.playerId)).toEqual({ ok: true, kickedSocketId: 'Anna-socket' });
    expect(rooms.getLobbyState(code)!.players).toHaveLength(1);
  });

  it('refuses mid-game', () => {
    const { rooms, code, guests } = playing();
    expect(rooms.kickPlayer('host-socket', code, guests[0].playerId)).toMatchObject({ ok: false });
  });
});

describe('handleDisconnect and room lifetime', () => {
  it('ignores unknown sockets', () => {
    expect(new RoomManager(events).handleDisconnect('ghost')).toBeNull();
  });

  it('deletes an empty room after the short TTL', () => {
    const { rooms, code } = setup();
    expect(rooms.handleDisconnect('host-socket')).toMatchObject({ roomCode: code, isHost: true, wasPlaying: false });
    vi.advanceTimersByTime(EMPTY_ROOM_TTL_MS - 1);
    expect(rooms.getLobbyState(code)).not.toBeNull();
    vi.advanceTimersByTime(1);
    expect(rooms.getLobbyState(code)).toBeNull();
  });

  it('keeps active rooms alive while players act', () => {
    const { rooms, code } = setup();
    vi.advanceTimersByTime(ROOM_TTL_MS - 1000);
    rooms.touch('host-socket');
    vi.advanceTimersByTime(ROOM_TTL_MS - 1000);
    expect(rooms.getLobbyState(code)).not.toBeNull();
    vi.advanceTimersByTime(1000);
    expect(rooms.getLobbyState(code)).toBeNull();
  });

  it('ends the game if the host stays away too long', () => {
    const { rooms, code } = playing();
    rooms.handleDisconnect('host-socket');
    expect(rooms.getPausedPlayer(code)).toMatchObject({ name: 'Host', isHost: true });
    vi.advanceTimersByTime(HOST_RECONNECT_GRACE_MS);
    expect(events.onHostTimeout).toHaveBeenCalledWith(code);
    expect(rooms.getLobbyState(code)!.status).toBe('finished');
  });

  it('keeps the game when the host comes back in time', () => {
    const { rooms, code, host } = playing();
    rooms.handleDisconnect('host-socket');
    vi.advanceTimersByTime(HOST_RECONNECT_GRACE_MS / 2);
    rooms.rejoinRoom('host-again', code, host.playerToken);
    vi.advanceTimersByTime(HOST_RECONNECT_GRACE_MS);
    expect(events.onHostTimeout).not.toHaveBeenCalled();
    expect(rooms.getLobbyState(code)!.status).toBe('playing');
  });
});

describe('game actions', () => {
  it('checks rooms and host rights', () => {
    const { rooms, code } = setup();
    join(rooms, code, 'Anna');
    expect(rooms.startGame('host-socket', 'NOPE00', songs(10), 5, 'all')).toMatchObject({ ok: false });
    expect(rooms.startGame('Anna-socket', code, songs(10), 5, 'all')).toMatchObject({ ok: false });
    expect(rooms.placeSong('host-socket', 'NOPE00', 0)).toMatchObject({ ok: false });
    expect(rooms.placeSong('ghost', code, 0)).toEqual({ ok: false, error: 'Nicht autorisiert.' });
    expect(rooms.returnToLobby('host-socket', 'NOPE00')).toMatchObject({ ok: false });
    expect(rooms.returnToLobby('Anna-socket', code)).toMatchObject({ ok: false });
    expect(rooms.skipDisconnectedPlayer('host-socket', 'NOPE00')).toMatchObject({ ok: false });
    expect(rooms.skipDisconnectedPlayer('Anna-socket', code)).toMatchObject({ ok: false });
  });

  it('updates settings only for the host in the lobby', () => {
    const { rooms, code } = setup();
    join(rooms, code, 'Anna');
    expect(rooms.updateSettings('host-socket', 'NOPE00', 5, 'all', 0)).toMatchObject({ ok: false });
    expect(rooms.updateSettings('Anna-socket', code, 5, 'all', 0)).toMatchObject({ ok: false });
    expect(rooms.updateSettings('host-socket', code, 5, 'loud' as never, 0)).toMatchObject({ ok: false });
    expect(rooms.updateSettings('host-socket', code, 10, 'host-only', 60)).toEqual({ ok: true });
    expect(rooms.getLobbyState(code)).toMatchObject({ rounds: 10, audioMode: 'host-only', turnLimit: 60 });

    rooms.startGame('host-socket', code, songs(10), 5, 'all');
    expect(rooms.updateSettings('host-socket', code, 5, 'all', 0)).toMatchObject({ ok: false });
  });

  it('returns a finished game to the lobby', () => {
    const { rooms, code } = playing();
    expect(rooms.returnToLobby('host-socket', code)).toEqual({ ok: true });
    expect(rooms.getLobbyState(code)!.status).toBe('lobby');
  });

  it('only reveals the audio of the current song', () => {
    const { rooms, code } = playing();
    expect(rooms.getCurrentSongPreview(code)).toEqual({ preview: expect.any(String) });
    expect(rooms.getCurrentSongPreview('NOPE00')).toBeNull();
  });

  it('tracks the last correct song per player', () => {
    const { rooms, code, host } = playing();
    expect(rooms.getLastCorrectSong(code, host.playerId)).toBeNull();
  });

  it('answers queries for unknown rooms and sockets with null', () => {
    const rooms = new RoomManager(events);
    expect(rooms.getPlayerForSocket('ghost')).toBeNull();
    expect(rooms.getGameState('NOPE00')).toBeNull();
    expect(rooms.getPlayers('NOPE00')).toBeNull();
    expect(rooms.getPausedPlayer('NOPE00')).toBeNull();
    expect(rooms.isHost('ghost', 'NOPE00')).toBe(false);
    rooms.touch('ghost');
  });
});

describe('turn timer', () => {
  it('runs a full turn, resolves it as timed out and gives the next turn the reveal on top', () => {
    const { rooms, code } = playing(['Anna'], 30);
    expect(rooms.getGameState(code)!.turnEndsInMs).toBe(30_000);

    vi.advanceTimersByTime(30_000);
    expect(events.onTurnTimeout).toHaveBeenCalledWith(code, expect.objectContaining({ timedOut: true }));
    expect(rooms.getGameState(code)!.turnEndsInMs).toBe(30_000 + REVEAL_DURATION_MS);
  });

  it('restarts after a placement and stops while the game is paused', () => {
    const { rooms, code, guests } = playing(['Anna'], 30);
    vi.advanceTimersByTime(10_000);
    rooms.placeSong('host-socket', code, 0);
    expect(rooms.getGameState(code)!.turnEndsInMs).toBe(30_000 + REVEAL_DURATION_MS);

    rooms.handleDisconnect('Anna-socket'); // Anna is on turn → paused
    expect(rooms.getGameState(code)!.turnEndsInMs).toBeNull();
    vi.advanceTimersByTime(120_000);
    expect(events.onTurnTimeout).not.toHaveBeenCalled();

    rooms.rejoinRoom('anna-back', code, guests[0].playerToken);
    expect(rooms.getGameState(code)!.turnEndsInMs).toBe(30_000);
  });

  it('is off without a limit and after the game', () => {
    const { rooms, code } = playing(['Anna'], 0);
    expect(rooms.getGameState(code)!.turnEndsInMs).toBeNull();

    const timed = playing(['Anna'], 30);
    timed.rooms.returnToLobby('host-socket', timed.code);
    expect(timed.rooms.getGameState(timed.code)!.turnEndsInMs).toBeNull();
  });

  it('restarts after a skip', () => {
    const { rooms, code } = playing(['Anna', 'Ben'], 30);
    rooms.placeSong('host-socket', code, 0);
    rooms.handleDisconnect('Anna-socket');
    expect(rooms.skipDisconnectedPlayer('host-socket', code)).toMatchObject({ ok: true });
    expect(rooms.getGameState(code)!.turnEndsInMs).toBe(30_000);
  });
});
