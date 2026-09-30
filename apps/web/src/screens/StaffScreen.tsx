import { useMemo, useState } from 'react';
import {
  apiAdminDeleteUser, apiAdminSendEmail, apiAdminUnbindEmail, apiSyncJson,
  pendingSounds, rejectedSounds,
  SUPPORT_LOGIN, SUPPORT_NAME, type Profile, type Sound,
} from '@polevka/core';
import { getRejectSuggestionChips } from '../../../../src/data/publishRules.js';
import { color } from '@polevka/design';
import { Shield } from 'lucide-react';
import { ScreenHeader } from '../primitives/ui';
import { useAuth } from '../state/AuthContext';
import { useData } from '../state/DataContext';
import { useNav } from '../state/NavContext';
import { useTh } from '../state/ThemeContext';
import { useUi } from '../state/UiContext';

const SAGE = color.sage;
const OLIVE = color.olive;
const ACCENT = color.accent;
const DARK = color.dark;

type Tab = 'sounds' | 'reports' | 'users' | 'tickets';

export function StaffScreen({ onBack }: { onBack: () => void }) {
  const th = useTh();
  const { allSounds, reload, profiles, mail } = useData();
  const { user } = useAuth();
  const { toast, confirm } = useUi();
  const { push } = useNav();
  const [tab, setTab] = useState<Tab>('sounds');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all' | 'pending' | 'rejected' | 'published'>('pending');
  const chips = getRejectSuggestionChips() as Array<{ id: string; label: string; text: string }>;
  const isAdmin = user?.role === 'admin';

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

  return (
    <div className="flex flex-col h-full" style={{ background: th.phoneBg }}>
      <ScreenHeader title="Модерация" onBack={onBack} />
      <div className="px-4 pt-2 flex gap-1">
        {([['sounds', 'Звуки'], ['reports', 'Жалобы'], ['users', 'Люди'], ['tickets', 'Тикеты']] as const).map(([id, lab]) => (
          <button key={id} onClick={() => setTab(id)} className="flex-1 py-2 rounded-xl text-[10px] font-semibold"
            style={{ background: tab === id ? ACCENT : th.lightBg, color: tab === id ? '#fff' : OLIVE }}>{lab}</button>
        ))}
      </div>
      <div className="p-4 overflow-y-auto flex-1">
        <p className="text-[10px] mb-3" style={{ color: SAGE }}>{user?.role} · очередь {pendingSounds(allSounds).length} · жалоб {reported.length} · тикетов {tickets.length}</p>

        {tab === 'sounds' && (
          <>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск" className="w-full rounded-2xl px-3 py-2 text-xs outline-none mb-2" style={{ background: th.cardBg, color: th.inkText }} />
            <div className="flex gap-1 mb-3">
              {(['pending', 'rejected', 'published', 'all'] as const).map((id) => (
                <button key={id} onClick={() => setStatus(id)} className="px-2 py-1 rounded-full text-[10px]"
                  style={{ background: status === id ? ACCENT : th.lightBg, color: status === id ? '#fff' : OLIVE }}>{id}</button>
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
            {!list.length && <p className="text-xs" style={{ color: SAGE }}>Пусто</p>}
          </>
        )}

        {tab === 'reports' && (
          <>
            {reported.map((s) => (
              <div key={String(s.id)} className="rounded-2xl p-3 mb-2" style={{ background: th.cardBg }}>
                <p className="text-xs font-bold" style={{ color: th.inkText }}>{s.title}</p>
                <p className="text-[10px] mb-2" style={{ color: OLIVE }}>жалоб: {(s.reports as unknown[]).length}
                  {(s.reports as Array<{ type?: string }>).some((r) => r?.type === 'comment') ? ' · есть на комментарии' : ''}</p>
                <div className="flex gap-1.5">
                  <button className="text-[10px] font-semibold text-white px-3 py-2 rounded-xl" style={{ background: ACCENT }}
                    onClick={() => push({ type: 'sound-detail', sound: s })}>К записи</button>
                  <button className="text-[10px] font-semibold px-3 py-2 rounded-xl" style={{ background: th.lightBg, color: OLIVE }}
                    onClick={() => void patchStatus(s.id, s.status || 'published', { reports: [] }).then(() => toast('Жалобы сняты'))}>Снять</button>
                </div>
              </div>
            ))}
            {!reported.length && <p className="text-xs" style={{ color: SAGE }}>Нет жалоб</p>}
          </>
        )}

        {tab === 'users' && (
          <UsersTab profiles={profiles} q={q} setQ={setQ} th={th} isAdmin={isAdmin} toast={toast} confirm={confirm}
            saveProfile={saveProfile} />
        )}

        {tab === 'tickets' && (
          <>
            {tickets.map((t) => (
              <div key={t.msg.id} className="rounded-2xl p-3 mb-2" style={{ background: th.cardBg }}>
                <p className="text-xs font-bold" style={{ color: th.inkText }}>№{t.msg.ticketNumber || '—'} · {t.box}</p>
                <p className="text-[10px] mb-2" style={{ color: OLIVE }}>{t.msg.text}</p>
                <button className="text-[10px] font-semibold text-white px-3 py-2 rounded-xl" style={{ background: ACCENT }}
                  onClick={() => push({ type: 'conversation', name: t.box, avatar: '🛟', peer: t.box })}>Ответить как поддержка</button>
              </div>
            ))}
            {!tickets.length && <p className="text-xs" style={{ color: SAGE }}>Нет обращений</p>}
            <button className="mt-3 text-[10px] font-semibold" style={{ color: SAGE }}
              onClick={() => push({ type: 'conversation', name: SUPPORT_NAME, avatar: '🛟', peer: SUPPORT_LOGIN })}>Чат поддержки</button>
          </>
        )}

        <div className="mt-4 rounded-2xl p-3 flex items-center gap-2" style={{ background: th.cardBg }}>
          <Shield size={14} color={OLIVE} />
          <p className="text-[10px]" style={{ color: OLIVE }}>Консоль CLI не переносится. Операции — кнопками. 2FA staff обязательна. Удаление аккаунта только admin.</p>
        </div>
      </div>
    </div>
  );
}

function SoundModRow({ s, th, chips, onOpen, onApprove, onReject, onDelete }: {
  s: Sound; th: { cardBg: string; inkText: string; lightBg: string };
  chips: Array<{ id: string; text: string }>;
  onOpen: () => void; onApprove: () => void; onReject: (note: string) => void; onDelete: () => void;
}) {
  return (
    <div className="rounded-2xl p-3 mb-2" style={{ background: th.cardBg }}>
      <button className="text-left w-full" onClick={onOpen}>
        <p className="text-xs font-bold" style={{ color: th.inkText }}>{s.title}</p>
        <p className="text-[10px] mb-2" style={{ color: OLIVE }}>{s.user} · {s.status} · {s.ucsCatId || s.ucsCat || s.type}</p>
      </button>
      <div className="flex flex-wrap gap-1.5">
        <button className="text-[10px] font-semibold text-white px-3 py-2 rounded-xl" style={{ background: ACCENT }} onClick={onApprove}>Одобрить</button>
        {chips.slice(0, 4).map((c) => (
          <button key={c.id} className="text-[10px] font-semibold px-3 py-2 rounded-xl" style={{ background: th.lightBg, color: OLIVE }}
            onClick={() => onReject(c.text)}>{c.id}</button>
        ))}
        <button className="text-[10px] font-semibold px-3 py-2 rounded-xl" style={{ background: th.lightBg, color: ACCENT }} onClick={onDelete}>Удалить</button>
      </div>
    </div>
  );
}

function UsersTab({ profiles, q, setQ, th, isAdmin, toast, confirm, saveProfile }: {
  profiles: Profile[];
  q: string;
  setQ: (v: string) => void;
  th: { cardBg: string; inkText: string; lightBg: string };
  isAdmin: boolean;
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
            <p className="text-[10px] mb-2" style={{ color: OLIVE }}>@{login} · {p.role || 'user'}{p.blocked ? ' · blocked' : ''}</p>
            <div className="flex flex-wrap gap-1.5">
              <button className="text-[10px] px-2 py-1.5 rounded-xl" style={{ background: th.lightBg, color: OLIVE }} onClick={() => void saveProfile({ ...p, blocked: !p.blocked }).then(() => toast(p.blocked ? 'Разблокирован' : 'Заблокирован'))}>
                {p.blocked ? 'Разблок.' : 'Блок'}
              </button>
              {isAdmin && (
                <>
                  <button className="text-[10px] px-2 py-1.5 rounded-xl" style={{ background: th.lightBg, color: OLIVE }} onClick={() => {
                    const role = p.role === 'moderator' ? 'user' : 'moderator';
                    void saveProfile({ ...p, role }).then(() => toast(`Роль: ${role}`));
                  }}>Роль</button>
                  <button className="text-[10px] px-2 py-1.5 rounded-xl" style={{ background: th.lightBg, color: OLIVE }} onClick={() => {
                    setEmailLogin(login);
                  }}>Письмо</button>
                  <button className="text-[10px] px-2 py-1.5 rounded-xl" style={{ background: th.lightBg, color: ACCENT }} onClick={() => void (async () => {
                    const ok = await confirm({ title: `Снять email ${login}?`, body: 'Только admin.', ok: 'Снять' });
                    if (!ok) return;
                    try { await apiAdminUnbindEmail(login); toast('Email снят'); }
                    catch (e: unknown) { toast((e as Error).message); }
                  })()}>Unbind email</button>
                  <button className="text-[10px] px-2 py-1.5 rounded-xl" style={{ background: th.lightBg, color: ACCENT }} onClick={() => void (async () => {
                    const ok = await confirm({ title: `Удалить ${login}?`, body: 'Необратимо.', ok: 'Удалить' });
                    if (!ok) return;
                    try { await apiAdminDeleteUser(login); toast('Удалён'); }
                    catch (e: unknown) { toast((e as Error).message); }
                  })()}>Удалить</button>
                </>
              )}
            </div>
          </div>
        );
      })}
      {isAdmin && (
        <div className="mt-3 rounded-2xl p-3" style={{ background: th.cardBg }}>
          <p className="text-xs font-bold mb-2" style={{ color: th.inkText }}>Письмо на email</p>
          <input value={emailLogin} onChange={(e) => setEmailLogin(e.target.value)} placeholder="Логин" className="w-full rounded-xl px-3 py-2 text-xs outline-none mb-2" style={{ background: th.lightBg, color: th.inkText }} />
          <textarea value={emailBody} onChange={(e) => setEmailBody(e.target.value)} className="w-full rounded-xl px-3 py-2 text-xs outline-none min-h-[64px]" style={{ background: th.lightBg, color: th.inkText }} />
          <button className="mt-2 w-full py-2.5 rounded-2xl text-xs font-semibold text-white" style={{ background: DARK }} onClick={async () => {
            try { await apiAdminSendEmail(emailLogin.trim(), emailBody.trim()); toast('Письмо отправлено'); setEmailBody(''); }
            catch (e: unknown) { toast((e as Error).message || 'Не удалось'); }
          }}>Отправить</button>
        </div>
      )}
    </>
  );
}
