import { socket } from '../socket';
import { STORAGE_KEYS } from '../constants';

type PresenceMessage =
  { type: 'seat-query'; token: string; id: string } | { type: 'seat-taken'; id: string };

// A channel never receives its own messages, so one instance can both ask and answer.
const channel =
  typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('tuneline-tabs');

// Answer other tabs that want to know whether this tab is playing with their token.
channel?.addEventListener('message', (e: MessageEvent<PresenceMessage>) => {
  if (e.data.type !== 'seat-query') return;
  const mine = sessionStorage.getItem(STORAGE_KEYS.playerToken);
  if (mine === e.data.token && socket.connected) {
    channel.postMessage({ type: 'seat-taken', id: e.data.id } satisfies PresenceMessage);
  }
});

/**
 * Whether another open tab of this browser currently plays as the player owning `token`
 * (a duplicated tab copies sessionStorage, so it would otherwise take over the seat).
 */
export function isSeatActiveElsewhere(token: string, waitMs = 200): Promise<boolean> {
  if (!channel) return Promise.resolve(false);
  const id = Math.random().toString(36).slice(2);

  return new Promise((resolve) => {
    const onMessage = (e: MessageEvent<PresenceMessage>) => {
      if (e.data.type === 'seat-taken' && e.data.id === id) finish(true);
    };
    const finish = (active: boolean) => {
      clearTimeout(timer);
      channel.removeEventListener('message', onMessage);
      resolve(active);
    };
    const timer = setTimeout(() => finish(false), waitMs);
    channel.addEventListener('message', onMessage);
    channel.postMessage({ type: 'seat-query', token, id } satisfies PresenceMessage);
  });
}
