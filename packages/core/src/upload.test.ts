import { describe, expect, it } from 'vitest';
import { downscaleImageBlob, publicMediaKeyFromUrl } from './upload';

describe('publicMediaKeyFromUrl', () => {
  it('parses bucket URLs and relative media/uploads keys', () => {
    expect(publicMediaKeyFromUrl('https://storage.yandexcloud.net/rosmap2026/media/avatars/usr_a/x.jpg'))
      .toBe('media/avatars/usr_a/x.jpg');
    expect(publicMediaKeyFromUrl('uploads/roma/pic.png')).toBe('uploads/roma/pic.png');
    expect(publicMediaKeyFromUrl('/media/sounds/snd_1/a.wav')).toBe('media/sounds/snd_1/a.wav');
    expect(publicMediaKeyFromUrl('https://example.com/nope.jpg')).toBe('');
  });
});

describe('downscaleImageBlob', () => {
  it('leaves gif/svg and non-images untouched', async () => {
    const gif = new Blob([new Uint8Array([71, 73, 70])], { type: 'image/gif' });
    const out = await downscaleImageBlob(gif, 'image/gif');
    expect(out.blob).toBe(gif);
    expect(out.type).toBe('image/gif');

    const wav = new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/wav' });
    const audio = await downscaleImageBlob(wav, 'audio/wav');
    expect(audio.blob).toBe(wav);
  });
});
