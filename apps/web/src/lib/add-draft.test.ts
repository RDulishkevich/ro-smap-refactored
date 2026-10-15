import { afterEach, describe, expect, it } from 'vitest';
import { clearAddDraft, readAddDraft, writeAddDraft } from './add-draft';

afterEach(() => {
  localStorage.clear();
});

describe('add-sound draft', () => {
  it('round-trips title and description', () => {
    writeAddDraft({ title: 'Ручей', desc: 'утро', kind: 'water' });
    expect(readAddDraft()).toMatchObject({ title: 'Ручей', desc: 'утро', kind: 'water' });
    clearAddDraft();
    expect(readAddDraft()).toEqual({});
  });
});
