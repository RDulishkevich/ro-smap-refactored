import { useMemo, useState, type ReactNode } from 'react';
import {
  apiAdminEmailConflicts, apiGetSecurityEvents, apiSyncJson,
  pendingSounds, rejectedSounds, roleAtLeast, supportDeskPeers,
  SUPPORT_LOGIN, SUPPORT_NAME, SUPPORT_AVATAR,
  type Sound,
} from '@polevka/core';
import { color, type ThemeTokens } from '@polevka/design';
import {
  AlertTriangle, BarChart3, Check, Inbox, Play, Search, Shield, Trash2, Users,
} from 'lucide-react';
import { getRejectSuggestionChips } from '../../../../src/data/publishRules.js';
import { EmptyNote } from '../primitives/EmptyNote';
import { useAuth } from '../state/AuthContext';
import { useData } from '../state/DataContext';
import { useTh } from '../state/ThemeContext';
import { useUi } from '../state/UiContext';
import { useStaff } from './StaffContext';
import { useStaffStats } from './useStaffStats';

const ACCENT = color.accent;

export type StaffModuleId =
  | 'overview'
  | 'queue'
  | 'reports'
  | 'inbox'
  | 'users'
  | 'analytics'
  | 'console';

export type StaffModuleMeta = {
  id: StaffModuleId;
  label: string;
  Icon: typeof Shield;
  minRole?: 'moderator' | 'admin' | 'owner';
};

export const STAFF_MODULES: StaffModuleMeta[] = [
  { id: 'overview', label: 'Обзор', Icon: Shield },
  { id: 'queue', label: 'Очередь', Icon: Play },
  { id: 'reports', label: 'Жалобы', Icon: AlertTriangle },
  { id: 'inbox', label: 'Сообщения', Icon: Inbox },
  { id: 'users', label: 'Люди', Icon: Users, minRole: 'admin' },
  { id: 'analytics', label: 'Аналитика', Icon: BarChart3 },
  { id: 'console', label: 'Консоль', Icon: Shield, minRole: 'owner' },
];

function StatCard({ lab, n, hint, onClick }: { lab: string; n: number | string; hint?: string; onClick?: () => void }) {
  const th = useTh();
  const inner = (
    <>
      <p className="pv-micro" style={{ color: th.soft }}>{lab}</p>
      <p className="pv-heading mt-1" style={{ color: th.inkText }}>{n}</p>
      {hint && <p className="pv-micro mt-1" style={{ color: th.muted }}>{hint}</p>}
    </>
  );
  const style = { background: th.cardBg, border: `1px solid ${th.border}` };
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="rounded-3xl p-4 text-left w-full" style={style}>
        {inner}
      </button>
    );
  }
  return <div className="rounded-3xl p-4 text-left w-full" style={style}>{inner}</div>;
}

function BarRow({ lab, n, pct, th }: { lab: string; n: number; pct: number; th: ThemeTokens }) {
  return (
    <div>
      <div className="flex justify-between pv-caption mb-1.5" style={{ color: th.muted }}>
        <span>{lab}</span>
        <span className="tabular-nums">{n} · {pct}%</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: th.lightBg }}>
        <div className="h-full rounded-full transition-[width]" style={{ width: `${Math.max(pct, pct ? 3 : 0)}%`, background: ACCENT }} />
      </div>
    </div>
  );
}

