import { shareUrl } from './routes';

export async function shareLink(path: string, title: string): Promise<'shared' | 'copied' | 'abort' | 'fail'> {
  const url = shareUrl(path);
  try {
    if (typeof navigator.share === 'function') {
      await navigator.share({ title, text: title, url });
      return 'shared';
    }
  } catch (err) {
    const name = err instanceof DOMException ? err.name : '';
    if (name === 'AbortError') return 'abort';
  }
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      return 'copied';
    }
  } catch {
    /* fall through */
  }
  return 'fail';
}
