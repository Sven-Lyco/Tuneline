import { act } from '@testing-library/react';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Handler = (...args: any[]) => void;

const handlers = new Map<string, Set<Handler>>();
const managerHandlers = new Map<string, Set<Handler>>();

/** Every emit the app sent, in order: [event, payload]. */
export const emitted: Array<[string, unknown]> = [];

function add(map: Map<string, Set<Handler>>, event: string, handler: Handler) {
  if (!map.has(event)) map.set(event, new Set());
  map.get(event)!.add(handler);
}

function remove(map: Map<string, Set<Handler>>, event: string, handler?: Handler) {
  if (handler) map.get(event)?.delete(handler);
  else map.delete(event);
}

/** Stand-in for the socket.io client singleton (`src/socket.ts`). */
export const socket = {
  id: 'fake-socket',
  connected: false,
  on(event: string, handler: Handler) {
    add(handlers, event, handler);
    return socket;
  },
  off(event: string, handler?: Handler) {
    remove(handlers, event, handler);
    return socket;
  },
  emit(event: string, payload?: unknown) {
    emitted.push([event, payload]);
    return socket;
  },
  connect() {
    socket.connected = true;
    return socket;
  },
  disconnect() {
    socket.connected = false;
    return socket;
  },
  io: {
    on(event: string, handler: Handler) {
      add(managerHandlers, event, handler);
    },
    off(event: string, handler?: Handler) {
      remove(managerHandlers, event, handler);
    },
  },
};

/** Delivers a server event to the app, inside act() so React state settles. */
export function serverEmit(event: string, payload?: unknown) {
  act(() => {
    for (const handler of [...(handlers.get(event) ?? [])]) handler(payload);
  });
}

/** Fires a socket.io manager event such as 'reconnect'. */
export function managerEmit(event: string) {
  act(() => {
    for (const handler of [...(managerHandlers.get(event) ?? [])]) handler();
  });
}

export function emittedPayloads(event: string): unknown[] {
  return emitted.filter(([e]) => e === event).map(([, payload]) => payload);
}

export function resetSocket() {
  emitted.length = 0;
  socket.connected = false;
}