export function OverviewModule({ onGo }: { onGo: (id: StaffModuleId) => void }) {
  const th = useTh();
  const { allSounds, profiles, mail } = useData();
  const tickets = mail.flatMap((box) => (box.inbox || []).filter((m) => m._ticket || m.ticketNumber)).length;
  const stats = useStaffStats(allSounds, profiles, tickets);
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="pv-page" style={{ color: th.inkText }}>Обзор</p>
        <p className="pv-caption mt-1" style={{ color: th.muted }}>
          Очередь задач · нагрузка {stats.queueLoad}
        </p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5">
        <StatCard lab="На модерации" n={stats.pending} hint="открыть очередь" onClick={() => onGo('queue')} />
        <StatCard lab="Жалобы" n={stats.reported} hint={`${stats.reportHits} отметок`} onClick={() => onGo('reports')} />
        <StatCard lab="Тикеты" n={stats.tickets} onClick={() => onGo('inbox')} />
        <StatCard lab="Люди" n={stats.people} onClick={() => onGo('users')} />
        <StatCard lab="За неделю" n={stats.weekNew} hint="новые записи" />
        <StatCard lab="Опубликовано" n={stats.published} />
      </div>
      <div className="rounded-3xl p-4 flex flex-col gap-3" style={{ background: th.cardBg, border: `1px solid ${th.border}` }}>
        <p className="pv-subtitle" style={{ color: th.inkText }}>Статусы каталога</p>
        <BarRow lab="Опубликовано" n={stats.published} pct={stats.pctPublished} th={th} />
        <BarRow lab="Очередь" n={stats.pending} pct={stats.pctPending} th={th} />
        <BarRow lab="Отклонено" n={stats.rejected} pct={stats.pctRejected} th={th} />
      </div>
    </div>
  );
}

function SoundActionRow({
  s, selected, onSelect, onPlay, playing, chips, onApprove, onReject, onDelete, extra,
}: {
  s: Sound;
  selected: boolean;
  onSelect: () => void;
  onPlay: () => void;
  playing: boolean;
  chips: Array<{ id: string; text: string }>;
  onApprove: () => void;
  onReject: (note: string) => void;
  onDelete: () => void;
  extra?: ReactNode;
}) {
  const th = useTh();
  return (
    <div
      className="rounded-3xl p-4 flex flex-col gap-3"
      style={{
        background: th.cardBg,
        border: `1px solid ${selected ? ACCENT : th.border}`,
        boxShadow: selected ? `0 0 0 1px ${ACCENT}` : undefined,
      }}
    >
      <div className="flex gap-3 items-start">
        <button type="button" onClick={onPlay}
          className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: playing ? ACCENT : th.lightBg }}
          aria-label={playing ? 'Пауза' : 'Слушать'}>
          <Play size={16} color={playing ? '#fff' : th.muted} fill={playing ? '#fff' : 'transparent'} />
        </button>
        <button type="button" className="flex-1 min-w-0 text-left" onClick={onSelect}>
          <p className="pv-subtitle truncate" style={{ color: th.inkText }}>{s.title}</p>
          <p className="pv-micro mt-0.5 truncate" style={{ color: th.muted }}>
            {s.user || s.recordistId || '—'} · {s.status || 'published'} · {s.ucsCatId || s.ucsCat || s.type || '—'}
          </p>
        </button>
      </div>
      {extra}
      <div className="flex flex-wrap gap-1.5">
        <button type="button" className="pv-caption px-3 py-2 rounded-2xl text-white" style={{ background: ACCENT }} onClick={onApprove}>
          <span className="inline-flex items-center gap-1"><Check size={12} /> Одобрить</span>
        </button>
        {chips.slice(0, 4).map((c) => (
          <button key={c.id} type="button" className="pv-caption px-3 py-2 rounded-2xl"
            style={{ background: th.lightBg, color: th.muted }} onClick={() => onReject(c.text)}>
            {c.id}
          </button>
        ))}
        <button type="button" className="pv-caption px-3 py-2 rounded-2xl"
          style={{ background: th.lightBg, color: ACCENT }} onClick={onDelete}>
          <span className="inline-flex items-center gap-1"><Trash2 size={12} /> Удалить</span>
        </button>
      </div>
    </div>
  );
}

