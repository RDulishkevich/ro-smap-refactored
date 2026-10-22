import { useMemo, useState } from 'react';
import {
  apiAdminDeleteUser, apiAdminEmailConflicts, apiAdminSendEmail, apiAdminUnbindEmail, apiGetSecurityEvents,
  apiSyncJson, pendingSounds, rejectedSounds, roleAtLeast,
  SUPPORT_AVATAR, SUPPORT_LOGIN, SUPPORT_NAME, type Profile, type Sound,
} from '@polevka/core';
import { getRejectSuggestionChips } from '../../../../src/data/publishRules.js';
import { color, type ThemeTokens } from '@polevka/design';
import { Shield } from 'lucide-react';
import { ScreenHeader } from '../primitives/ui';
import { EmptyNote } from '../primitives/EmptyNote';
import { useAuth } from '../state/AuthContext';
import { useData } from '../state/DataContext';
import { useNav } from '../state/NavContext';
import { useTh } from '../state/ThemeContext';
import { useUi } from '../state/UiContext';
import { useT } from '../state/PrefsContext';
import { useIsDesktop } from '../lib/use-media';

const ACCENT = color.accent;

type Tab = 'overview' | 'moderation' | 'reports' | 'users' | 'tickets' | 'analytics' | 'console';

export function StaffScreen({ onBack, mode = 'gate' }: { onBack: () => void; mode?: 'gate' | 'host' }) {
  const th = useTh();
  const t = useT();
  const desktop = useIsDesktop();
  const { allSounds, reload, profiles, mail } = useData();
  const { user } = useAuth();
  const { toast, confirm } = useUi();
  const { push } = useNav();
  const [tab, setTab] = useState<Tab>('overview');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all' | 'pending' | 'rejected' | 'published'>('pending');
  const chips = getRejectSuggestionChips() as Array<{ id: string; label: string; text: string }>;
  const canAdmin = roleAtLeast(user?.role, 'admin');
  const canOwner = roleAtLeast(user?.role, 'owner');

  const list = useMemo(() => {
    let s = allSounds.filter((x) => !x.deleted);
    if (status === 'pending') s = pendingSounds(allSounds);
    else if (status === 'rejected') s = rejectedSounds(allSounds);
    else if (status === 'published') s = allSounds.filter((x) => !x.deleted && (!x.status || x.status === 'published'));
    if (q.trim()) {
      const n = q.toLowerCase();
      s = s.filter((x) => `${x.title} ${x.user} ${x.ucsCat}`.toLowerCase().includes(n));
    }
    return s;
  }, [allSounds, status, q]);

  const reported = allSounds.filter((s) => !s.deleted && Array.isArray(s.reports) && s.reports.length > 0);
  const tickets = mail.flatMap((box) => (box.inbox || [])
    .filter((m) => m._ticket || m.ticketNumber)
    .map((m) => ({ box: box.loginName, msg: m })));
  const pendingCount = pendingSounds(allSounds).length;
  const publishedCount = allSounds.filter((x) => !x.deleted && (!x.status || x.status === 'published')).length;
  const rejectedCount = rejectedSounds(allSounds).length;

  const openStaffHost = () => {
    const url = import.meta.env.DEV
      ? `${window.location.origin}/staff.html`
      : 'https://www.polevka.art/staff/';
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const patchStatus = async (id: string | number, nextStatus: string, extra: Record<string, unknown> = {}) => {
    const cur = allSounds.find((s) => String(s.id) === String(id));
    if (!cur) return;
    await apiSyncJson('map_data.json', [{ ...cur, status: nextStatus, ...extra }]);
    await reload();
  };

  const saveProfile = async (p: Profile) => {
    await apiSyncJson('profiles.json', [{ ...p, profileUpdatedAt: new Date().toISOString() }]);
    await reload();
  };

  const scanEmailConflicts = async () => {
    try {
      const data = await apiAdminEmailConflicts() as {
        conflicts?: Array<{ email: string; accounts: Array<{ login: string; emailVerified?: boolean }> }>;
      };
      const listC = data.conflicts || [];
      if (!listC.length) {
        toast('Конфликтов email нет');
        return;
      }
      const body = listC.slice(0, 12).map((c) => `${c.email}: ${c.accounts.map((a) => a.login).join(', ')}`).join('\n');
      await confirm({
        title: `Конфликты email (${listC.length})`,
        body: `${body}${listC.length > 12 ? '\n…' : ''}`,
        ok: 'Понятно',
      });
    } catch (e: unknown) {
      toast((e as Error).message || 'Не удалось');
    }
  };

  if (mode === 'gate') {
    return (
      <div className="flex flex-col h-full" style={{ background: th.phoneBg }}>
        {!desktop && <ScreenHeader title="Staff" onBack={onBack} />}
        <div className={`${desktop ? 'p-6' : 'p-4'} flex flex-col gap-4`}>
          <div className="rounded-3xl px-4 py-5 flex flex-col gap-3" style={{ background: th.cardBg, border: `1px solid ${th.border}` }}>
            <div className="flex items-center gap-2">
              <Shield size={20} color={ACCENT} />
              <p className="pv-heading" style={{ color: th.inkText }}>Staff</p>
            </div>
            <p className="pv-body leading-snug" style={{ color: th.muted }}>
              Админка: логин + код из аутентификатора. Пароль аккаунта не нужен.
            </p>
            <p className="pv-caption" style={{ color: th.soft }}>www.polevka.art/staff</p>
            <button type="button" onClick={openStaffHost} className="pv-button w-full min-h-11 rounded-2xl text-white mt-1"
              style={{ background: ACCENT }}>
              Открыть админку
            </button>
          </div>
        </div>
      </div>
    );
  }

  const tabs: Array<[Tab, string, boolean]> = [
    ['overview', 'Обзор', true],
    ['moderation', 'Модерация', true],
    ['reports', 'Жалобы', true],
    ['tickets', 'Поддержка', true],
    ['users', 'Люди', canAdmin],
    ['analytics', 'Аналитика', true],
    ['console', 'Консоль', canOwner],
  ];

  return (
    <div className="flex flex-col h-full" style={{ background: th.phoneBg }}>
      {!desktop && <ScreenHeader title="Dashboard" onBack={onBack} />}
      <div className={`${desktop ? 'px-6 pt-4' : 'px-4 pt-2'} flex flex-col gap-2`}>
        <div className="rounded-2xl px-3 py-2.5 flex flex-wrap items-center gap-2" style={{ background: th.cardBg, border: `1px solid ${th.border}` }}>
          <Shield size={16} color={ACCENT} />
          <p className="pv-caption flex-1" style={{ color: th.muted }}>
            {user?.role === 'owner' ? 'Владелец' : user?.role === 'admin' ? 'Админ' : 'Модератор'} · @{user?.loginName}
          </p>
          {canAdmin && (
            <button type="button" onClick={() => void scanEmailConflicts()} className="pv-caption px-3 py-1.5 rounded-xl" style={{ background: th.lightBg, color: th.inkText }}>
              Конфликты email
            </button>
          )}
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {tabs.filter(([, , on]) => on).map(([id, lab]) => (
            <button key={id} onClick={() => setTab(id)} className="px-3 py-2 rounded-2xl text-xs font-semibold whitespace-nowrap"
              style={{ background: tab === id ? ACCENT : th.lightBg, color: tab === id ? '#fff' : th.muted }}>{lab}</button>
          ))}
        </div>
      </div>
      <div className={`${desktop ? 'p-6' : 'p-4'} overflow-y-auto flex-1`}>
        {tab === 'overview' && (
          <div className="grid grid-cols-2 gap-2 mb-4">
            {[
              ['На модерации', pendingCount],
              ['Жалобы', reported.length],
              ['Тикеты', tickets.length],
              ['Люди', profiles.length],
              ['Опубликовано', publishedCount],
              ['Отклонено', rejectedCount],
            ].map(([lab, n]) => (
              <div key={String(lab)} className="rounded-2xl p-3" style={{ background: th.cardBg }}>
                <p className="pv-micro" style={{ color: th.soft }}>{lab}</p>
                <p className="pv-heading" style={{ color: th.inkText }}>{n}</p>
              </div>
            ))}
          </div>
        )}

        {tab === 'moderation' && (
          <>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск" className="w-full rounded-2xl px-3 py-2.5 text-sm outline-none mb-3" style={{ background: th.cardBg, color: th.inkText }} />
            <div className="flex gap-1.5 mb-4 flex-wrap">
              {([
                ['pending', 'На модерации'],
                ['rejected', 'Отклонено'],
                ['published', 'Опубликовано'],
                ['all', 'Все'],
              ] as const).map(([id, lab]) => (
                <button key={id} onClick={() => setStatus(id)} className="px-3 py-1.5 rounded-full text-[11px] font-semibold"
                  style={{ background: status === id ? ACCENT : th.lightBg, color: status === id ? '#fff' : th.muted }}>{lab}</button>
              ))}
            </div>
            {list.map((s) => (
              <SoundModRow key={String(s.id)} s={s} th={th} chips={chips} onOpen={() => push({ type: 'sound-detail', sound: s })}
                onApprove={() => void patchStatus(s.id, 'published').then(() => toast('Опубликовано')).catch((e: Error) => toast(e.message))}
                onReject={(note) => void (async () => {
                  const ok = await confirm({ title: 'Отклонить запись?', body: note, ok: 'Отклонить' });
                  if (!ok) return;
                  try { await patchStatus(s.id, 'rejected', { rejectNote: note }); toast('Отклонено'); }
                  catch (e: unknown) { toast((e as Error).message); }
                })()}
                onDelete={() => void (async () => {
                  const ok = await confirm({ title: 'Удалить запись?', body: s.title, ok: 'Удалить' });
                  if (!ok) return;
                  try {
                    await apiSyncJson('map_data.json', [{ ...s, deleted: true }]);
                    toast('Удалено');
                    await reload();
                  } catch (e: unknown) { toast((e as Error).message); }
                })()}
              />
            ))}
            {!list.length && <EmptyNote title={t('staffEmpty')} hint={t('staffEmptyHint')} />}
          </>
        )}

        {tab === 'reports' && (
          <>
            {reported.map((s) => (
              <div key={String(s.id)} className="rounded-2xl p-3 mb-2" style={{ background: th.cardBg }}>
                <p className="text-xs font-bold" style={{ color: th.inkText }}>{s.title}</p>
                <p className="text-[10px] mb-2" style={{ color: th.muted }}>жалоб: {(s.reports as unknown[]).length}</p>
                <div className="flex gap-1.5">
                  <button className="text-[10px] font-semibold text-white px-3 py-2 rounded-xl" style={{ background: ACCENT }}
                    onClick={() => push({ type: 'sound-detail', sound: s })}>К записи</button>
                  <button className="text-[10px] font-semibold px-3 py-2 rounded-xl" style={{ background: th.lightBg, color: th.muted }}
                    onClick={() => void patchStatus(s.id, s.status || 'published', { reports: [] }).then(() => toast('Жалобы сняты'))}>Снять</button>
                </div>
              </div>
            ))}
            {!reported.length && <p className="text-xs" style={{ color: th.soft }}>Нет жалоб</p>}
          </>
        )}

        {tab === 'users' && canAdmin && (
          <UsersTab
            profiles={profiles}
            q={q}
            setQ={setQ}
            th={th}
            canAdmin={canAdmin}
            canOwner={canOwner}
            toast={toast}
            confirm={confirm}
            saveProfile={saveProfile}
          />
        )}

        {tab === 'tickets' && (
          <>
            {tickets.map((row) => (
              <div key={row.msg.id} className="rounded-2xl p-3 mb-2" style={{ background: th.cardBg }}>
                <p className="text-xs font-bold" style={{ color: th.inkText }}>№{row.msg.ticketNumber || '—'} · {row.box}</p>
                <p className="text-[10px] mb-2" style={{ color: th.muted }}>{row.msg.text}</p>
                <button className="text-[10px] font-semibold text-white px-3 py-2 rounded-xl" style={{ background: ACCENT }}
                  onClick={() => push({ type: 'conversation', name: row.box, avatar: '🛟', peer: row.box })}>Ответить</button>
              </div>
            ))}
            {!tickets.length && <p className="text-xs" style={{ color: th.soft }}>Нет обращений</p>}
            <button className="mt-3 text-[10px] font-semibold" style={{ color: th.soft }}
              onClick={() => push({ type: 'conversation', name: SUPPORT_NAME, avatar: SUPPORT_AVATAR, peer: SUPPORT_LOGIN })}>Чат поддержки</button>
          </>
        )}

        {tab === 'analytics' && (
          <div className="flex flex-col gap-3">
            <p className="pv-subtitle" style={{ color: th.inkText }}>Статусы звуков</p>
            {[
              ['Опубликовано', publishedCount, publishedCount + pendingCount + rejectedCount],
              ['Очередь', pendingCount, publishedCount + pendingCount + rejectedCount],
              ['Отклонено', rejectedCount, publishedCount + pendingCount + rejectedCount],
            ].map(([lab, n, total]) => {
              const pct = total ? Math.round((Number(n) / Number(total)) * 100) : 0;
              return (
                <div key={String(lab)}>
                  <div className="flex justify-between pv-caption mb-1" style={{ color: th.muted }}>
                    <span>{lab}</span><span>{n} · {pct}%</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: th.lightBg }}>
                    <div className="h-full rounded-full" style={{ width: `${Math.max(pct, 2)}%`, background: ACCENT }} />
                  </div>
                </div>
              );
            })}
            {!canAdmin && (
              <p className="pv-micro mt-2" style={{ color: th.soft }}>Модератору доступна урезанная сводка.</p>
            )}
          </div>
        )}

        {tab === 'console' && canOwner && (
          <ConsoleTab th={th} toast={toast} scanEmailConflicts={scanEmailConflicts} />
        )}
      </div>
    </div>
  );
}

