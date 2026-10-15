import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

type MenuItem = { label: string; danger?: boolean; onClick: () => void };
type MenuAt = { x: number; y: number; caret?: 'left' | 'right' | 'center'; sheet?: boolean };
export type ToastState = { msg: string; undo?: () => void };
type ConfirmOpts = { title: string; body?: string; ok?: string; destructive?: boolean };
type UiCtx = {
  toast: (msg: string, opts?: { undo?: () => void }) => void;
  toastMsg: string;
  toastState: ToastState | null;
  dismissToast: () => void;
  confirm: (opts: ConfirmOpts) => Promise<boolean>;
  confirmState: ConfirmOpts | null;
  resolveConfirm: (v: boolean) => void;
  openMenu: (items: MenuItem[], title?: string, at?: MenuAt) => void;
  menu: { items: MenuItem[]; title?: string; at?: MenuAt } | null;
  closeMenu: () => void;
};

const Ctx = createContext<UiCtx | null>(null);

export function UiProvider({ children }: { children: ReactNode }) {
  const [toastState, setToastState] = useState<ToastState | null>(null);
  const [confirmState, setConfirm] = useState<UiCtx['confirmState']>(null);
  const [resolver, setResolver] = useState<((v: boolean) => void) | null>(null);
  const [menu, setMenu] = useState<UiCtx['menu']>(null);
  const toastTimer = useRef(0);

  const toast = useCallback((msg: string, opts?: { undo?: () => void }) => {
    window.clearTimeout(toastTimer.current);
    setToastState({ msg, undo: opts?.undo });
    toastTimer.current = window.setTimeout(() => setToastState(null), opts?.undo ? 4200 : 2800);
  }, []);

  const dismissToast = useCallback(() => {
    window.clearTimeout(toastTimer.current);
    setToastState(null);
  }, []);

  const confirm = useCallback((opts: ConfirmOpts) => {
    return new Promise<boolean>((resolve) => {
      setConfirm(opts);
      setResolver(() => resolve);
    });
  }, []);

  const resolveConfirm = useCallback((v: boolean) => {
    setConfirm(null);
    resolver?.(v);
    setResolver(null);
  }, [resolver]);

  return (
    <Ctx.Provider value={{
      toast,
      toastMsg: toastState?.msg || '',
      toastState,
      dismissToast,
      confirm,
      confirmState,
      resolveConfirm,
      openMenu: (items, title, at) => setMenu({ items, title, at }),
      menu,
      closeMenu: () => setMenu(null),
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useUi() {
  const v = useContext(Ctx);
  if (!v) throw new Error('UiProvider');
  return v;
}
