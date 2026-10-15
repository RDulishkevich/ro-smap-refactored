import { afterEach, describe, expect, it, vi } from 'vitest';
import { TOKEN_KEY, apiRequest, apiSyncJson, setAccessToken } from './api';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  setAccessToken('');
});

describe('Secure API client', () => {
  it('sends the JWT in both the header and the JSON body', async () => {
    setAccessToken('jwt-audit');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });
    vi.stubGlobal('fetch', fetchMock);
    await apiRequest('me', {}, { auth: true });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/functions\.yandexcloud\.net/);
    expect((init.headers as Record<string, string>)['X-Rosmap-Token']).toBe('jwt-audit');
    expect(JSON.parse(String(init.body))).toMatchObject({ action: 'me', token: 'jwt-audit' });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('retries write_conflict then throws', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ ok: false, error: 'write_conflict', message: 'busy' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    setAccessToken('jwt-audit');
    localStorage.setItem(TOKEN_KEY, 'jwt-audit');
    await expect(apiSyncJson('map_data.json', [{ id: '1' }])).rejects.toMatchObject({ code: 'write_conflict' });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('surfaces integrity_mismatch without swallowing it', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ ok: false, error: 'integrity_mismatch', message: 'catalog sealed' }),
    }));
    setAccessToken('jwt-audit');
    await expect(apiSyncJson('map_data.json', [{ id: '1' }])).rejects.toMatchObject({
      code: 'integrity_mismatch',
      status: 503,
    });
  });
});