export function QueueModule({
  focusId,
  onFocus,
}: {
  focusId: string | null;
  onFocus: (s: Sound | null) => void;
}) {
  const th = useTh();
  const { allSounds, reload, togglePlay, playing, playingId } = useData();
  const { toast, confirm } = useUi();
  const { openSound } = useStaff();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'pending' | 'rejected' | 'published' | 'all'>('pending');
  const chips = getRejectSuggestionChips() as Array<{ id: string; text: string }>;

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

  const patchStatus = async (id: string | number, nextStatus: string, extra: Record<string, unknown> = {}) => {
    const cur = allSounds.find((x) => String(x.id) === String(id));
    if (!cur) return;
    await apiSyncJson('map_data.json', [{ ...cur, status: nextStatus, ...extra }]);
    await reload();
  };

  return (
    <div className="flex flex-col gap-3 h-full min-h-0">
      <div>
        <p className="pv-page" style={{ color: th.inkText }}>Очередь</p>
        <p className="pv-caption mt-1" style={{ color: th.muted }}>Слушайте и решайте прямо здесь</p>
      </div>
      <label className="flex items-center gap-2 h-11 rounded-2xl px-3.5" style={{ background: th.cardBg, border: `1px solid ${th.border}` }}>
        <Search size={16} color={th.soft} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по названию, автору, UCS"
          className="flex-1 min-w-0 bg-transparent outline-none pv-caption" style={{ color: th.inkText }} />
      </label>
      <div className="flex gap-1.5 flex-wrap">
        {([
          ['pending', 'На модерации'],
          ['rejected', 'Отклонено'],
          ['published', 'Опубликовано'],
          ['all', 'Все'],
        ] as const).map(([id, lab]) => (
          <button key={id} type="button" onClick={() => setStatus(id)}
            className="pv-caption px-3 py-1.5 rounded-full"
            style={{ background: status === id ? ACCENT : th.lightBg, color: status === id ? '#fff' : th.muted }}>
            {lab}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto flex flex-col gap-2.5 pb-2">
        {list.map((s) => {
          const id = String(s.id);
          const isPlaying = playing && String(playingId) === id;
          return (
            <SoundActionRow
              key={id}
              s={s}
              selected={focusId === id}
              onSelect={() => { onFocus(s); openSound(s); }}
              onPlay={() => { onFocus(s); togglePlay(s); }}
              playing={!!isPlaying}
              chips={chips}
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
                  if (focusId === id) onFocus(null);
                  await reload();
                } catch (e: unknown) { toast((e as Error).message); }
              })()}
            />
          );
        })}
        {!list.length && <EmptyNote title="Пусто" hint="В этой выборке нет записей" />}
      </div>
    </div>
  );
}

export function ReportsModule({ onFocus }: { onFocus: (s: Sound | null) => void }) {
  const th = useTh();
  const { allSounds, reload, togglePlay, playing, playingId } = useData();
  const { toast } = useUi();
  const { openSound } = useStaff();
  const reported = allSounds.filter((s) => !s.deleted && Array.isArray(s.reports) && s.reports.length > 0);

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="pv-page" style={{ color: th.inkText }}>Жалобы</p>
        <p className="pv-caption mt-1" style={{ color: th.muted }}>{reported.length} записей с жалобами</p>
      </div>
      {reported.map((s) => {
        const n = (s.reports as unknown[]).length;
        const id = String(s.id);
        const isPlaying = playing && String(playingId) === id;
        return (
          <div key={id} className="rounded-3xl p-4 flex flex-col gap-3" style={{ background: th.cardBg, border: `1px solid ${th.border}` }}>
            <div className="flex gap-3">
              <button type="button" onClick={() => { onFocus(s); togglePlay(s); }}
                className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: isPlaying ? ACCENT : th.lightBg }}>
                <Play size={16} color={isPlaying ? '#fff' : th.muted} fill={isPlaying ? '#fff' : 'transparent'} />
              </button>
              <div className="flex-1 min-w-0">
                <p className="pv-subtitle truncate" style={{ color: th.inkText }}>{s.title}</p>
                <p className="pv-micro" style={{ color: th.muted }}>жалоб: {n}</p>
              </div>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              <button type="button" className="pv-caption px-3 py-2 rounded-2xl text-white" style={{ background: ACCENT }}
                onClick={() => { onFocus(s); openSound(s); }}>
                К записи
              </button>
              <button type="button" className="pv-caption px-3 py-2 rounded-2xl" style={{ background: th.lightBg, color: th.muted }}
                onClick={() => void (async () => {
                  await apiSyncJson('map_data.json', [{ ...s, reports: [] }]);
                  toast('Жалобы сняты');
                  await reload();
                })()}>
                Снять жалобы
              </button>
            </div>
          </div>
        );
      })}
      {!reported.length && <EmptyNote title="Жалоб нет" hint="Проблемные места появятся здесь" />}
    </div>
  );
}

