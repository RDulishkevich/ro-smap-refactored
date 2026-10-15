import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HoverMenu, PopoverCaret } from './HoverMenu';
import { Overlays } from './chrome';
import { renderUi } from '../test/render';

function setWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width });
  window.dispatchEvent(new Event('resize'));
}

describe('PopoverCaret', () => {
  it('rotates a diamond pointer', () => {
    const { container } = renderUi(<PopoverCaret fill="#fff" border="#ccc" align="right" />);
    const caret = container.querySelector('[aria-hidden]');
    expect(caret).toBeTruthy();
    expect((caret as HTMLElement).style.transform).toContain('rotate(45deg)');
  });
});

describe('HoverMenu desktop', () => {
  beforeEach(() => setWidth(1280));

  it('opens on hover, shows items, closes on Escape', async () => {
    const onListen = vi.fn();
    const user = userEvent.setup();
    renderUi(
      <HoverMenu title="Карта" items={[{ label: 'Слушать', onClick: onListen }]}>
        <span>ещё</span>
      </HoverMenu>,
    );
    await user.hover(screen.getByRole('button', { name: 'Ещё: Карта' }));
    expect(await screen.findByRole('menu')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Слушать' })).toBeInTheDocument();
    expect(document.querySelector('svg.fixed')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
  });

  it('opens immediately on click as a hover fallback', async () => {
    const user = userEvent.setup();
    renderUi(
      <HoverMenu items={[{ label: 'Слушать', onClick: () => {} }]}>
        <span>ещё</span>
      </HoverMenu>,
    );
    await user.click(screen.getByRole('button', { name: 'Ещё' }));
    expect(await screen.findByRole('menu')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
  });

  it('runs the item action and closes', async () => {
    const onListen = vi.fn();
    const user = userEvent.setup();
    renderUi(
      <HoverMenu items={[{ label: 'Слушать', onClick: onListen }]}>
        <span>ещё</span>
      </HoverMenu>,
    );
    await user.hover(screen.getByRole('button', { name: 'Ещё' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Слушать' }));
    expect(onListen).toHaveBeenCalledOnce();
    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
  });
});

describe('HoverMenu mobile', () => {
  beforeEach(() => setWidth(390));

  it('opens the shared overlay menu', async () => {
    const user = userEvent.setup();
    renderUi(
      <>
        <HoverMenu title="Карта" items={[{ label: 'На карте', onClick: () => {} }]}>
          <span>ещё</span>
        </HoverMenu>
        <Overlays />
      </>,
    );
    await user.click(screen.getByRole('button', { name: 'Ещё: Карта' }));
    expect(await screen.findByRole('menuitem', { name: 'На карте' })).toBeInTheDocument();
  });
});
