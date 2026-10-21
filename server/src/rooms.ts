import type {
  SongFull,
  SongMeta,
  RoomPlayer,
  LobbyState,
  GameStateForClient,
  AudioMode,
} from '@tuneline/shared';
import { REVEAL_DURATION_MS } from '@tuneline/shared';
import { generateCode } from './utils.js';
import {
  ROOM_CODE_CHARS,
  TOKEN_CHARS,
  ROOM_TTL_MS,
  EMPTY_ROOM_TTL_MS,
  HOST_RECONNECT_GRACE_MS,
  MAX_PLAYERS,
  MAX_NAME_LENGTH,
  MAX_ROOMS,
  MAX_ROOMS_PER_IP,
  clampRounds,
  isValidAudioMode,
  sameName,
  toTurnLimit,
  type InternalPlayer,
  type Room,
  type RoomEvents,
  type CreateRoomResult,
  type JoinResult,
  type SimpleResult,
  type PlaceResult,
  type KickResult,
  type SkipResult,
  type LeaveResult,
} from './types.js';
import * as game from './game.js';

export class RoomManager {
  private rooms = new Map<string, Room>();
  private socketToRoom = new Map<string, string>(); // socketId → roomCode

  constructor(private readonly events: RoomEvents) {}

  // ── Private helpers ──────────────────────────────────────────────────────

  private newCode(): string {
    let code: string;
    do {
      code = generateCode(6, ROOM_CODE_CHARS);
    } while (this.rooms.has(code));
    return code;
  }

  private newToken(): string {
    return generateCode(48, TOKEN_CHARS);
  }

  private newPlayerId(): string {
    return generateCode(16, TOKEN_CHARS);
  }

  private scheduleCleanup(room: Room, ms = ROOM_TTL_MS): void {
    clearTimeout(room.cleanupTimer);
    room.cleanupTimer = setTimeout(() => this.deleteRoom(room), ms);
  }

  private deleteRoom(room: Room): void {
    clearTimeout(room.cleanupTimer);
    clearTimeout(room.hostTimeout);
    clearTimeout(room.turnTimer);
    for (const socketId of room.socketToPlayer.keys()) this.unmapSocket(room, socketId);
    this.rooms.delete(room.code);
  }

  private unmapSocket(room: Room, socketId: string): void {
    room.socketToPlayer.delete(socketId);
    if (this.socketToRoom.get(socketId) === room.code) this.socketToRoom.delete(socketId);
  }

  /** Resolves socketId to the InternalPlayer within a room, or null. */
  private getPlayer(socketId: string, room: Room): InternalPlayer | null {
    const playerId = room.socketToPlayer.get(socketId);
    return playerId ? (room.players.get(playerId) ?? null) : null;
  }

  private toPublicPlayers(room: Room, ids: string[] = room.playerOrder): RoomPlayer[] {
    return ids
      .map((id) => room.players.get(id))
      .filter((p): p is InternalPlayer => p !== undefined)
      .map((p) => ({
        id: p.id,
        name: p.name,
        isHost: p.isHost,
        isConnected: p.isConnected,
        score: p.score,
        timeline: p.timeline,
      }));
  }

  /**
   * Keeps the turn timer in line with the game: it runs only while a game with a
   * turn limit is playing and not paused. `restartAfterMs` starts a new turn's
   * timer (after the reveal delay); otherwise a running timer is left alone.
   */
  private syncTurnTimer(room: Room, restartAfterMs?: number): void {
    const shouldRun =
      room.status === 'playing' && room.turnLimit > 0 && game.pausedPlayerId(room) === null;
    if (!shouldRun) {
      clearTimeout(room.turnTimer);
      room.turnTimer = undefined;
      room.turnDeadline = null;
      return;
    }
    if (room.turnTimer && restartAfterMs === undefined) return;

    clearTimeout(room.turnTimer);
    const ms = (restartAfterMs ?? 0) + room.turnLimit * 1000;
    room.turnDeadline = Date.now() + ms;
    room.turnTimer = setTimeout(() => {
      room.turnTimer = undefined;
      const result = game.timeoutTurn(room);
      if (!result) return this.syncTurnTimer(room);
      this.syncTurnTimer(room, REVEAL_DURATION_MS);
      this.events.onTurnTimeout(room.code, result);
    }, ms);
  }

  /** A socket sits in one room only; otherwise the old room keeps it "connected" forever. */
  private isInOtherRoom(socketId: string, roomCode: string): boolean {
    const current = this.socketToRoom.get(socketId);
    return current !== undefined && current !== roomCode;
  }

