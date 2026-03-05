import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@tuneline/shared';

const SERVER_URL =
  (import.meta.env.VITE_SERVER_URL as string | undefined) ?? 'http://[::1]:3001';

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(SERVER_URL, {
  autoConnect: false,
});
