import type { AddressInfo } from 'node:net';
import { io as connectClient, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@tuneline/shared';
import { createTunelineServer, type TunelineServerOptions } from '../app.js';

export type Client = Socket<ServerToClientEvents, ClientToServerEvents>;

/** Runs a real Tuneline server on a free port; `connect()` opens clients with their own IP. */
export async function startServer(options: Partial<TunelineServerOptions> = {}) {
  const server = createTunelineServer({ frontendOrigin: 'http://localhost', isProd: false, ...options });
  await new Promise<void>((resolve) => server.httpServer.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${(server.httpServer.address() as AddressInfo).port}`;
  const clients: Client[] = [];

  return {
    ...server,
    url,
    async connect(ip = '10.0.0.1'): Promise<Client> {
      const client: Client = connectClient(url, {
        transports: ['websocket'],
        reconnection: false,
        forceNew: true,
        extraHeaders: { 'x-forwarded-for': ip },
      });
      clients.push(client);
      await new Promise<void>((resolve, reject) => {
        client.once('connect', () => resolve());
        client.once('connect_error', reject);
      });
      return client;
    },
    async close() {
      for (const c of clients) c.disconnect();
      await new Promise<void>((resolve) => server.io.close(() => resolve()));
    },
  };
}

export type TestServer = Awaited<ReturnType<typeof startServer>>;

/** Next payload of `event`, or null if it doesn't arrive within `ms`. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function waitFor(client: Client, event: keyof ServerToClientEvents, ms = 1000): Promise<any> {
  return new Promise((resolve) => {
    const handler = (data: unknown) => {
      clearTimeout(timer);
      resolve(data ?? true);
    };
    const timer = setTimeout(() => {
      client.off(event, handler as never);
      resolve(null);
    }, ms);
    client.once(event, handler as never);
  });
}

/** First payload of `event` matching `pred` — skips stale broadcasts from earlier steps. */
export function waitUntil(
  client: Client,
  event: keyof ServerToClientEvents,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pred: (data: any) => boolean,
  ms = 1000,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  return new Promise((resolve) => {
    const handler = (data: unknown) => {
      if (!pred(data)) return;
      clearTimeout(timer);
      client.off(event, handler as never);
      resolve(data);
    };
    const timer = setTimeout(() => {
      client.off(event, handler as never);
      resolve(null);
    }, ms);
    client.on(event, handler as never);
  });
}

/** Resolves when no `event` arrives within `ms` (true) or one does (false). */
export async function staysQuiet(client: Client, event: keyof ServerToClientEvents, ms = 300) {
  return (await waitFor(client, event, ms)) === null;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