export function InboxModule() {
  const th = useTh();
  const { mail, profiles } = useData();
  const { panel, openChat } = useStaff();
  const [q, setQ] = useState('');
  const desk = supportDeskPeers(mail, profiles);
  const filtered = desk.filter((p) => {
    if (!q.trim()) return true;
    const n = q.trim().toLowerCase();
    return p.name.toLowerCase().includes(n) || p.login.toLowerCase().includes(n) || (p.lastText || '').toLowerCase().includes(n);
  });
  const tickets = (mail.find((b) => b.loginName === SUPPORT_LOGIN)?.inbox || [])
    .filter((m) => m._ticket || m.ticketNumber)
    .map((m) => ({ from: String(m.fromId || ''), msg: m }));
  const activePeer = panel?.type === 'chat' ? panel.peer : '';

  return (
    <div className="flex flex-col gap-3 h-full min-h-0">
      <div className="flex-shrink-0">
        <p className="pv-page" style={{ color: th.inkText }}>Сообщения</p>
        <p className="pv-caption mt-1" style={{ color: th.muted }}>
          Чат справа · пишете как «{SUPPORT_NAME}»
        </p>
      </div>

      {tickets.length > 0 && (
        <div className="flex flex-col gap-2 flex-shrink-0 max-h-36 overflow-y-auto">
          <p className="pv-subtitle" style={{ color: th.inkText }}>Тикеты ({tickets.length})</p>
          {tickets.slice(0, 16).map((row) => (
            <button key={row.msg.id} type="button"
              className="rounded-2xl p-3 text-left"
              style={{ background: th.cardBg, border: `1px solid ${activePeer === row.from ? ACCENT : th.border}` }}
              onClick={() => openChat(row.from, row.from, SUPPORT_AVATAR)}>
              <p className="pv-caption" style={{ color: th.inkText }}>№{row.msg.ticketNumber || '—'} · @{row.from}</p>
              <p className="pv-micro mt-1 line-clamp-2" style={{ color: th.muted }}>{row.msg.text}</p>
            </button>
          ))}
        </div>
      )}

      <label className="flex items-center gap-2 h-11 rounded-2xl px-3.5 flex-shrink-0" style={{ background: th.cardBg, border: `1px solid ${th.border}` }}>
        <Search size={16} color={th.soft} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по обращениям"
          className="flex-1 min-w-0 bg-transparent outline-none pv-caption" style={{ color: th.inkText }} />
      </label>

      <div className="flex-1 overflow-y-auto flex flex-col gap-1.5 pb-2">
        {filtered.map((p) => (
          <button key={p.login} type="button"
            className="rounded-2xl px-3 py-3 text-left flex gap-3 items-center"
            style={{ background: th.cardBg, border: `1px solid ${activePeer === p.login ? ACCENT : th.border}` }}
            onClick={() => openChat(p.login, p.name, p.avatar || SUPPORT_AVATAR)}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="pv-subtitle truncate" style={{ color: th.inkText }}>{p.name}</p>
                {p.unread > 0 && (
                  <span className="pv-micro px-1.5 py-0.5 rounded-full text-white" style={{ background: ACCENT }}>{p.unread}</span>
                )}
              </div>
              <p className="pv-micro truncate" style={{ color: th.muted }}>@{p.login} · {p.lastText || '—'}</p>
            </div>
          </button>
        ))}
        {!filtered.length && <EmptyNote title="Нет обращений" hint="Когда пользователи напишут в поддержку — чаты появятся здесь" />}
      </div>
    </div>
  );
}

