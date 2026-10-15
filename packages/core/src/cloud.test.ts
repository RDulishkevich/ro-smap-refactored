import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchMapData } from './cloud';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('catalog fetch', () => {
  it('fails closed on HTTP error instead of returning []', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      headers: { get: () => null },
    }));
    await expect(fetchMapData()).rejects.toMatchObject({ code: 'cloud_unavailable', status: 503 });
  });

  it('passes an AbortSignal so hung reads can time out', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => [],
    });
    vi.stubGlobal('fetch', fetchMock);
    await fetchMapData();
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });
});
