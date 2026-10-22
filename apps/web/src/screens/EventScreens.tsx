import { useMemo, useState } from 'react';
import { Calendar, MapPin, Users } from 'lucide-react';
import { apiSyncJson, spamGuardCheck, spamGuardMessage, type AppEvent, type EventParticipant } from '@polevka/core';
import { color } from '@polevka/design';
import { useAuth } from '../state/AuthContext';
import { useData } from '../state/DataContext';
import { useNav } from '../state/NavContext';
import { useTh } from '../state/ThemeContext';
import { useUi } from '../state/UiContext';
import { useT } from '../state/PrefsContext';
import { useLeaveGuard } from '../lib/use-leave-guard';
import { EmptyNote } from '../primitives/EmptyNote';
import { ListSkeleton, ScreenHeader } from '../primitives/ui';
import { pathForEvent } from '../lib/routes';

const ACCENT = color.accent;

function normalizeParticipants(raw: AppEvent['participants'] | AppEvent['attendees']): EventParticipant[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: EventParticipant[] = [];
  for (const row of raw) {
    if (typeof row === 'string') {
      const login = row.toLowerCase().trim();
      if (!login || seen.has(login)) continue;
      seen.add(login);
      out.push({ login, name: row });
      continue;
    }
    const login = String(row?.login || '').toLowerCase().trim();
    if (!login || seen.has(login)) continue;
    seen.add(login);
    out.push({ login, name: String(row?.name || login) });
  }
  return out;
}

function eventPlace(ev: AppEvent) {
  return String(ev.loc || ev.location || '').trim();
}

function eventWhen(ev: AppEvent) {
  return [String(ev.date || '').trim(), String(ev.time || '').trim()].filter(Boolean).join(' · ');
}

