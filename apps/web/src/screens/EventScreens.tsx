import { useMemo, useState } from 'react';
import { Calendar, MapPin, MoreHorizontal, Users } from 'lucide-react';
import { apiSyncJson, newEventId, roleAtLeast, spamGuardCheck, spamGuardMessage, type AppEvent, type EventParticipant } from '@polevka/core';
import { color } from '@polevka/design';
import { useAuth } from '../state/AuthContext';
import { useData } from '../state/DataContext';
import { useNav } from '../state/NavContext';
import { useTh } from '../state/ThemeContext';
import { useUi } from '../state/UiContext';
import { useT } from '../state/PrefsContext';
import { useLeaveGuard } from '../lib/use-leave-guard';
import { EmptyNote } from '../primitives/EmptyNote';
import { FormField } from '../primitives/form';
import { ListSkeleton, ScreenHeader } from '../primitives/ui';
import { HoverMenu } from '../primitives/HoverMenu';
import { pathForEvent } from '../lib/routes';
import { persistEventDelete } from '../lib/owned-delete';
import { stock } from '../lib/stock';

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
  return [String(ev.date || '').trim(), String(ev.time || '').trim()].filter(Boolean).join(', ');
}

const MONTHS_RU = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

function agendaDate(ev: AppEvent) {
  const raw = String(ev.date || '').trim();
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    return { day: String(Number(iso[3])), month: MONTHS_RU[Number(iso[2]) - 1] || '', soon: false };
  }
  const parsed = Date.parse(raw);
  if (!Number.isNaN(parsed)) {
    const d = new Date(parsed);
    return { day: String(d.getDate()), month: MONTHS_RU[d.getMonth()], soon: false };
  }
  return { day: '', month: '', soon: true };
}

