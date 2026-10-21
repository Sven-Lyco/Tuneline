import { afterEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEYS } from '../constants';
import { socket } from '../test/fakeSocket';

type Presence = typeof import('./tabPresence');

/** A second module instance = a second tab with its own BroadcastChannel. */
async function otherTab(): Promise<Presence> {
  vi.resetModules();
  return import('./tabPresence');
}

afterEach(() => {
  vi.resetModules();
});

describe('isSeatActiveElsewhere', () => {
  it('is false when no other tab plays with the token', async () => {
    const tab = await import('./tabPresence');
    expect(await tab.isSeatActiveElsewhere('tok', 50)).toBe(false);
  });

  it('is true when another connected tab holds the seat', async () => {
    const asking = await import('./tabPresence');
    await otherTab(); // answers from this "tab"
    sessionStorage.setItem(STORAGE_KEYS.playerToken, 'tok');
    socket.connected = true;
    expect(await asking.isSeatActiveElsewhere('tok', 200)).toBe(true);
  });

  it('ignores tabs that are offline or hold another seat', async () => {
    const asking = await import('./tabPresence');
    await otherTab();
    sessionStorage.setItem(STORAGE_KEYS.playerToken, 'other');
    socket.connected = true;
    expect(await asking.isSeatActiveElsewhere('tok', 100)).toBe(false);

    sessionStorage.setItem(STORAGE_KEYS.playerToken, 'tok');
    socket.connected = false;
    expect(await asking.isSeatActiveElsewhere('tok', 100)).toBe(false);
  });

  it('answers false right away without BroadcastChannel', async () => {
    vi.stubGlobal('BroadcastChannel', undefined);
    const tab = await otherTab();
    expect(await tab.isSeatActiveElsewhere('tok')).toBe(false);
  });
});