  /** Reconnects the player owning `playerToken` on a new socket, or returns null. */
  private reconnect(socketId: string, room: Room, playerToken: string): JoinResult | null {
    const player = [...room.players.values()].find((p) => p.token === playerToken);
    if (!player) return null;

    const replacedSocketId =
      player.isConnected && player.socketId !== socketId ? player.socketId : undefined;
    this.unmapSocket(room, player.socketId);
    player.socketId = socketId;
    player.isConnected = true;
    if (player.isHost) clearTimeout(room.hostTimeout);
    room.socketToPlayer.set(socketId, player.id);
    this.socketToRoom.set(socketId, room.code);
    game.seatPlayer(room, player);
    this.syncTurnTimer(room);
    this.scheduleCleanup(room);
    return { ok: true, playerId: player.id, playerToken, replacedSocketId };
  }

  getPlayerForSocket(socketId: string): { id: string; name: string } | null {
    const roomCode = this.socketToRoom.get(socketId);
    if (!roomCode) return null;
    const room = this.rooms.get(roomCode);
    if (!room) return null;
    const player = this.getPlayer(socketId, room);
    if (!player) return null;
    return { id: player.id, name: player.name };
  }

  // ── Room lifecycle ───────────────────────────────────────────────────────

  createRoom(
    socketId: string,
    hostIp: string,
    hostName: string,
    rounds: number,
    audioMode: AudioMode,
    turnLimit: number,
  ): CreateRoomResult {
    if (this.socketToRoom.has(socketId)) return { ok: false, error: 'Du bist bereits in einem Raum.' };
    if (this.rooms.size >= MAX_ROOMS) return { ok: false, error: 'Server ist ausgelastet. Bitte später erneut versuchen.' };
    let roomsForIp = 0;
    for (const r of this.rooms.values()) if (r.hostIp === hostIp) roomsForIp++;
    if (roomsForIp >= MAX_ROOMS_PER_IP) {
      return { ok: false, error: 'Zu viele offene Räume. Bitte später erneut versuchen.' };
    }

    const validMode: AudioMode = isValidAudioMode(audioMode) ? audioMode : 'all';
    const code = this.newCode();
    const playerId = this.newPlayerId();
    const token = this.newToken();

    const host: InternalPlayer = {
      id: playerId,
      name: hostName.trim().slice(0, MAX_NAME_LENGTH),
      isHost: true,
      isConnected: true,
      token,
      socketId,
      score: 0,
      timeline: [],
    };

    const room: Room = {
      code,
      players: new Map([[playerId, host]]),
      socketToPlayer: new Map([[socketId, playerId]]),
      playerOrder: [playerId],
      status: 'lobby',
      deck: [],
      currentSongIndex: 0,
      currentPlayerIndex: 0,
      round: 1,
      rounds: clampRounds(rounds),
      gameRounds: clampRounds(rounds),
      audioMode: validMode,
      turnLimit: toTurnLimit(turnLimit),
      turnDeadline: null,
      lastCorrectSong: new Map(),
      hostIp,
      cleanupTimer: setTimeout(() => {}, 0),
    };

    this.scheduleCleanup(room);
    this.rooms.set(code, room);
    this.socketToRoom.set(socketId, code);
    return { ok: true, roomCode: code, playerId, playerToken: token };
  }

  joinRoom(
    socketId: string,
    roomCode: string,
    playerName: string,
    playerToken?: string,
  ): JoinResult {
    const room = this.rooms.get(roomCode);
    if (!room) return { ok: false, error: 'Raum nicht gefunden.' };
    if (this.isInOtherRoom(socketId, roomCode)) return { ok: false, error: 'Du bist bereits in einem Raum.' };

    if (playerToken) {
      const reconnected = this.reconnect(socketId, room, playerToken);
      if (reconnected) return reconnected;
    }

    const name = playerName.trim().slice(0, MAX_NAME_LENGTH);
    if (!name) return { ok: false, error: 'Bitte gib einen Namen ein.' };
    if (room.players.size >= MAX_PLAYERS) return { ok: false, error: 'Der Raum ist voll.' };
    if ([...room.players.values()].some((p) => sameName(p.name, name))) {
      return { ok: false, error: `Der Name „${name}“ ist schon vergeben.` };
    }

    const playerId = this.newPlayerId();
    const token = this.newToken();

    const player: InternalPlayer = {
      id: playerId,
      name,
      isHost: false,
      isConnected: true,
      token,
      socketId,
      score: 0,
      timeline: [],
    };

    room.players.set(playerId, player);
    room.socketToPlayer.set(socketId, playerId);
    this.socketToRoom.set(socketId, roomCode);
    // Late joiners play along if the deck allows; in a finished game they wait for the lobby.
    if (room.status === 'lobby') room.playerOrder.push(playerId);
    else game.seatPlayer(room, player);
    this.scheduleCleanup(room);
    return { ok: true, playerId, playerToken: token };
  }

