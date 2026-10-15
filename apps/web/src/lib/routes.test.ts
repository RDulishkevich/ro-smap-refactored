import { describe, expect, it } from 'vitest';
import { parsePath, pathForEvent, pathForSound, pathForUser } from './routes';

describe('parsePath', () => {
  it('maps product surfaces', () => {
    expect(parsePath('/')).toEqual({ kind: 'home' });
    expect(parsePath('/map')).toEqual({ kind: 'map' });
    expect(parsePath('/menu')).toEqual({ kind: 'menu' });
    expect(parsePath('/catalog')).toEqual({ kind: 'catalog' });
    expect(parsePath('/library')).toEqual({ kind: 'catalog' });
    expect(parsePath('/feed')).toEqual({ kind: 'feed' });
    expect(parsePath('/expeditions')).toEqual({ kind: 'expeditions' });
    expect(parsePath('/settings')).toEqual({ kind: 'settings' });
    expect(parsePath('/help')).toEqual({ kind: 'help' });
    expect(parsePath('/support')).toEqual({ kind: 'help' });
    expect(parsePath('/messages')).toEqual({ kind: 'messages' });
    expect(parsePath('/drafts')).toEqual({ kind: 'drafts' });
    expect(parsePath('/profile')).toEqual({ kind: 'profile' });
    expect(parsePath('/guessr')).toEqual({ kind: 'guessr' });
  });

  it('parses entity urls', () => {
    expect(parsePath('/s/abc%201')).toEqual({ kind: 'sound', id: 'abc 1' });
    expect(parsePath('/u/@roma')).toEqual({ kind: 'user', login: '@roma' });
    expect(parsePath('/e/evt-1')).toEqual({ kind: 'events', id: 'evt-1' });
  });

  it('builds share paths', () => {
    expect(pathForSound('x y')).toBe('/s/x%20y');
    expect(pathForUser('@roma')).toBe('/u/roma');
    expect(pathForEvent('e1')).toBe('/e/e1');
  });
});