export function EventsScreen({ onBack, focusId }: { onBack: () => void; focusId?: string }) {
  const { events, loading } = useData();
  const th = useTh();
  const { isLoggedIn, user } = useAuth();
  const { toast } = useUi();
  const { push } = useNav();
  const t = useT();
  const canCreate = !!isLoggedIn && !!user;

  const sorted = useMemo(() => {
    return [...events].filter((ev) => !ev.deleted).sort((a, b) => {
      const ta = Date.parse(String(a.date || a.createdAt || '')) || 0;
      const tb = Date.parse(String(b.date || b.createdAt || '')) || 0;
      return tb - ta;
    });
  }, [events]);

  const openCreate = () => {
    if (!canCreate) {
      toast('Войдите, чтобы создать ивент');
      push({ type: 'auth' });
      return;
    }
    push({ type: 'event-edit' });
  };

  return (
    <div className="flex flex-col h-full" style={{ background: th.phoneBg }}>
      <ScreenHeader title={t('events')} onBack={onBack} right={(
        <button type="button" className="pv-button px-3 min-h-11 rounded-2xl text-white cursor-pointer" style={{ background: ACCENT }}
          onClick={openCreate}>Создать</button>
      )} />
      <div className="flex-1 overflow-y-auto scrollbar-none p-4 flex flex-col gap-2">
        {loading && !events.length && <ListSkeleton rows={3} />}
        {!loading && !events.length && (
          <EmptyNote
            title={t('eventsEmpty')}
            hint={canCreate ? 'Соберите людей на запись или прогулку.' : t('eventsEmptyHint')}
            image={stock.events}
            actionLabel={canCreate ? 'Создать ивент' : undefined}
            onAction={canCreate ? openCreate : undefined}
          />
        )}
        {sorted.map((ev, i) => {
          const id = String(ev.id || `e${i}`);
          const parts = normalizeParticipants(ev.participants || ev.attendees);
          const focused = focusId && id === focusId;
          const { day, month, soon } = agendaDate(ev);
          const place = eventPlace(ev);
          const time = String(ev.time || '').trim();
          return (
            <button
              key={id}
              type="button"
              onClick={() => push({ type: 'event-detail', eventId: id })}
              className="rounded-2xl px-3 py-3 text-left shadow-sm cursor-pointer w-full flex gap-3 items-stretch"
              style={{
                background: th.cardBg,
                boxShadow: focused ? `inset 0 0 0 2px ${ACCENT}` : undefined,
              }}>
              <div
                className="w-12 flex-shrink-0 rounded-xl flex flex-col items-center justify-center py-1.5"
                style={{ background: th.lightBg }}>
                {soon ? (
                  <>
                    <Calendar size={16} color={th.muted} strokeWidth={1.75} />
                    <span className="pv-micro mt-1" style={{ color: th.muted }}>скоро</span>
                  </>
                ) : (
                  <>
                    <span className="pv-heading tabular-nums leading-none" style={{ color: th.inkText }}>{day}</span>
                    {month ? <span className="pv-micro mt-1" style={{ color: th.muted }}>{month}</span> : null}
                  </>
                )}
              </div>
              <div className="min-w-0 flex-1 py-0.5">
                <p className="pv-heading truncate" style={{ color: th.inkText }}>{ev.title}</p>
                <p className="pv-caption mt-0.5 truncate" style={{ color: th.muted }}>
                  {[place, time].filter(Boolean).join(', ') || 'Место уточняется'}
                </p>
                <p className="pv-micro mt-1.5" style={{ color: th.muted }}>
                  {parts.length || Number(ev.n) || 0} участников
                </p>
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
  const { isLoggedIn, user, isStaffSession } = useAuth();
  const { toast, confirm } = useUi();
  const { push } = useNav();
  const t = useT();
  const [busy, setBusy] = useState(false);

  const live = events.find((e) => String(e.id) === String(eventId) && !e.deleted);
  const participants = normalizeParticipants(live?.participants || live?.attendees);
  const mine = !!user && participants.some((p) => p.login === user.loginName.toLowerCase());
  const isOwner = !!user && String(live?.ownerLogin || '').toLowerCase() === user.loginName.toLowerCase();
  const canAdminDelete = isStaffSession && roleAtLeast(user?.role, 'admin');
  const canManage = isOwner || canAdminDelete;

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

  const removeEvent = async () => {
    if (!live || !canManage) return;
    const ok = await confirm({
      title: 'Удалить ивент?',
      body: 'Он исчезнет из списка для всех участников.',
      ok: 'Удалить',
    });
    if (!ok) return;
    setBusy(true);
    patchEventsLocal((prev) => prev.filter((row) => String(row.id) !== String(live.id)));
    try {
      await persistEventDelete(live);
      toast('Ивент удалён');
      onBack();
    } catch (e: unknown) {
      await reload();
      toast((e as Error).message || 'Не удалось удалить');
    } finally {
      setBusy(false);
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
        right={canManage ? (
          <HoverMenu
            title={String(live.title || t('kindEvent'))}
            items={[
              ...(isOwner ? [{ label: 'Изменить', onClick: () => push({ type: 'event-edit', eventId: String(live.id) }) }] : []),
              { label: 'Удалить ивент', danger: true, onClick: () => void removeEvent() },
            ]}>
            <span className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: th.lightBg }}>
              <MoreHorizontal size={16} color={th.muted} />
            </span>
          </HoverMenu>
        ) : undefined}
      />
      <div className="flex-1 overflow-y-auto scrollbar-none p-4 flex flex-col gap-3">
          <div className="rounded-3xl p-5 shadow-sm" style={{ background: th.cardBg }}>
            <p className="pv-micro" style={{ color: th.muted }}>{String(live.tag || live.status || t('kindEvent'))}</p>
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

        <div className="rounded-3xl p-4 shadow-sm" style={{ background: th.cardBg }}>
          <p className="pv-subtitle mb-3" style={{ color: th.inkText }}>Участники</p>
          {!participants.length && (
            <p className="pv-caption" style={{ color: th.muted }}>Пока никого нет — будьте первым.</p>
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
                  <p className="pv-micro truncate" style={{ color: th.muted }}>@{p.login}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export function EventEditScreen({ eventId, onBack }: { eventId?: string; onBack: () => void }) {
  const { events, reload, patchEventsLocal } = useData();
  const th = useTh();
  const { isLoggedIn, user } = useAuth();
  const { toast } = useUi();
  const { push, replaceTop } = useNav();
  const t = useT();
  const live = eventId ? events.find((e) => String(e.id) === String(eventId) && !e.deleted) : undefined;
  const editing = !!live;

  const [title, setTitle] = useState(() => String(live?.title || ''));
  const [loc, setLoc] = useState(() => (live ? eventPlace(live) : ''));
  const [date, setDate] = useState(() => String(live?.date || ''));
  const [time, setTime] = useState(() => String(live?.time || ''));
  const [tag, setTag] = useState(() => String(live?.tag || 'встреча'));
  const [desc, setDesc] = useState(() => String(live?.desc || live?.text || ''));
  const [busy, setBusy] = useState(false);
  const baseline = {
    title: String(live?.title || ''),
    loc: live ? eventPlace(live) : '',
    date: String(live?.date || ''),
    time: String(live?.time || ''),
    tag: String(live?.tag || 'встреча'),
    desc: String(live?.desc || live?.text || ''),
  };
  const dirty = title !== baseline.title
    || loc !== baseline.loc
    || date !== baseline.date
    || time !== baseline.time
    || tag !== baseline.tag
    || desc !== baseline.desc;
  useLeaveGuard(dirty && !busy);

  const save = async () => {
    if (!isLoggedIn || !user) {
      toast('Войдите, чтобы создать ивент');
      push({ type: 'auth' });
      return;
    }
    if (!title.trim()) { toast('Укажите название'); return; }
    setBusy(true);
    if (editing && live) {
      const participants = normalizeParticipants(live.participants || live.attendees);
      const patched: AppEvent = {
        ...live,
        title: title.trim(),
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
        updatedAt: new Date().toISOString(),
      };
      patchEventsLocal((prev) => prev.map((row) => (String(row.id) === String(live.id) ? patched : row)));
      try {
        await apiSyncJson('events.json', [patched]);
        toast('Сохранено');
        replaceTop({ type: 'event-detail', eventId: String(live.id) });
      } catch (e: unknown) {
        await reload();
        toast((e as Error).message || 'Не удалось сохранить');
      } finally {
        setBusy(false);
      }
      return;
    }
    const id = newEventId();
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
      replaceTop({ type: 'event-detail', eventId: id });
    } catch (e: unknown) {
      await reload();
      toast((e as Error).message || 'Не удалось создать');
    } finally {
      setBusy(false);
    }
  };

  if (eventId && !live) {
    return (
      <div className="flex flex-col h-full" style={{ background: th.phoneBg }}>
        <ScreenHeader title={t('events')} onBack={onBack} />
        <div className="p-4">
          <EmptyNote title="Ивент не найден" hint="Возможно, он был удалён." actionLabel="К списку" onAction={onBack} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" style={{ background: th.phoneBg }}>
      <ScreenHeader title={editing ? 'Ивент' : 'Новый ивент'} onBack={onBack} />
      <div className="flex-1 overflow-y-auto scrollbar-none p-4 flex flex-col gap-3">
        <div className="rounded-3xl p-4 flex flex-col gap-3 shadow-sm" style={{ background: th.cardBg }}>
          <FormField label="Название" value={title} onChange={setTitle} placeholder="Вечерняя прогулка" inset />
          <FormField label="Место" value={loc} onChange={setLoc} placeholder="Парк, площадь, ориентир" inset />
          <div className="grid grid-cols-2 gap-2">
            <FormField label="Дата" value={date} onChange={setDate} type="date" inset />
            <FormField label="Время" value={time} onChange={setTime} type="time" inset />
          </div>
          <FormField label="Тег" value={tag} onChange={setTag} placeholder="встреча" inset />
          <FormField label="Описание" value={desc} onChange={setDesc} placeholder="Кратко, что будет" multiline rows={4} maxLength={4000} inset />
          <button type="button" disabled={busy} onClick={() => void save()}
            className="pv-button w-full py-3 min-h-11 rounded-2xl text-white cursor-pointer"
            style={{ background: ACCENT, opacity: busy ? 0.7 : 1 }}>
            {busy ? '…' : editing ? 'Сохранить' : 'Опубликовать'}
          </button>
        </div>
      </div>
    </div>
  );
}