export function UsersModule() {
  const th = useTh();
  const { profiles } = useData();
  const { user } = useAuth();
  const { panel, openUser } = useStaff();
  const canAdmin = roleAtLeast(user?.role, 'admin');
  const [q, setQ] = useState('');
  const activeLogin = panel?.type === 'user' ? String(panel.profile.loginName || '') : '';

  const found = profiles.filter((p) => {
    const hay = `${p.loginName} ${p.displayName} ${p.role}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  if (!canAdmin) {
    return <EmptyNote title="Нет доступа" hint="Раздел людей — для admin и owner" />;
  }

  return (
    <div className="flex flex-col gap-3 h-full min-h-0">
      <div>
        <p className="pv-page" style={{ color: th.inkText }}>Люди</p>
        <p className="pv-caption mt-1" style={{ color: th.muted }}>Карточка справа · переписка от Поддержки</p>
      </div>
      <label className="flex items-center gap-2 h-11 rounded-2xl px-3.5" style={{ background: th.cardBg, border: `1px solid ${th.border}` }}>
        <Search size={16} color={th.soft} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Логин или имя"
          className="flex-1 min-w-0 bg-transparent outline-none pv-caption" style={{ color: th.inkText }} />
      </label>
      <div className="flex-1 overflow-y-auto flex flex-col gap-1.5">
        {found.slice(0, 80).map((p) => {
          const login = String(p.loginName || '');
          const on = activeLogin === login;
          return (
            <button key={login} type="button" onClick={() => openUser(p)}
              className="rounded-2xl px-3 py-3 text-left"
              style={{ background: on ? th.lightBg : th.cardBg, border: `1px solid ${on ? ACCENT : th.border}` }}>
              <p className="pv-subtitle truncate" style={{ color: th.inkText }}>{p.displayName || login}</p>
              <p className="pv-micro" style={{ color: th.muted }}>
                @{login} · {p.role || 'user'}{p.blocked ? ' · blocked' : ''}
              </p>
            </button>
          );
        })}
        {!found.length && <EmptyNote title="Никого" hint="Измените запрос" />}
      </div>
    </div>
  );
}

export function AnalyticsModule() {
  const th = useTh();
  const { allSounds, profiles, mail } = useData();
  const { user } = useAuth();
  const canAdmin = roleAtLeast(user?.role, 'admin');
  const tickets = mail.flatMap((box) => (box.inbox || []).filter((m) => m._ticket || m.ticketNumber)).length;
  const stats = useStaffStats(allSounds, profiles, tickets);
  const metrikaId = String(import.meta.env.VITE_YANDEX_METRIKA_ID || '').trim();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="pv-page" style={{ color: th.inkText }}>Аналитика</p>
        <p className="pv-caption mt-1" style={{ color: th.muted }}>Каталог, очередь и аудитория</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <StatCard lab="Каталог" n={stats.totalPool} hint={`${stats.pctPublished}% live`} />
        <StatCard lab="Очередь задач" n={stats.queueLoad} hint="мод + жалобы + тикеты" />
        <StatCard lab="За 7 дней" n={stats.weekNew} hint="новые звуки" />
        <StatCard lab="Жалобы" n={`${stats.reported}/${stats.reportHits}`} hint="записи / отметки" />
      </div>

      <div className="rounded-3xl p-4 flex flex-col gap-3" style={{ background: th.cardBg, border: `1px solid ${th.border}` }}>
        <p className="pv-subtitle" style={{ color: th.inkText }}>Воронка модерации</p>
        <BarRow lab="Опубликовано" n={stats.published} pct={stats.pctPublished} th={th} />
        <BarRow lab="В очереди" n={stats.pending} pct={stats.pctPending} th={th} />
        <BarRow lab="Отклонено" n={stats.rejected} pct={stats.pctRejected} th={th} />
      </div>

      <div className="rounded-3xl p-4 flex flex-col gap-3" style={{ background: th.cardBg, border: `1px solid ${th.border}` }}>
        <p className="pv-subtitle" style={{ color: th.inkText }}>Аудитория</p>
        <div className="grid grid-cols-3 gap-2">
          <StatCard lab="Профили" n={stats.people} />
          <StatCard lab="Staff" n={stats.staff} />
          <StatCard lab="Блок" n={stats.blocked} />
        </div>
      </div>

      {stats.typeTop.length > 0 && (
        <div className="rounded-3xl p-4 flex flex-col gap-2" style={{ background: th.cardBg, border: `1px solid ${th.border}` }}>
          <p className="pv-subtitle" style={{ color: th.inkText }}>Топ типов (published)</p>
          {stats.typeTop.map(([type, n]) => (
            <div key={type} className="flex justify-between pv-caption" style={{ color: th.muted }}>
              <span className="truncate">{type}</span>
              <span className="tabular-nums">{n}</span>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-3xl p-4 flex flex-col gap-2" style={{ background: th.cardBg, border: `1px solid ${th.border}` }}>
        <p className="pv-subtitle" style={{ color: th.inkText }}>Яндекс.Метрика</p>
        {metrikaId ? (
          <>
            <p className="pv-caption" style={{ color: th.muted }}>Счётчик {metrikaId} подключён к staff.</p>
            <a className="pv-caption underline" style={{ color: ACCENT }}
              href={`https://metrika.yandex.ru/dashboard?id=${encodeURIComponent(metrikaId)}`}
              target="_blank" rel="noreferrer">
              Открыть кабинет Метрики
            </a>
          </>
        ) : (
          <p className="pv-caption leading-snug" style={{ color: th.muted }}>
            Задайте <code className="pv-micro">VITE_YANDEX_METRIKA_ID</code> при сборке — появится счётчик и ссылка на дашборд.
            Продуктовая сводка выше уже считается из каталога.
          </p>
        )}
        {!canAdmin && (
          <p className="pv-micro" style={{ color: th.soft }}>Модератору доступна урезанная сводка.</p>
        )}
      </div>
    </div>
  );
}

