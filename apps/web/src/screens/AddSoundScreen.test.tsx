import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { AddSoundScreen } from './AddSoundScreen';
import { renderUi } from '../test/render';

vi.mock('../state/AuthContext', () => ({
  useAuth: () => ({
    user: { loginName: 'tester', username: 'Tester', role: 'user' },
    isLoggedIn: true,
  }),
}));

vi.mock('../state/NavContext', () => ({
  useNav: () => ({
    push: vi.fn(),
    reset: vi.fn(),
    requireAuth: vi.fn(),
    setLeaveGuard: vi.fn(),
  }),
}));

vi.mock('../state/DataContext', () => ({
  useData: () => ({
    reload: vi.fn(),
    profiles: [],
    pickedPoint: null,
    setPickMode: vi.fn(),
    routeDraft: [],
    setRouteDraft: vi.fn(),
    clearMapPick: vi.fn(),
  }),
}));

vi.mock('@polevka/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@polevka/core')>();
  return {
    ...actual,
    apiHealth: vi.fn(async () => ({ ok: true, ucsAi: false })),
  };
});

describe('AddSoundScreen', () => {
  it('mounts the publish form for a signed-in user', () => {
    renderUi(<AddSoundScreen onBack={() => {}} />);
    expect(screen.getByRole('button', { name: 'На модерацию' })).toBeInTheDocument();
    expect(screen.getByText('Заполненность карточки')).toBeInTheDocument();
  });
});
