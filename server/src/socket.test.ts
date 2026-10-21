import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { SongFull } from '@tuneline/shared';
import { songs } from './test/fixtures.js';
import {
  sleep,
  startServer,
  staysQuiet,
  waitFor,
  waitUntil,
  type Client,
  type TestServer,
} from './test/server.js';

let server: TestServer;

beforeEach(async () => {
  server = await startServer();
});

afterEach(async () => {
  await server.close();
});

interface Seat {
  s: Client;
  playerId: string;
  playerToken: string;
  roomCode: string;
}

async function createRoom(name = 'Host', settings: { rounds?: number; turnLimit?: number } = {}, ip?: string) {
  const s = await server.connect(ip);
  const created = waitFor(s, 'room_created');
  s.emit('create_room', { hostName: name, rounds: 5, audioMode: 'all', turnLimit: 0, ...settings });
  return { s, ...(await created) } as Seat;
}

async function join(roomCode: string, name: string) {
  const s = await server.connect();
  const joined = waitFor(s, 'room_joined');
  s.emit('join_room', { roomCode, playerName: name });
  return { s, roomCode, ...(await joined) } as Seat;
}

async function rejoin(roomCode: string, playerToken: string) {
  const s = await server.connect();
  const joined = waitFor(s, 'room_joined');
  const failed = waitFor(s, 'rejoin_failed');
  const resumed = waitFor(s, 'game_resumed');
  s.emit('rejoin_room', { roomCode, playerToken });
  return { s, joined: await joined, failed: await failed, resumed };
}

async function start(host: Seat, deck: SongFull[] = songs(20), rounds = 3) {
  const started = waitFor(host.s, 'game_started');
  host.s.emit('start_game', { songs: deck, rounds, audioMode: 'all' });
  return started;
}

const names = (state: { players: Array<{ name: string }> } | undefined) => state?.players.map((p) => p.name);

describe('input hardening', () => {
  it('survives events without payloads and refuses broken starts', async () => {
    // Untyped on purpose: a malicious client can send anything.
    const raw = (await server.connect()) as unknown as { emit: (event: string, ...args: unknown[]) => void };
    raw.emit('place_song');
    raw.emit('join_room');
    raw.emit('rejoin_room');
    raw.emit('create_room', null);
    raw.emit('update_settings', 'x');
    await sleep(100);
    expect(await (await fetch(`${server.url}/health`)).json()).toEqual({ ok: true });

    const host = await createRoom();
    const err = waitFor(host.s, 'error');
    host.s.emit('start_game', { songs: [null, null] as never, rounds: 3, audioMode: 'all' });
    expect((await err).message).toBe('Ungültige Song-Daten.');
    expect(await (await fetch(`${server.url}/health`)).json()).toEqual({ ok: true });

    const twice = waitFor(host.s, 'error');
    host.s.emit('create_room', { hostName: 'Again', rounds: 3, audioMode: 'all', turnLimit: 0 });
    expect((await twice).message).toBe('Du bist bereits in einem Raum.');
  });

  it('ignores invalid rejoin payloads and empty host names', async () => {
    const s = await server.connect();
    const failed = waitFor(s, 'rejoin_failed');
    s.emit('rejoin_room', { roomCode: 42, playerToken: null } as never);
    expect(await failed).toBe(true);
    s.emit('create_room', { hostName: '  ', rounds: 3, audioMode: 'all', turnLimit: 0 });
    expect(await staysQuiet(s, 'room_created')).toBe(true);
  });

  it('drops events beyond the per-socket rate limit', async () => {
    const host = await createRoom();
    const guest = await join(host.roomCode, 'Guest');
    let received = 0;
    host.s.on('reaction_received', () => received++);
    await sleep(1100); // let the join fall out of the one-second window
    for (let i = 0; i < 30; i++) guest.s.emit('send_reaction', { emoji: '🔥' });
    await sleep(200);
    expect(received).toBe(15);
  });

  it('limits rooms per IP', async () => {
    const created: Seat[] = [];
    for (let i = 0; i < 5; i++) created.push(await createRoom(`H${i}`, {}, '10.9.9.9'));
    const s = await server.connect('10.9.9.9');
    const err = waitFor(s, 'error');
    s.emit('create_room', { hostName: 'Flood', rounds: 3, audioMode: 'all', turnLimit: 0 });
    expect((await err).message).toMatch(/^Zu viele/);
  });
});