function SoundModRow({ s, th, chips, onOpen, onApprove, onReject, onDelete }: {
  s: Sound; th: ThemeTokens;
  chips: Array<{ id: string; text: string }>;
  onOpen: () => void; onApprove: () => void; onReject: (note: string) => void; onDelete: () => void;
}) {
  return (
    <div className="rounded-3xl p-4 mb-3 shadow-sm" style={{ background: th.cardBg }}>
      <button className="text-left w-full" onClick={onOpen}>
        <p className="text-sm font-bold" style={{ color: th.inkText }}>{s.title}</p>
        <p className="text-xs mb-3" style={{ color: th.muted }}>{s.user} · {s.status} · {s.ucsCatId || s.ucsCat || s.type}</p>
      </button>
      <div className="flex flex-wrap gap-1.5">
        <button className="text-xs font-semibold text-white px-3 py-2 rounded-2xl" style={{ background: ACCENT }} onClick={onApprove}>Одобрить</button>
        {chips.slice(0, 4).map((c) => (
          <button key={c.id} className="text-xs font-semibold px-3 py-2 rounded-2xl" style={{ background: th.lightBg, color: th.muted }}
            onClick={() => onReject(c.text)}>{c.id}</button>
        ))}
        <button className="text-xs font-semibold px-3 py-2 rounded-2xl" style={{ background: th.lightBg, color: ACCENT }} onClick={onDelete}>Удалить</button>
      </div>
    </div>
  );
}

