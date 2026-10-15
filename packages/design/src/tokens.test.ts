import { describe, expect, it } from 'vitest';
import { breakpoint, color, fonts, makeTheme, typeRoles } from './tokens';

describe('design tokens', () => {
  it('keeps the earth-tone palette', () => {
    expect(color.accent).toBe('#B5613F');
    expect(color.dark).toBe('#2D3C39');
    expect(color.mist).toBe('#92B3B1');
    expect(Object.values(color).join(' ')).not.toMatch(/#FBAB57/i);
  });

  it('uses Klukva for voice and Geist for UI', () => {
    expect(typeRoles.page.fontFamily).toBe(fonts.brand);
    expect(typeRoles.page.fontWeight).toBe(400);
    expect(typeRoles.title.fontWeight).toBe(400);
    expect(typeRoles.heading.fontFamily).toBe(fonts.ui);
    expect(typeRoles.heading.fontWeight).toBe(500);
    expect(typeRoles.body.fontWeight).toBe(400);
    expect([400, 500]).toContain(typeRoles.button.fontWeight);
  });

  it('splits chrome at 768px', () => {
    expect(breakpoint).toBe(768);
    expect(makeTheme(false).isDark).toBe(false);
    expect(makeTheme(true).cardBg).toBe('#243530');
  });
});
