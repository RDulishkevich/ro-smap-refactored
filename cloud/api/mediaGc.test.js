import { describe, expect, it } from 'vitest';
import {
  actorOwnsMediaKey,
  collectTombstonedMediaUrls,
  isDeletableMediaKey,
  mediaKeyOwnerHint,
  parsePublicMediaKey,
} from './mediaGc.js';

describe('media GC key rules', () => {
  it('parses public URLs and relative media/uploads keys', () => {
    expect(parsePublicMediaKey('https://storage.yandexcloud.net/rosmap2026/media/avatars/usr_a/x.jpg'))
      .toBe('media/avatars/usr_a/x.jpg');
    expect(parsePublicMediaKey('uploads/roma/pic.png')).toBe('uploads/roma/pic.png');
    expect(parsePublicMediaKey('https://example.com/nope.jpg')).toBe('');
  });

  it('rejects catalogs, auth, staging, and prefix-only keys', () => {
    expect(isDeletableMediaKey('map_data.json')).toBe(false);
    expect(isDeletableMediaKey('_auth/users.json')).toBe(false);
    expect(isDeletableMediaKey('staging/roma/map_data.json')).toBe(false);
    expect(isDeletableMediaKey('media/../_auth/users.json')).toBe(false);
    expect(isDeletableMediaKey('media/')).toBe(false);
    expect(isDeletableMediaKey('media/avatars/usr_a/x.jpg')).toBe(true);
    expect(isDeletableMediaKey('uploads/roma/x.jpg')).toBe(true);
  });

  it('owns avatars/uploads for the actor; sounds need a later catalog check', () => {
    const user = { login: 'roma', userId: 'usr_a', admin: false };
    expect(actorOwnsMediaKey('media/avatars/usr_a/x.jpg', user)).toBe(true);
    expect(actorOwnsMediaKey('uploads/roma/x.jpg', user)).toBe(true);
    expect(actorOwnsMediaKey('media/avatars/usr_b/x.jpg', user)).toBe(false);
    expect(actorOwnsMediaKey('media/sounds/snd_1/a.wav', user)).toBe(false);
    expect(actorOwnsMediaKey('media/avatars/usr_b/x.jpg', { ...user, admin: true })).toBe(true);
    expect(mediaKeyOwnerHint('media/sounds/snd_1/a.wav')).toEqual({ type: 'sound', id: 'snd_1' });
  });

  it('collects image/video from newly tombstoned mail', () => {
    const urls = collectTombstonedMediaUrls(
      [{ loginName: 'roma', inbox: [{ id: 'm1', image: 'https://storage.yandexcloud.net/rosmap2026/media/avatars/usr_a/x.jpg' }] }],
      [{ loginName: 'roma', inbox: [{ id: 'm1', deleted: true }] }],
    );
    expect(urls).toEqual(['https://storage.yandexcloud.net/rosmap2026/media/avatars/usr_a/x.jpg']);
  });
});
