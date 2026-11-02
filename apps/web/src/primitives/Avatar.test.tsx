import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { Avatar } from './Avatar';
import { renderUi } from '../test/render';

describe('Avatar', () => {
  it('names a letter fallback for assistive tech', () => {
    renderUi(<Avatar name="Ира" />);
    expect(screen.getByRole('img', { name: 'Ира' })).toBeInTheDocument();
  });
});