export function EventsScreen({ onBack, focusId }: { onBack: () => void; focusId?: string }) {
  const { events, reload, loading, patchEventsLocal } = useData();
  const th = useTh();
  const { isLoggedIn, user } = useAuth();
  const { toast } = useUi();
  const { push } = useNav();
  const t = useT();
  const canCreate = !!isLoggedIn && !!user;
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [loc, setLoc] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [tag, setTag] = useState('встреча');
  const [desc, setDesc] = useState('');
  const [busy, setBusy] = useState(false);
  useLeaveGuard(creating && !!(title.trim() || loc.trim() || date.trim() || time.trim() || desc.trim()));

  const sorted = useMemo(() => {
    return [...events].sort((a, b) => {
      const ta = Date.parse(String(a.date || a.createdAt || '')) || 0;
      const tb = Date.parse(String(b.date || b.createdAt || '')) || 0;
      return tb - ta;
    });
  }, [events]);

  const createEvent = async () => {
    if (!canCreate || !user) { push({ type: 'auth' }); return; }
    if (!title.trim()) { toast('Укажите название'); return; }
    setBusy(true);
    const id = `ev${Date.now().toString(36)}`;
    const next: AppEvent = {
      id,
      title: title.trim(),
      loc: loc.trim(),
      location: loc.trim(),
      date: date.trim(),
      time: time.trim(),
      tag: tag.trim() || 'встреча',
      desc: desc.trim(),
      text: desc.trim(),
      status: 'open',
      n: 0,
      participants: [],
      attendees: [],
      ownerLogin: user.loginName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    patchEventsLocal((prev) => [next, ...prev]);
    try {
      await apiSyncJson('events.json', [next]);
      toast('Ивент создан');
      setCreating(false);
      setTitle('');
      setLoc('');
      setDate('');
      setTime('');
      setTag('встреча');
      setDesc('');
      push({ type: 'event-detail', eventId: id });
    } catch (e: unknown) {
      await reload();
      toast((e as Error).message || 'Не удалось создать');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col h-full" style={{ background: th.phoneBg }}>
      <ScreenHeader title={t('events')} onBack={onBack} right={(
        <button type="button" className="pv-button px-3 h-10 rounded-2xl text-white cursor-pointer" style={{ background: ACCENT }}
          onClick={() => {
            if (!canCreate) { push({ type: 'auth' }); return; }
            setCreating((v) => !v);
          }}>{creating ? 'Скрыть' : 'Создать'}</button>
      )} />
      <div className="flex-1 overflow-y-auto scrollbar-none p-4 flex flex-col gap-3">
        {creating && canCreate && (
          <div className="rounded-3xl p-4 flex flex-col gap-2 shadow-sm" style={{ background: th.cardBg }}>
            <p className="pv-subtitle" style={{ color: th.inkText }}>Новый ивент</p>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Название"
              className="rounded-2xl px-3 py-2.5 text-sm outline-none" style={{ background: th.lightBg, color: th.inkText }} />
            <input value={loc} onChange={(e) => setLoc(e.target.value)} placeholder="Место"
              className="rounded-2xl px-3 py-2.5 text-sm outline-none" style={{ background: th.lightBg, color: th.inkText }} />
            <div className="flex gap-2">
              <input value={date} onChange={(e) => setDate(e.target.value)} placeholder="Дата" type="date"
                className="flex-1 rounded-2xl px-3 py-2.5 text-sm outline-none" style={{ background: th.lightBg, color: th.inkText }} />
              <input value={time} onChange={(e) => setTime(e.target.value)} placeholder="Время" type="time"
                className="w-28 rounded-2xl px-3 py-2.5 text-sm outline-none" style={{ background: th.lightBg, color: th.inkText }} />
            </div>
            <input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="Тег"
              className="rounded-2xl px-3 py-2.5 text-sm outline-none" style={{ background: th.lightBg, color: th.inkText }} />
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Краткое описание"
              rows={3} maxLength={4000}
              className="rounded-2xl px-3 py-2.5 text-sm outline-none resize-none"
              style={{ background: th.lightBg, color: th.inkText }} />
            <button type="button" disabled={busy} onClick={() => void createEvent()}
              className="pv-button w-full py-2.5 rounded-2xl text-white cursor-pointer" style={{ background: ACCENT, opacity: busy ? 0.7 : 1 }}>
              {busy ? '…' : 'Опубликовать'}
            </button>
          </div>
        )}
        {loading && !events.length && <ListSkeleton rows={3} />}
        {!loading && !events.length && (
          <EmptyNote title={t('eventsEmpty')} hint={canCreate ? 'Создайте первый ивент кнопкой выше.' : t('eventsEmptyHint')} />
        )}
        {sorted.map((ev, i) => {
          const id = String(ev.id || `e${i}`);
          const parts = normalizeParticipants(ev.participants || ev.attendees);
          const focused = focusId && id === focusId;
          return (
            <button
              key={id}
              type="button"
              onClick={() => push({ type: 'event-detail', eventId: id })}
              className="rounded-3xl p-4 text-left shadow-sm cursor-pointer w-full"
              style={{
                background: th.cardBg,
                outline: focused ? `2px solid ${ACCENT}` : undefined,
              }}>
              <p className="pv-micro uppercase" style={{ color: th.soft }}>{String(ev.tag || ev.status || t('kindEvent'))}</p>
              <p className="pv-heading mt-1" style={{ color: th.inkText }}>{ev.title}</p>
              <p className="pv-caption mt-1.5" style={{ color: th.muted }}>
                {[eventPlace(ev), eventWhen(ev)].filter(Boolean).join(' · ') || 'Дата уточняется'}
              </p>
              <div className="flex items-center gap-1.5 mt-3" style={{ color: th.soft }}>
                <Users size={12} />
                <span className="pv-micro">{parts.length || Number(ev.n) || 0} участников</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function EventDetailScreen({ eventId, onBack }: { eventId: string; onBack: () => void }) {
  const { events, reload, patchEventsLocal } = useData();
  const th = useTh();
  const { isLoggedIn, user } = useAuth();
  const { toast } = useUi();
  const { push } = useNav();
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  const live = events.find((e) => String(e.id) === String(eventId));
  const participants = normalizeParticipants(live?.participants || live?.attendees);
  const mine = !!user && participants.some((p) => p.login === user.loginName.toLowerCase());
  const isOwner = !!user && String(live?.ownerLogin || '').toLowerCase() === user.loginName.toLowerCase();

  const [title, setTitle] = useState('');
  const [loc, setLoc] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [tag, setTag] = useState('');
  const [desc, setDesc] = useState('');

  const startEdit = () => {
    if (!live) return;
    setTitle(String(live.title || ''));
    setLoc(eventPlace(live));
    setDate(String(live.date || ''));
    setTime(String(live.time || ''));
    setTag(String(live.tag || 'встреча'));
    setDesc(String(live.desc || live.text || ''));
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!live || !user) return;
    setBusy(true);
    const patched: AppEvent = {
      ...live,
      title: title.trim() || live.title,
      loc: loc.trim(),
      location: loc.trim(),
      date: date.trim(),
      time: time.trim(),
      tag: tag.trim() || 'встреча',
      desc: desc.trim(),
      text: desc.trim(),
      participants,
      attendees: participants.map((p) => p.login),
      n: participants.length,
      ownerLogin: user.loginName,
      updatedAt: new Date().toISOString(),
    };
    patchEventsLocal((prev) => prev.map((row) => (String(row.id) === String(live.id) ? patched : row)));
    try {
      await apiSyncJson('events.json', [patched]);
      toast('Сохранено');
      setEditing(false);
    } catch (e: unknown) {
      await reload();
      toast((e as Error).message || 'Не удалось сохранить');
    } finally {
      setBusy(false);
    }
  };

  const toggleSignup = async () => {
    if (!live) return;
    if (!isLoggedIn || !user) { push({ type: 'auth' }); return; }
    const guard = spamGuardCheck('comment');
    if (!guard.ok) { toast(spamGuardMessage(guard)); return; }
    const nextParts = mine
      ? participants.filter((p) => p.login !== user.loginName.toLowerCase())
      : [...participants, { login: user.loginName.toLowerCase(), name: user.displayName || user.username || user.loginName }];
    const patched: AppEvent = {
      ...live,
      participants: nextParts,
      attendees: nextParts.map((p) => p.login),
      n: nextParts.length,
      updatedAt: new Date().toISOString(),
    };
    patchEventsLocal((prev) => prev.map((row) => (String(row.id) === String(live.id) ? patched : row)));
    try {
      await apiSyncJson('events.json', [patched]);
      toast(mine ? 'Запись отменена' : 'Вы записались');
    } catch (e: unknown) {
      await reload();
      toast((e as Error).message || 'Не удалось');
    }
  };

  if (!live) {
    return (
      <div className="flex flex-col h-full" style={{ background: th.phoneBg }}>
        <ScreenHeader title={t('events')} onBack={onBack} />
        <div className="p-4">
          <EmptyNote title="Ивент не найден" hint="Возможно, он был удалён." actionLabel="К списку" onAction={onBack} />
        </div>
      </div>
    );
  }

  const place = eventPlace(live);
  const when = eventWhen(live);
  const body = String(live.desc || live.text || '').trim();

  return (
    <div className="flex flex-col h-full" style={{ background: th.phoneBg }}>
      <ScreenHeader
        title={String(live.title || t('kindEvent'))}
        onBack={onBack}
        right={isOwner ? (
          <button type="button" className="pv-caption cursor-pointer px-2" style={{ color: ACCENT }}
            onClick={() => (editing ? setEditing(false) : startEdit())}>
            {editing ? 'Отмена' : 'Изменить'}
          </button>
        ) : undefined}
      />
      <div className="flex-1 overflow-y-auto scrollbar-none p-4 flex flex-col gap-3">
        {editing ? (
          <div className="rounded-3xl p-4 flex flex-col gap-2 shadow-sm" style={{ background: th.cardBg }}>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Название"
              className="rounded-2xl px-3 py-2.5 text-sm outline-none" style={{ background: th.lightBg, color: th.inkText }} />
            <input value={loc} onChange={(e) => setLoc(e.target.value)} placeholder="Место"
              className="rounded-2xl px-3 py-2.5 text-sm outline-none" style={{ background: th.lightBg, color: th.inkText }} />
            <div className="flex gap-2">
              <input value={date} onChange={(e) => setDate(e.target.value)} type="date"
                className="flex-1 rounded-2xl px-3 py-2.5 text-sm outline-none" style={{ background: th.lightBg, color: th.inkText }} />
              <input value={time} onChange={(e) => setTime(e.target.value)} type="time"
                className="w-28 rounded-2xl px-3 py-2.5 text-sm outline-none" style={{ background: th.lightBg, color: th.inkText }} />
            </div>
            <input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="Тег"
              className="rounded-2xl px-3 py-2.5 text-sm outline-none" style={{ background: th.lightBg, color: th.inkText }} />
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Описание" rows={4}
              className="rounded-2xl px-3 py-2.5 text-sm outline-none resize-none" style={{ background: th.lightBg, color: th.inkText }} />
            <button type="button" disabled={busy} onClick={() => void saveEdit()}
              className="pv-button w-full py-2.5 rounded-2xl text-white cursor-pointer" style={{ background: ACCENT }}>
              {busy ? '…' : 'Сохранить'}
            </button>
          </div>
        ) : (
          <div className="rounded-3xl p-5 shadow-sm" style={{ background: th.cardBg }}>
            <p className="pv-micro uppercase" style={{ color: th.soft }}>{String(live.tag || live.status || t('kindEvent'))}</p>
            <p className="pv-heading mt-1.5" style={{ color: th.inkText }}>{live.title}</p>
            <div className="mt-4 flex flex-col gap-2.5">
              {place && (
                <p className="pv-caption inline-flex items-center gap-2" style={{ color: th.muted }}>
                  <MapPin size={14} color={th.soft} /> {place}
                </p>
              )}
              {when && (
                <p className="pv-caption inline-flex items-center gap-2" style={{ color: th.muted }}>
                  <Calendar size={14} color={th.soft} /> {when}
                </p>
              )}
              <p className="pv-caption inline-flex items-center gap-2" style={{ color: th.muted }}>
                <Users size={14} color={th.soft} /> {participants.length} участников
              </p>
            </div>
            {body ? (
              <p className="pv-body mt-4 leading-relaxed" style={{ color: th.muted }}>{body}</p>
            ) : null}
            <button type="button" onClick={() => void toggleSignup()}
              className="pv-button w-full mt-5 py-3 rounded-2xl text-white cursor-pointer"
              style={{ background: mine ? th.solid : ACCENT }}>
              {mine ? 'Отменить запись' : 'Записаться'}
            </button>
            <button type="button" className="pv-micro mt-3 w-full text-center cursor-pointer" style={{ color: th.soft }}
              onClick={() => {
                void navigator.clipboard?.writeText(`${location.origin}${pathForEvent(String(live.id))}`).then(
                  () => toast('Ссылка скопирована'),
                  () => toast('Не удалось скопировать'),
                );
              }}>
              Скопировать ссылку
            </button>
          </div>
        )}

        <div className="rounded-3xl p-4 shadow-sm" style={{ background: th.cardBg }}>
          <p className="pv-subtitle mb-3" style={{ color: th.inkText }}>Участники</p>
          {!participants.length && (
            <p className="pv-caption" style={{ color: th.soft }}>Пока никого нет — будьте первым.</p>
          )}
          <ul className="flex flex-col gap-2">
            {participants.map((p) => (
              <li key={p.login} className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-full flex items-center justify-center pv-subtitle flex-shrink-0"
                  style={{ background: th.lightBg, color: ACCENT }}>
                  {(p.name || p.login).slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="pv-subtitle truncate" style={{ color: th.inkText }}>{p.name || p.login}</p>
                  <p className="pv-micro truncate" style={{ color: th.soft }}>@{p.login}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
