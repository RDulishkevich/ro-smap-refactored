import { useEffect, useState } from 'react';
import {
  apiAdminDeleteUser, apiAdminSendEmail, apiAdminUnbindEmail, apiStaffUserDossier, apiSyncJson,
  roleAtLeast, SUPPORT_LOGIN, type Profile, type Sound, type StaffRole,
} from '@polevka/core';
import { color } from '@polevka/design';
import { MessageCircle, X } from 'lucide-react';
import { useAuth } from '../state/AuthContext';
import { useData } from '../state/DataContext';
import { useTh } from '../state/ThemeContext';
import { useUi } from '../state/UiContext';
import { useStaff } from './StaffContext';
import { Avatar } from '../primitives/Avatar';

const ACCENT = color.accent;
const ROLES: StaffRole[] = ['user', 'moderator', 'admin', 'owner'];

type Dossier = {
  login?: string;
  role?: string;
  blocked?: boolean;
  totpEnabled?: boolean;
  oauth?: { yandex?: boolean; vk?: boolean; oauthOnly?: boolean };
  private?: {
    email?: string | null;
    emailMasked?: string | null;
    emailVerified?: boolean;
    pdConsent?: boolean;
    pdConsentAt?: string | null;
  };
  securityEvents?: Array<{ type?: string; at?: string; login?: string; [k: string]: unknown }>;
  activityLog?: Array<{ type?: string; at?: string; text?: string; [k: string]: unknown }>;
  sounds?: { authored?: Array<{ id: string | number; title?: string; status?: string; date?: string }>; liked?: Array<{ id: string | number; title?: string }>; authoredCount?: number; likedCount?: number; commentCount?: number };
  comments?: Array<{ soundTitle?: string; text?: string; date?: string; reply?: boolean }>;
  supportThread?: Array<{ fromId?: string; text?: string; date?: string }>;
};

const EVENT_LABEL: Record<string, string> = {
  login_ok: 'Вход',
  login_fail: 'Неудачный вход',
  login_locked: 'Блокировка входа',
  login_geo_stepup: 'Вход: код по стране',
  login_changed: 'Смена логина',
  password_changed: 'Смена пароля',
  password_set_oauth: 'Пароль после OAuth',
  staff_login_ok: 'Вход в staff',
  logout: 'Выход',
  logout_all: 'Выход везде',
  account_deleted: 'Аккаунт удалён',
  email_verified: 'Email подтверждён',
  totp_enabled: '2FA включена',
  totp_disabled: '2FA выключена',
};

function labelEvent(type?: string) {
  if (!type) return 'Событие';
  return EVENT_LABEL[type] || type;
}