  /** Token-only reconnect (reload, auto-reconnect); never creates a player. */
  rejoinRoom(socketId: string, roomCode: string, playerToken: string): JoinResult {
    const room = this.rooms.get(roomCode);
    if (this.isInOtherRoom(socketId, roomCode)) return { ok: false, error: 'Du bist bereits in einem Raum.' };
    const result = room ? this.reconnect(socketId, room, playerToken) : null;
    return result ?? { ok: false, error: 'Raum nicht gefunden.' };
  }

  /**
   * Leaving the lobby or the result screen removes the player; the host leaving closes
   * the room. Mid-game there's no leave button, so a leave there is just a disconnect.
   */
  leaveRoom(socketId: string): LeaveResult | null {
    const roomCode = this.socketToRoom.get(socketId);
    const room = roomCode ? this.rooms.get(roomCode) : undefined;
    const player = room ? this.getPlayer(socketId, room) : null;
    if (!room || !player || room.status === 'playing') return null;

    if (player.isHost) {
      this.deleteRoom(room);
      return { closed: true, roomCode: room.code };
    }
    this.unmapSocket(room, socketId);
    room.players.delete(player.id);
    room.playerOrder = room.playerOrder.filter((id) => id !== player.id);
    return { closed: false, roomCode: room.code };
  }

  kickPlayer(socketId: string, roomCode: string, targetPlayerId: string): KickResult {
    const room = this.rooms.get(roomCode);
    if (!room) return { ok: false, error: 'Raum nicht gefunden.' };

    const player = this.getPlayer(socketId, room);
    if (!player?.isHost) return { ok: false, error: 'Nur der Host kann Spieler entfernen.' };
    if (targetPlayerId === player.id)
      return { ok: false, error: 'Der Host kann sich nicht selbst entfernen.' };
    if (room.status !== 'lobby')
      return { ok: false, error: 'Spieler können nur in der Lobby entfernt werden.' };

    const target = room.players.get(targetPlayerId);
    if (!target) return { ok: false, error: 'Spieler nicht gefunden.' };

    const kickedSocketId = target.socketId;
    this.unmapSocket(room, target.socketId);
    room.players.delete(targetPlayerId);
    room.playerOrder = room.playerOrder.filter((id) => id !== targetPlayerId);
    return { ok: true, kickedSocketId };
  }

  handleDisconnect(socketId: string): {
    roomCode: string;
    playerId: string;
    isHost: boolean;
    wasPlaying: boolean;
  } | null {
    const roomCode = this.socketToRoom.get(socketId);
    if (!roomCode) return null;
    this.socketToRoom.delete(socketId);

    const room = this.rooms.get(roomCode);
    if (!room) return null;

    const playerId = room.socketToPlayer.get(socketId);
    room.socketToPlayer.delete(socketId);
    if (!playerId) return null;

    const player = room.players.get(playerId);
    if (!player) return null;

    player.isConnected = false;
    const wasPlaying = room.status === 'playing';
    this.syncTurnTimer(room);

    if (![...room.players.values()].some((p) => p.isConnected)) {
      this.scheduleCleanup(room, EMPTY_ROOM_TTL_MS);
    }

    // Only the host can skip players, so nobody could unblock a game whose host is gone for good.
    if (player.isHost && wasPlaying) {
      clearTimeout(room.hostTimeout);
      room.hostTimeout = setTimeout(() => {
        if (room.status !== 'playing' || player.isConnected) return;
        game.finishGame(room);
        this.syncTurnTimer(room);
        this.events.onHostTimeout(room.code);
      }, HOST_RECONNECT_GRACE_MS);
    }

    return { roomCode, playerId, isHost: player.isHost, wasPlaying };
  }

  // ── Game actions (auth check here, logic delegated to game.ts) ───────────

  startGame(
    socketId: string,
    roomCode: string,
    songs: SongFull[],
    rounds: number,
    audioMode: AudioMode,
  ): SimpleResult {
    const room = this.rooms.get(roomCode);
    if (!room) return { ok: false, error: 'Raum nicht gefunden.' };
    const player = this.getPlayer(socketId, room);
    if (!player?.isHost) return { ok: false, error: 'Nur der Host kann das Spiel starten.' };
    const result = game.startGame(room, songs, rounds, audioMode);
    if (result.ok) this.syncTurnTimer(room, 0);
    return result;
  }

  placeSong(socketId: string, roomCode: string, position: number): PlaceResult {
    const room = this.rooms.get(roomCode);
    if (!room) return { ok: false, error: 'Raum nicht gefunden.' };
    const playerId = room.socketToPlayer.get(socketId);
    if (!playerId) return { ok: false, error: 'Nicht autorisiert.' };
    const result = game.placeSong(room, playerId, position);
    if (result.ok) this.syncTurnTimer(room, REVEAL_DURATION_MS);
    return result;
  }

