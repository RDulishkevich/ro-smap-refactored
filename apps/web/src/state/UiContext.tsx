import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

type MenuItem = { label: string; danger?: boolean; onClick: () => void };
type MenuAt = { x: number; y: number };
type UiCtx = {
  toast: (msg: string) => void;
  toastMsg: string;
  confirm: (opts: { title: string; body?: string; ok?: string }) => Promise<boolean>;
  confirmState: { title: string; body?: string; ok?: string } | null;
  resolveConfirm: (v: boolean) => void;
  openMenu: (items: MenuItem[], title?: string, at?: MenuAt) => void;
  menu: { items: MenuItem[]; title?: string; at?: MenuAt } | null;
  closeMenu: () => void;
};

const Ctx = createContext<UiCtx | null>(null);

export function UiProvider({ children }: { children: ReactNode }) {
  const [toastMsg, setToast] = useState('');
  const [confirmState, setConfirm] = useState<UiCtx['confirmState']>(null);
  const [resolver, setResolver] = useState<((v: boolean) => void) | null>(null);
  const [menu, setMenu] = useState<UiCtx['menu']>(null);

  const toast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(''), 2800);
  }, []);

  const confirm = useCallback((opts: { title: string; body?: string; ok?: string }) => {
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
      toast, toastMsg, confirm, confirmState, resolveConfirm,
      openMenu: (items, title, at) => setMenu({ items, title, at }),
      menu, closeMenu: () => setMenu(null),
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