export function UserEditorPanel({
  profile,
  onClose,
}: {
  profile: Profile;
  onClose: () => void;
}) {
  const th = useTh();
  const { user } = useAuth();
  const { allSounds, reload } = useData();
  const { openChat, openSound } = useStaff();
  const { toast, confirm } = useUi();
  const canAdmin = roleAtLeast(user?.role, 'admin');
  const canOwner = roleAtLeast(user?.role, 'owner');
  const login = String(profile.loginName || profile.login || '');

  const [displayName, setDisplayName] = useState(String(profile.displayName || ''));
  const [bio, setBio] = useState(String(profile.bio || ''));
  const [avatar, setAvatar] = useState(String(profile.avatar || ''));
  const [gear, setGear] = useState(String(profile.gear || ''));
  const [links, setLinks] = useState(String(profile.links || ''));
  const [aboutRole, setAboutRole] = useState(String(profile.aboutRole || ''));
  const [role, setRole] = useState<StaffRole>((profile.role as StaffRole) || 'user');
  const [blocked, setBlocked] = useState(!!profile.blocked);
  const [emailBody, setEmailBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [dossier, setDossier] = useState<Dossier | null>(null);
  const [dossierErr, setDossierErr] = useState('');
  const [tab, setTab] = useState<'edit' | 'activity'>('activity');

  useEffect(() => {
    setDisplayName(String(profile.displayName || ''));
    setBio(String(profile.bio || ''));
    setAvatar(String(profile.avatar || ''));
    setGear(String(profile.gear || ''));
    setLinks(String(profile.links || ''));
    setAboutRole(String(profile.aboutRole || ''));
    setRole((profile.role as StaffRole) || 'user');
    setBlocked(!!profile.blocked);
    setTab('activity');
  }, [profile]);

  useEffect(() => {
    let cancelled = false;
    setDossier(null);
    setDossierErr('');
    void apiStaffUserDossier(login)
      .then((data) => { if (!cancelled) setDossier(data as Dossier); })
      .catch((e: unknown) => { if (!cancelled) setDossierErr((e as Error).message || 'Не удалось загрузить'); });
    return () => { cancelled = true; };
  }, [login]);

  const theirSounds = allSounds.filter((s) => {
    if (s.deleted) return false;
    const u = String(s.recordistId || s.user || '').toLowerCase();
    return u === login.toLowerCase();
  });

  const save = async () => {
    if (!canAdmin) return;
    setBusy(true);
    try {
      let nextRole = role;
      if (!canOwner && (nextRole === 'admin' || nextRole === 'owner')) {
        nextRole = roleAtLeast(profile.role, 'admin') ? ((profile.role as StaffRole) || 'moderator') : 'moderator';
      }
      const next: Profile = {
        ...profile,
        loginName: login,
        displayName: displayName.trim() || login,
        bio: bio.trim(),
        avatar: avatar.trim(),
        gear: gear.trim(),
        links: links.trim(),
        aboutRole: aboutRole.trim(),
        role: nextRole,
        blocked,
        profileUpdatedAt: new Date().toISOString(),
      };
      await apiSyncJson('profiles.json', [next]);
      toast('Сохранено');
      await reload();
    } catch (e: unknown) {
      toast((e as Error).message || 'Не удалось сохранить');
    } finally {
      setBusy(false);
    }
  };

  const field = (label: string, el: React.ReactNode) => (
    <label className="flex flex-col gap-1">
      <span className="pv-micro" style={{ color: th.soft }}>{label}</span>
      {el}
    </label>
  );
  const inputCls = 'w-full rounded-2xl px-3 py-2.5 outline-none pv-caption';
  const inputStyle = { background: th.phoneBg, color: th.inkText, border: `1px solid ${th.border}` };

  const timeline: Array<{ at: string; title: string; detail?: string }> = [];
  for (const ev of dossier?.securityEvents || []) {
    timeline.push({
      at: String(ev.at || ''),
      title: labelEvent(String(ev.type || '')),
      detail: [ev.login, ev.country, ev.ip].filter(Boolean).map(String).join(' · ') || undefined,
    });
  }
  for (const a of dossier?.activityLog || []) {
    timeline.push({
      at: String(a.at || a.date || ''),
      title: String(a.type || a.action || 'Активность'),
      detail: String(a.text || a.message || ''),
    });
  }
  for (const s of dossier?.sounds?.authored || []) {
    timeline.push({
      at: String(s.date || ''),
      title: `Публикация · ${s.status || '—'}`,
      detail: s.title,
    });
  }
  for (const c of dossier?.comments || []) {
    timeline.push({
      at: String(c.date || ''),
      title: c.reply ? 'Ответ в комментарии' : 'Комментарий',
      detail: `${c.soundTitle || ''}: ${c.text || ''}`,
    });
  }
  for (const m of dossier?.supportThread || []) {
    timeline.push({
      at: String(m.date || ''),
      title: String(m.fromId) === SUPPORT_LOGIN ? 'Ответ поддержки' : 'Обращение в поддержку',
      detail: String(m.text || '').slice(0, 160),
    });
  }
  timeline.sort((a, b) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime());

  return (
    <div className="flex flex-col h-full min-h-0" style={{ background: th.cardBg }}>
      <div className="flex items-center gap-3 px-4 h-14 flex-shrink-0" style={{ borderBottom: `1px solid ${th.border}` }}>
        <Avatar src={avatar || profile.avatar} name={displayName || login} size={36} />
        <div className="flex-1 min-w-0">
          <p className="pv-subtitle truncate" style={{ color: th.inkText }}>{displayName || login}</p>
          <p className="pv-micro truncate" style={{ color: th.soft }}>@{login}</p>
        </div>
        <button type="button" className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: th.lightBg }}
          onClick={onClose} aria-label="Закрыть">
          <X size={16} color={th.muted} />
        </button>
      </div>

      <div className="flex gap-1.5 px-4 pt-3 flex-shrink-0">
        {([
          ['activity', 'Активность'],
          ['edit', 'Настройки'],
        ] as const).map(([id, lab]) => (
          <button key={id} type="button" onClick={() => setTab(id)}
            className="pv-caption px-3 py-1.5 rounded-xl"
            style={{ background: tab === id ? ACCENT : th.lightBg, color: tab === id ? '#fff' : th.muted }}>
            {lab}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            ['Звуки', dossier?.sounds?.authoredCount ?? theirSounds.length],
            ['Лайки', dossier?.sounds?.likedCount ?? '—'],
            ['Комменты', dossier?.sounds?.commentCount ?? '—'],
            ['2FA', dossier?.totpEnabled ? 'да' : 'нет'],
          ].map(([lab, val]) => (
            <div key={String(lab)} className="rounded-2xl p-2.5" style={{ background: th.phoneBg }}>
              <p className="pv-micro" style={{ color: th.soft }}>{lab}</p>
              <p className="pv-caption truncate" style={{ color: th.inkText }}>{val}</p>
            </div>
          ))}
        </div>

        {tab === 'activity' && (
          <>
            <div className="rounded-2xl p-3 flex flex-col gap-1" style={{ background: th.phoneBg }}>
              <p className="pv-micro" style={{ color: th.soft }}>Аккаунт</p>
              <p className="pv-caption" style={{ color: th.inkText }}>
                Роль {dossier?.role || role}
                {dossier?.blocked || blocked ? ' · blocked' : ''}
                {dossier?.oauth?.yandex ? ' · Яндекс' : ''}
                {dossier?.oauth?.vk ? ' · VK' : ''}
                {dossier?.oauth?.oauthOnly ? ' · oauth-only' : ''}
              </p>
              <p className="pv-caption" style={{ color: th.muted }}>
                Email: {dossier?.private?.email || dossier?.private?.emailMasked || '—'}
                {dossier?.private?.emailVerified ? ' ✓' : ''}
              </p>
              {dossier?.private?.pdConsentAt && (
                <p className="pv-micro" style={{ color: th.soft }}>ПДн: {dossier.private.pdConsentAt}</p>
              )}
            </div>

            {dossier?.sounds?.liked && dossier.sounds.liked.length > 0 && (
              <div>
                <p className="pv-micro mb-1.5" style={{ color: th.soft }}>Лайкнул</p>
                <div className="flex flex-col gap-1 max-h-28 overflow-y-auto">
                  {dossier.sounds.liked.slice(0, 20).map((s) => (
                    <p key={String(s.id)} className="pv-caption" style={{ color: th.muted }}>{s.title}</p>
                  ))}
                </div>
              </div>
            )}

            {dossierErr && <p className="pv-caption" style={{ color: ACCENT }}>{dossierErr}</p>}
            {!dossier && !dossierErr && <p className="pv-caption" style={{ color: th.soft }}>Загрузка истории…</p>}

            <div>
              <p className="pv-subtitle mb-2" style={{ color: th.inkText }}>Хроника</p>
              <div className="flex flex-col gap-2">
                {timeline.slice(0, 80).map((row, i) => (
                  <div key={`${row.at}-${i}`} className="rounded-2xl px-3 py-2" style={{ background: th.phoneBg }}>
                    <p className="pv-micro" style={{ color: th.soft }}>{row.at || '—'}</p>
                    <p className="pv-caption" style={{ color: th.inkText }}>{row.title}</p>
                    {row.detail && <p className="pv-micro mt-0.5 line-clamp-2" style={{ color: th.muted }}>{row.detail}</p>}
                  </div>
                ))}
                {dossier && !timeline.length && (
                  <p className="pv-caption" style={{ color: th.soft }}>Пока нет событий</p>
                )}
              </div>
            </div>
          </>
        )}

        {tab === 'edit' && (
          <>
            {field('Отображаемое имя', (
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={inputCls} style={inputStyle} disabled={!canAdmin} />
            ))}
            {field('Аватар (URL)', (
              <input value={avatar} onChange={(e) => setAvatar(e.target.value)} className={inputCls} style={inputStyle} disabled={!canAdmin} />
            ))}
            {field('О себе', (
              <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} className={`${inputCls} resize-none`} style={inputStyle} disabled={!canAdmin} />
            ))}
            {field('Роль в поле', (
              <input value={aboutRole} onChange={(e) => setAboutRole(e.target.value)} className={inputCls} style={inputStyle} disabled={!canAdmin} />
            ))}
            {field('Оборудование', (
              <input value={gear} onChange={(e) => setGear(e.target.value)} className={inputCls} style={inputStyle} disabled={!canAdmin} />
            ))}
            {field('Ссылки', (
              <input value={links} onChange={(e) => setLinks(e.target.value)} className={inputCls} style={inputStyle} disabled={!canAdmin} />
            ))}

            {canAdmin && (
              <div className="flex flex-col gap-2">
                <span className="pv-micro" style={{ color: th.soft }}>Роль доступа</span>
                <div className="flex flex-wrap gap-1.5">
                  {ROLES.filter((r) => (r === 'owner' || r === 'admin' ? canOwner : true)).map((r) => (
                    <button key={r} type="button" onClick={() => setRole(r)}
                      className="pv-caption px-3 py-1.5 rounded-xl"
                      style={{ background: role === r ? ACCENT : th.lightBg, color: role === r ? '#fff' : th.muted }}>
                      {r}
                    </button>
                  ))}
                </div>
                <label className="flex items-center gap-2 pv-caption mt-1" style={{ color: th.inkText }}>
                  <input type="checkbox" checked={blocked} onChange={(e) => setBlocked(e.target.checked)} />
                  Заблокирован
                </label>
              </div>
            )}

            {theirSounds.length > 0 && (
              <div>
                <p className="pv-micro mb-2" style={{ color: th.soft }}>Записи</p>
                <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
                  {theirSounds.slice(0, 12).map((s: Sound) => (
                    <button key={String(s.id)} type="button"
                      className="text-left rounded-xl px-3 py-2 pv-caption"
                      style={{ background: th.phoneBg, color: th.inkText }}
                      onClick={() => openSound(s)}>
                      {s.title} · {s.status || 'published'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {canAdmin && (
              <div className="rounded-2xl p-3 flex flex-col gap-2" style={{ background: th.phoneBg }}>
                <p className="pv-caption" style={{ color: th.inkText }}>Письмо на email</p>
                <textarea value={emailBody} onChange={(e) => setEmailBody(e.target.value)} rows={3}
                  className={`${inputCls} resize-none`} style={{ ...inputStyle, background: th.cardBg }}
                  placeholder="Текст письма" />
                <button type="button" className="pv-caption py-2.5 rounded-2xl text-white"
                  style={{ background: th.solid }}
                  onClick={() => void (async () => {
                    try {
                      await apiAdminSendEmail(login, emailBody.trim());
                      toast('Письмо отправлено');
                      setEmailBody('');
                    } catch (e: unknown) { toast((e as Error).message); }
                  })()}>
                  Отправить
                </button>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              <button type="button" className="pv-caption px-3 py-2 rounded-xl flex items-center gap-1.5"
                style={{ background: th.lightBg, color: th.inkText }}
                onClick={() => openChat(login, displayName || login, avatar || String(profile.avatar || ''))}>
                <MessageCircle size={14} /> Написать как Поддержка
              </button>
              {canAdmin && (
                <button type="button" className="pv-caption px-3 py-2 rounded-xl"
                  style={{ background: th.lightBg, color: ACCENT }}
                  onClick={() => void (async () => {
                    const ok = await confirm({ title: `Снять email @${login}?`, body: 'Адрес отвяжется от аккаунта.', ok: 'Снять' });
                    if (!ok) return;
                    try { await apiAdminUnbindEmail(login); toast('Email снят'); }
                    catch (e: unknown) { toast((e as Error).message); }
                  })()}>
                  Unbind email
                </button>
              )}
              {canOwner && (
                <button type="button" className="pv-caption px-3 py-2 rounded-xl"
                  style={{ background: th.lightBg, color: ACCENT }}
                  onClick={() => void (async () => {
                    const ok = await confirm({ title: `Удалить @${login}?`, body: 'Необратимо. Только владелец.', ok: 'Удалить' });
                    if (!ok) return;
                    try { await apiAdminDeleteUser(login); toast('Удалён'); onClose(); await reload(); }
                    catch (e: unknown) { toast((e as Error).message); }
                  })()}>
                  Удалить аккаунт
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {canAdmin && tab === 'edit' && (
        <div className="p-4 flex-shrink-0" style={{ borderTop: `1px solid ${th.border}` }}>
          <button type="button" disabled={busy} onClick={() => void save()}
            className="w-full min-h-11 rounded-2xl text-white pv-button"
            style={{ background: ACCENT, opacity: busy ? 0.7 : 1 }}>
            {busy ? '…' : 'Сохранить настройки'}
          </button>
        </div>
      )}
    </div>
  );
}
