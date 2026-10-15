import { describe, expect, it, vi } from 'vitest';
import { downloadLegalPrint } from './legal-print';

describe('downloadLegalPrint', () => {
  it('escapes the document title in the print window', () => {
    const write = vi.fn();
    const close = vi.fn();
    vi.stubGlobal('open', () => ({ document: { write, close }, print: vi.fn() }));
    expect(downloadLegalPrint('privacy')).toBe(true);
    const html = String(write.mock.calls[0][0]);
    expect(html).toMatch(/<title>/);
    expect(html).not.toMatch(/<title>.*<script>/i);
    vi.unstubAllGlobals();
  });
});