describe('lobby', () => {
  it('rejects duplicate names and removes guests who leave', async () => {
    const host = await createRoom();
    const dup = await server.connect();
    const err = waitFor(dup, 'error');
    dup.emit('join_room', { roomCode: host.roomCode, playerName: ' host ' });
    expect((await err).message).toContain('vergeben');

    await join(host.roomCode, 'Gast1');
    const g2 = await join(host.roomCode, 'Gast2');
    const updated = waitUntil(host.s, 'room_updated', (d) => d.room.players.length === 2);
    g2.s.emit('leave_room');
    expect(names((await updated).room)).toEqual(['Host', 'Gast1']);
  });

  it('relays settings, kicks, reactions and loading state', async () => {
    const host = await createRoom();
    const guest = await join(host.roomCode, 'Guest');

    const settings = waitUntil(guest.s, 'room_updated', (d) => d.room.rounds === 10);
    host.s.emit('update_settings', { rounds: 10, audioMode: 'host-only', turnLimit: 60 });
    expect((await settings).room).toMatchObject({ rounds: 10, audioMode: 'host-only', turnLimit: 60 });

    const denied = waitFor(guest.s, 'error');
    guest.s.emit('update_settings', { rounds: 3, audioMode: 'all', turnLimit: 0 });
    expect(await denied).toBeTruthy();

    const reaction = waitFor(host.s, 'reaction_received');
    guest.s.emit('send_reaction', { emoji: 'not-an-emoji' });
    guest.s.emit('send_reaction', { emoji: '🥳' });
    expect(await reaction).toMatchObject({ playerName: 'Guest', emoji: '🥳' });

    const loading = waitFor(guest.s, 'game_loading');
    host.s.emit('start_loading');
    expect(await loading).toBe(true);
    const cancelled = waitFor(guest.s, 'game_loading_cancelled');
    host.s.emit('cancel_loading');
    expect(await cancelled).toBe(true);

    guest.s.emit('start_loading');
    expect(await staysQuiet(host.s, 'game_loading')).toBe(true);

    const kickDenied = waitFor(guest.s, 'error');
    guest.s.emit('kick_player', { playerId: host.playerId });
    expect(await kickDenied).toBeTruthy();
    const kicked = waitFor(guest.s, 'player_kicked');
    host.s.emit('kick_player', { playerId: guest.playerId });
    expect(await kicked).toEqual({ playerId: guest.playerId });
  });

  it('cancels guests’ loading screen when the host start fails or the host drops', async () => {
    const host = await createRoom();
    const guest = await join(host.roomCode, 'Guest');
    const cancelled = waitFor(guest.s, 'game_loading_cancelled');
    host.s.emit('start_game', { songs: songs(3), rounds: 3, audioMode: 'all' });
    expect(await cancelled).toBe(true);

    const dropped = waitFor(guest.s, 'game_loading_cancelled');
    host.s.disconnect();
    expect(await dropped).toBe(true);
  });

  it('closes the room when the host leaves, and rejoining it fails', async () => {
    const host = await createRoom();
    const guest = await join(host.roomCode, 'Guest');
    const closed = waitFor(guest.s, 'room_closed');
    host.s.emit('leave_room');
    expect(await closed).toBe(true);
    const gone = await rejoin(host.roomCode, guest.playerToken);
    expect(gone.failed).toBe(true);
  });
});

