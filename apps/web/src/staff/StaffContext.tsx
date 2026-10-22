import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { SUPPORT_AVATAR, SUPPORT_LOGIN, SUPPORT_NAME, type Profile, type Sound } from '@polevka/core';

export type StaffPanel =
  | null
  | { type: 'chat'; peer: string; name: string; avatar: string }
  | { type: 'sound'; sound: Sound }
  | { type: 'user'; profile: Profile };

export type SupportIdentity = {
  login: string;
  name: string;
  avatar: string;
};

type StaffCtx = {
  panel: StaffPanel;
  openChat: (peer: string, name: string, avatar?: string) => void;
  openSound: (sound: Sound) => void;
  openUser: (profile: Profile) => void;
  closePanel: () => void;
  supportIdentity: SupportIdentity;
};

const Ctx = createContext<StaffCtx | null>(null);

export const SUPPORT_IDENTITY: SupportIdentity = {
  login: SUPPORT_LOGIN,
  name: SUPPORT_NAME,
  avatar: SUPPORT_AVATAR,
};

export function StaffProvider({ children }: { children: ReactNode }) {
  const [panel, setPanel] = useState<StaffPanel>(null);

  const openChat = useCallback((peer: string, name: string, avatar = '') => {
    const login = String(peer || '').toLowerCase();
    if (!login || login === SUPPORT_LOGIN) return;
    setPanel({ type: 'chat', peer: login, name: name || login, avatar: avatar || '' });
  }, []);

  const openSound = useCallback((sound: Sound) => {
    setPanel({ type: 'sound', sound });
  }, []);

  const openUser = useCallback((profile: Profile) => {
    setPanel({ type: 'user', profile });
  }, []);

  const closePanel = useCallback(() => setPanel(null), []);

  const value = useMemo(() => ({
    panel,
    openChat,
    openSound,
    openUser,
    closePanel,
    supportIdentity: SUPPORT_IDENTITY,
  }), [panel, openChat, openSound, openUser, closePanel]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStaff() {
  const v = useContext(Ctx);
  if (!v) throw new Error('StaffProvider');
  return v;
}

export function useStaffOptional() {
  return useContext(Ctx);
}
