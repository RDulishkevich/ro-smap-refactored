import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchMapCatalog, fetchMapData, resetCatalogFetchCache } from './cloud';

afterEach(() => {
  resetCatalogFetchCache();
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
      text: async () => '[]',
    });
    vi.stubGlobal('fetch', fetchMock);
    await fetchMapData();
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  it('treats 304 as unchanged and keeps last-good catalog', async () => {
    const payload = [{ id: 'snd_1', title: 'a' }];
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: (n: string) => (n.toLowerCase() === 'etag' ? '"v1"' : null) },
        text: async () => JSON.stringify(payload),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 304,
        headers: { get: (n: string) => (n.toLowerCase() === 'etag' ? '"v1"' : null) },
      });
    vi.stubGlobal('fetch', fetchMock);
    const first = await fetchMapCatalog();
    expect(first.unchanged).toBe(false);
    expect(first.data[0]?.id).toBe('snd_1');
    const second = await fetchMapCatalog();
    expect(second.unchanged).toBe(true);
    expect(second.data).toBe(first.data);
    expect(fetchMock.mock.calls[1][1].headers['If-None-Match']).toBe('"v1"');
  });

  it('does not send If-None-Match when the body cache is empty', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 304,
      headers: { get: () => null },
    });
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchMapCatalog()).rejects.toMatchObject({ code: 'cloud_unavailable', status: 304 });
    expect(fetchMock.mock.calls[0][1].headers['If-None-Match']).toBeUndefined();
  });

  it('does not treat a non-array body as an empty catalog', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      text: async () => '{}',
    }));
    await expect(fetchMapData()).rejects.toMatchObject({ code: 'cloud_unavailable' });
  });
});
