import { afterEach, describe, expect, it, vi } from 'vitest';
import { getLegalInfo } from './legal';

afterEach(() => vi.unstubAllGlobals());

describe('getLegalInfo', () => {
  it("reads the operator, and knows nothing when the server can't say", async () => {
    const info = { operatorName: 'Jane Doe', operatorContact: 'tuneline@example.com' };
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => info }))
    );
    expect(await getLegalInfo()).toEqual(info);

    const unknown = { operatorName: null, operatorContact: null };
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, json: async () => ({}) }))
    );
    expect(await getLegalInfo()).toEqual(unknown);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    expect(await getLegalInfo()).toEqual(unknown);
  });
});