function UsersTab({ profiles, q, setQ, th, canAdmin, canOwner, toast, confirm, saveProfile }: {
  profiles: Profile[];
  q: string;
  setQ: (v: string) => void;
  th: ThemeTokens;
  canAdmin: boolean;
  canOwner: boolean;
  toast: (m: string) => void;
  confirm: (o: { title: string; body: string; ok: string }) => Promise<boolean>;
  saveProfile: (p: Profile) => Promise<void>;
}) {
  const [emailLogin, setEmailLogin] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const found = profiles.filter((p) => `${p.loginName} ${p.displayName}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Логин или имя" className="w-full rounded-2xl px-3 py-2 text-xs outline-none mb-2" style={{ background: th.cardBg, color: th.inkText }} />
      {found.slice(0, 40).map((p) => {
        const login = String(p.loginName || '');
        return (
          <div key={login} className="rounded-2xl p-3 mb-2" style={{ background: th.cardBg }}>
            <p className="text-xs font-bold" style={{ color: th.inkText }}>{p.displayName || login}</p>
            <p className="text-[10px] mb-2" style={{ color: th.muted }}>@{login} · {p.role || 'user'}{p.blocked ? ' · blocked' : ''}</p>
            <div className="flex flex-wrap gap-1.5">
              {canAdmin && (
                <button className="text-[10px] px-2 py-1.5 rounded-xl" style={{ background: th.lightBg, color: th.muted }} onClick={() => void saveProfile({ ...p, blocked: !p.blocked }).then(() => toast(p.blocked ? 'Разблокирован' : 'Заблокирован'))}>
                  {p.blocked ? 'Разблок.' : 'Блок'}
                </button>
              )}
              {canAdmin && (
                <button className="text-[10px] px-2 py-1.5 rounded-xl" style={{ background: th.lightBg, color: th.muted }} onClick={() => {
                  const role = p.role === 'moderator' ? 'user' : 'moderator';
                  void saveProfile({ ...p, role }).then(() => toast(`Роль: ${role}`));
                }}>mod ↔ user</button>
              )}
              {canOwner && (
                <button className="text-[10px] px-2 py-1.5 rounded-xl" style={{ background: th.lightBg, color: th.muted }} onClick={() => {
                  const role = p.role === 'admin' ? 'moderator' : 'admin';
                  void saveProfile({ ...p, role }).then(() => toast(`Роль: ${role}`));
                }}>admin</button>
              )}
              {canAdmin && (
                <>
                  <button className="text-[10px] px-2 py-1.5 rounded-xl" style={{ background: th.lightBg, color: th.muted }} onClick={() => setEmailLogin(login)}>Письмо</button>
                  <button className="text-[10px] px-2 py-1.5 rounded-xl" style={{ background: th.lightBg, color: ACCENT }} onClick={() => void (async () => {
                    const ok = await confirm({ title: `Снять email ${login}?`, body: 'admin+', ok: 'Снять' });
                    if (!ok) return;
                    try { await apiAdminUnbindEmail(login); toast('Email снят'); }
                    catch (e: unknown) { toast((e as Error).message); }
                  })()}>Unbind</button>
                </>
              )}
              {canOwner && (
                <button className="text-[10px] px-2 py-1.5 rounded-xl" style={{ background: th.lightBg, color: ACCENT }} onClick={() => void (async () => {
                  const ok = await confirm({ title: `Удалить ${login}?`, body: 'Только владелец. Необратимо.', ok: 'Удалить' });
                  if (!ok) return;
                  try { await apiAdminDeleteUser(login); toast('Удалён'); }
                  catch (e: unknown) { toast((e as Error).message); }
                })()}>Удалить</button>
              )}
            </div>
          </div>
        );
      })}
      {canAdmin && (
        <div className="mt-3 rounded-2xl p-3" style={{ background: th.cardBg }}>
          <p className="text-xs font-bold mb-2" style={{ color: th.inkText }}>Письмо на email</p>
          <input value={emailLogin} onChange={(e) => setEmailLogin(e.target.value)} placeholder="Логин" className="w-full rounded-xl px-3 py-2 text-xs outline-none mb-2" style={{ background: th.lightBg, color: th.inkText }} />
          <textarea value={emailBody} onChange={(e) => setEmailBody(e.target.value)} className="w-full rounded-xl px-3 py-2 text-xs outline-none min-h-[64px]" style={{ background: th.lightBg, color: th.inkText }} />
          <button className="mt-2 w-full py-2.5 rounded-2xl text-xs font-semibold text-white" style={{ background: th.solid }} onClick={async () => {
            try { await apiAdminSendEmail(emailLogin.trim(), emailBody.trim()); toast('Письмо отправлено'); setEmailBody(''); }
            catch (e: unknown) { toast((e as Error).message || 'Не удалось'); }
          }}>Отправить</button>
        </div>
      )}
    </>
  );
}

function ConsoleTab({ th, toast, scanEmailConflicts }: {
  th: ThemeTokens;
  toast: (m: string) => void;
  scanEmailConflicts: () => Promise<void>;
}) {
  const [events, setEvents] = useState<Array<{ type?: string; login?: string; at?: string }>>([]);
  const [loaded, setLoaded] = useState(false);
  const load = async () => {
    try {
      const data = await apiGetSecurityEvents() as { events?: Array<{ type?: string; login?: string; at?: string }> };
      setEvents(data.events || []);
      setLoaded(true);
    } catch (e: unknown) {
      toast((e as Error).message || 'Нет доступа');
    }
  };
  return (
    <div className="flex flex-col gap-3">
      <p className="pv-subtitle" style={{ color: th.inkText }}>Консоль владельца</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="pv-caption px-3 py-2 rounded-xl text-white" style={{ background: ACCENT }} onClick={() => void load()}>
          Security events
        </button>
        <button type="button" className="pv-caption px-3 py-2 rounded-xl" style={{ background: th.lightBg, color: th.inkText }} onClick={() => void scanEmailConflicts()}>
          Email conflicts
        </button>
      </div>
      {loaded && (
        <div className="rounded-2xl p-3 max-h-80 overflow-y-auto" style={{ background: th.cardBg }}>
          {events.slice(0, 40).map((ev, i) => (
            <p key={`${ev.at}-${i}`} className="pv-micro mb-1" style={{ color: th.muted }}>
              {ev.at || '—'} · {ev.type || '?'} · {ev.login || ''}
            </p>
          ))}
          {!events.length && <p className="pv-caption" style={{ color: th.soft }}>Пусто</p>}
        </div>
      )}
    </div>
  );
}
