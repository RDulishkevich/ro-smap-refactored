import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormField } from './form';
import { renderUi } from '../test/render';

function Probe() {
  const [v, setV] = useState('');
  const [err, setErr] = useState('');
  return (
    <FormField
      label="Пароль"
      name="password"
      value={v}
      onChange={(next) => { setV(next); setErr(''); }}
      password
      hint="Не короче 8 символов"
      error={err}
      onBlurValidate={() => { if (v.length < 8) setErr('Не короче 8 символов'); }}
    />
  );
}

describe('FormField', () => {
  it('validates on blur and keeps a fix hint', async () => {
    const user = userEvent.setup();
    renderUi(<Probe />);
    const input = screen.getByLabelText('Пароль');
    await user.type(input, 'short');
    expect(screen.queryByText('Не короче 8 символов')).toBeInTheDocument();
    expect(input).not.toHaveAttribute('aria-invalid', 'true');
    await user.tab();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Не короче 8 символов')).toBeInTheDocument();
  });

  it('toggles password visibility', async () => {
    const user = userEvent.setup();
    renderUi(<Probe />);
    const input = screen.getByLabelText('Пароль');
    expect(input).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Показать пароль' }));
    expect(input).toHaveAttribute('type', 'text');
  });
});
