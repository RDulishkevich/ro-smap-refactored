import { describe, expect, it } from 'vitest';
import { breakpoint, color, fonts, makeTheme, typeRoles } from './tokens';

describe('design tokens', () => {
  it('keeps clay accent and no wellness peach', () => {
    expect(color.accent).toBe('#B5613F');
    expect(color.mist).toBe('#7F9B99');
    expect(Object.values(color).join(' ')).not.toMatch(/#FBAB57/i);
  });

  it('uses one Geist family for titles and UI', () => {
    expect(fonts.brand).toBe(fonts.ui);
    expect(typeRoles.page.fontFamily).toBe(fonts.ui);
    expect(typeRoles.page.fontWeight).toBe(500);
    expect(typeRoles.title.fontWeight).toBe(500);
    expect(typeRoles.heading.fontFamily).toBe(fonts.ui);
    expect(typeRoles.heading.fontWeight).toBe(500);
    expect(typeRoles.body.fontWeight).toBe(400);
    expect([400, 500]).toContain(typeRoles.button.fontWeight);
    expect(typeRoles.timer.fontFamily).toBe(fonts.ui);
    expect(typeRoles.timer.fontWeight).toBe(500);
  });

  it('splits chrome at 768px', () => {
    expect(breakpoint).toBe(768);
    expect(makeTheme(false).isDark).toBe(false);
    expect(makeTheme(true).cardBg).toBe('#1C1F1D');
    expect(makeTheme(true).phoneBg).toBe('#131513');
    expect(makeTheme(true).headerBg).toBe('#171917');
    expect(makeTheme(true).inkText).toBe('#F2F2F0');
    expect(makeTheme(true).muted).toBe('#B0B5A6');
    expect(makeTheme(true).soft).toBe('#8A9278');
    expect(makeTheme(true).solid).toBe('#3A3A3A');
    expect(makeTheme(true).lightBg).toBe('#262A27');
    expect(makeTheme(true).border).toMatch(/255,\s*255,\s*255/);
  });

  it('keeps muted readable and sage decorative', () => {
    expect(color.muted).toBe('#5A6354');
    expect(color.sage).toBe('#8A9278');
    expect(makeTheme(false).muted).toBe('#5A6354');
    expect(makeTheme(false).soft).toBe('#8A9278');
  });
});