export function ConsoleModule({ scanEmailConflicts }: { scanEmailConflicts: () => Promise<void> }) {
  const th = useTh();
  const { toast } = useUi();
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
      <div>
        <p className="pv-page" style={{ color: th.inkText }}>Консоль</p>
        <p className="pv-caption mt-1" style={{ color: th.muted }}>Только владелец</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="pv-caption px-3 py-2 rounded-xl text-white" style={{ background: ACCENT }} onClick={() => void load()}>
          Security events
        </button>
        <button type="button" className="pv-caption px-3 py-2 rounded-xl" style={{ background: th.lightBg, color: th.inkText }}
          onClick={() => void scanEmailConflicts()}>
          Email conflicts
        </button>
      </div>
      {loaded && (
        <div className="rounded-3xl p-3 max-h-96 overflow-y-auto" style={{ background: th.cardBg, border: `1px solid ${th.border}` }}>
          {events.slice(0, 60).map((ev, i) => (
            <p key={`${ev.at}-${i}`} className="pv-micro mb-1.5" style={{ color: th.muted }}>
              {ev.at || '—'} · {ev.type || '?'} · {ev.login || ''}
            </p>
          ))}
          {!events.length && <p className="pv-caption" style={{ color: th.soft }}>Пусто</p>}
        </div>
      )}
    </div>
  );
}

export { apiAdminEmailConflicts };