  updateSettings(
    socketId: string,
    roomCode: string,
    rounds: number,
    audioMode: AudioMode,
    turnLimit: number,
  ): SimpleResult {
    const room = this.rooms.get(roomCode);
    if (!room) return { ok: false, error: 'Raum nicht gefunden.' };
    const player = this.getPlayer(socketId, room);
    if (!player?.isHost) return { ok: false, error: 'Nur der Host kann Einstellungen ändern.' };
    if (room.status !== 'lobby')
      return { ok: false, error: 'Einstellungen können nur in der Lobby geändert werden.' };
    if (!isValidAudioMode(audioMode)) return { ok: false, error: 'Ungültiger Audio-Modus.' };
    room.rounds = clampRounds(rounds);
    room.audioMode = audioMode;
    room.turnLimit = toTurnLimit(turnLimit);
    return { ok: true };
  }

  returnToLobby(socketId: string, roomCode: string): SimpleResult {
    const room = this.rooms.get(roomCode);
    if (!room) return { ok: false, error: 'Raum nicht gefunden.' };
    const player = this.getPlayer(socketId, room);
    if (!player?.isHost) return { ok: false, error: 'Nur der Host kann das Spiel neu starten.' };
    game.returnToLobby(room);
    this.syncTurnTimer(room);
    return { ok: true };
  }

  skipDisconnectedPlayer(socketId: string, roomCode: string): SkipResult {
    const room = this.rooms.get(roomCode);
    if (!room) return { ok: false, error: 'Raum nicht gefunden.' };
    const player = this.getPlayer(socketId, room);
    if (!player?.isHost)
      return { ok: false, error: 'Nur der Host kann den Spieler überspringen.' };
    const result = game.skipDisconnectedPlayer(room);
    if (result.ok) this.syncTurnTimer(room, 0);
    return result;
  }

  // ── State queries ────────────────────────────────────────────────────────

  getRoomCodeForSocket(socketId: string): string | null {
    return this.socketToRoom.get(socketId) ?? null;
  }

  /** Extends the TTL of the socket's room; called for every accepted client event. */
  touch(socketId: string): void {
    const roomCode = this.socketToRoom.get(socketId);
    const room = roomCode ? this.rooms.get(roomCode) : undefined;
    if (room) this.scheduleCleanup(room);
  }

  isHost(socketId: string, roomCode: string): boolean {
    const room = this.rooms.get(roomCode);
    return !!room && this.getPlayer(socketId, room)?.isHost === true;
  }

  getPausedPlayer(roomCode: string): { id: string; name: string; isHost: boolean } | null {
    const room = this.rooms.get(roomCode);
    const pausedId = room ? game.pausedPlayerId(room) : null;
    const player = pausedId ? room?.players.get(pausedId) : undefined;
    return player ? { id: player.id, name: player.name, isHost: player.isHost } : null;
  }

  getLobbyState(roomCode: string): LobbyState | null {
    const room = this.rooms.get(roomCode);
    if (!room) return null;
    return {
      roomCode: room.code,
      players: this.toPublicPlayers(room),
      rounds: room.rounds,
      audioMode: room.audioMode,
      turnLimit: room.turnLimit,
      status: room.status,
    };
  }

  getGameState(roomCode: string): GameStateForClient | null {
    const room = this.rooms.get(roomCode);
    if (!room) return null;
    return {
      players: this.toPublicPlayers(room),
      currentPlayerId: room.playerOrder[room.currentPlayerIndex] ?? '',
      round: room.round,
      rounds: room.gameRounds,
      audioMode: room.audioMode,
      deckRemaining: room.deck.length - room.currentSongIndex,
      turnEndsInMs: room.turnDeadline === null ? null : Math.max(0, room.turnDeadline - Date.now()),
    };
  }

  getCurrentSongPreview(roomCode: string): SongMeta | null {
    const room = this.rooms.get(roomCode);
    if (!room) return null;
    const song = room.deck[room.currentSongIndex];
    // Only the audio — everything else would let players call out the answer.
    return song ? { preview: song.preview } : null;
  }

  /** Everyone who played: the turn order plus skipped players who still hold cards. */
  getPlayers(roomCode: string): RoomPlayer[] | null {
    const room = this.rooms.get(roomCode);
    if (!room) return null;
    const skipped = [...room.players.values()]
      .filter((p) => !room.playerOrder.includes(p.id) && p.timeline.length > 0)
      .map((p) => p.id);
    return this.toPublicPlayers(room, [...room.playerOrder, ...skipped]);
  }

  getLastCorrectSong(roomCode: string, playerId: string): SongFull | null {
    return this.rooms.get(roomCode)?.lastCorrectSong.get(playerId) ?? null;
  }
}