describe('game', () => {
  it('sends only the audio during a turn and rejects odd positions', async () => {
    const host = await createRoom();
    await join(host.roomCode, 'Guest');
    const started = await start(host, songs(10), 20);
    expect(started.gameState.rounds).toBe(4);
    expect(started.currentSong).toEqual({ preview: expect.any(String) });

    const err = waitFor(host.s, 'error');
    host.s.emit('place_song', { position: 0.5 });
    expect((await err).message).toBe('Ungültige Position.');
  });

  it('tells a taken-over tab and ignores its late disconnect', async () => {
    const host = await createRoom();
    const guest = await join(host.roomCode, 'Guest');
    await start(host);

    const replaced = waitFor(guest.s, 'session_replaced');
    const takeover = await rejoin(host.roomCode, guest.playerToken);
    expect(takeover.joined.playerId).toBe(guest.playerId);
    expect(takeover.joined).not.toHaveProperty('replacedSocketId');
    expect(await replaced).toBe(true);
    expect(await staysQuiet(host.s, 'game_paused')).toBe(true);
  });

  it('pauses only for the player on turn, skips them and seats them again later', async () => {
    const a = await createRoom('A');
    const b = await join(a.roomCode, 'B');
    const c = await join(a.roomCode, 'C');
    await join(a.roomCode, 'D');
    await start(a);

    const update = waitFor(a.s, 'game_state_updated');
    b.s.disconnect();
    expect((await update).gameState.players.find((p: { name: string }) => p.name === 'B').isConnected).toBe(false);
    expect(await staysQuiet(a.s, 'game_paused', 200)).toBe(true);

    const result = waitFor(a.s, 'placement_result');
    const paused = waitFor(a.s, 'game_paused');
    a.s.emit('place_song', { position: 0 });
    await result;
    expect((await paused).disconnectedPlayerId).toBe(b.playerId);

    const refused = waitFor(c.s, 'error');
    c.s.emit('place_song', { position: 0 });
    expect((await refused).message).toBe('Das Spiel ist pausiert.');

    const resumed = waitFor(a.s, 'game_resumed');
    a.s.emit('skip_player');
    const r = await resumed;
    expect(names(r.gameState)).toEqual(['A', 'C', 'D']);
    expect(r.gameState.currentPlayerId).toBe(c.playerId);

    const back = await rejoin(a.roomCode, b.playerToken);
    expect(names((await back.resumed).gameState)).toEqual(['A', 'C', 'D', 'B']);
  });

  it('pauses for a dropped host and lets late joiners in', async () => {
    const a = await createRoom('Duo');
    const b = await join(a.roomCode, 'DuoGast');
    await start(a);

    const hostPause = waitFor(b.s, 'game_paused');
    a.s.disconnect();
    expect((await hostPause).isHostDisconnected).toBe(true);
    const resumed = waitFor(b.s, 'game_resumed');
    const hostBack = await rejoin(a.roomCode, a.playerToken);
    expect(await resumed).toBeTruthy();

    const late = await server.connect();
    const lateSync = waitFor(late, 'game_resumed');
    const others = waitFor(hostBack.s, 'game_state_updated');
    late.emit('join_room', { roomCode: a.roomCode, playerName: 'Spät' });
    const sync = await lateSync;
    expect(sync.gameState.players.find((p: { name: string }) => p.name === 'Spät').timeline).toHaveLength(1);
    expect(await others).toBeTruthy();
  });

  it('ends after skipping the last player, then handles the result screen', async () => {
    const a = await createRoom('A', { rounds: 1 });
    const b = await join(a.roomCode, 'B');
    const c = await join(a.roomCode, 'C');
    await start(a, songs(20), 1);

    let res = waitFor(a.s, 'placement_result');
    a.s.emit('place_song', { position: 0 });
    await res;
    res = waitFor(a.s, 'placement_result');
    b.s.emit('place_song', { position: 0 });
    expect((await res).gameState.currentPlayerId).toBe(c.playerId);

    const paused = waitFor(a.s, 'game_paused');
    c.s.disconnect();
    await paused;
    const over = waitFor(a.s, 'game_over');
    a.s.emit('skip_player');
    expect(await over).toBeTruthy();

    // A player coming back to a finished game sees the result.
    const late = await server.connect();
    const result = waitFor(late, 'game_over');
    late.emit('rejoin_room', { roomCode: a.roomCode, playerToken: c.playerToken });
    expect(await result).toBeTruthy();

    const updated = waitFor(a.s, 'room_updated');
    a.s.emit('return_to_lobby');
    expect((await updated).room.status).toBe('lobby');
  });

  it('broadcasts placements and the final result', async () => {
    const a = await createRoom('A', { rounds: 1 });
    const b = await join(a.roomCode, 'B');
    await start(a, songs(10), 1);

    const placed = waitFor(b.s, 'placement_result');
    a.s.emit('place_song', { position: 0 });
    expect(await placed).toMatchObject({ timedOut: false, song: expect.objectContaining({ year: expect.any(Number) }) });

    const over = waitFor(a.s, 'game_over');
    b.s.emit('place_song', { position: 99 });
    const final = await over;
    expect(final.players).toHaveLength(2);
    expect(final.lastPlayerId).toBe(b.playerId);

    const leaveB = waitFor(a.s, 'room_closed', 300);
    b.s.emit('leave_room');
    expect(await leaveB).toBeNull();
    const closed = await join(a.roomCode, 'Viewer');
    const gone = waitFor(closed.s, 'room_closed');
    a.s.emit('leave_room');
    expect(await gone).toBe(true);
  });
});
