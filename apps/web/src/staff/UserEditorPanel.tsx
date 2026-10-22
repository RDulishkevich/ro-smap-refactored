import { useEffect, useState } from 'react';
import {
  apiAdminDeleteUser, apiAdminSendEmail, apiAdminUnbindEmail, apiSyncJson,
  roleAtLeast, type Profile, type Sound, type StaffRole,
} from '@polevka/core';
import { color } from '@polevka/design';
import { MessageCircle, X } from 'lucide-react';
import { useAuth } from '../state/AuthContext';
import { useData } from '../state/DataContext';
import { useNav } from '../state/NavContext';
import { useTh } from '../state/ThemeContext';
import { useUi } from '../state/UiContext';
import { Avatar } from '../primitives/Avatar';

const ACCENT = color.accent;

const ROLES: StaffRole[] = ['user', 'moderator', 'admin', 'owner'];

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
  const { push } = useNav();
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

  useEffect(() => {
    setDisplayName(String(profile.displayName || ''));
    setBio(String(profile.bio || ''));
    setAvatar(String(profile.avatar || ''));
    setGear(String(profile.gear || ''));
    setLinks(String(profile.links || ''));
    setAboutRole(String(profile.aboutRole || ''));
    setRole((profile.role as StaffRole) || 'user');
    setBlocked(!!profile.blocked);
  }, [profile]);

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

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-2">
          {[
            ['Звуки', theirSounds.length],
            ['Роль', role],
            ['Статус', blocked ? 'блок' : 'ок'],
          ].map(([lab, val]) => (
            <div key={String(lab)} className="rounded-2xl p-2.5" style={{ background: th.phoneBg }}>
              <p className="pv-micro" style={{ color: th.soft }}>{lab}</p>
              <p className="pv-caption truncate" style={{ color: th.inkText }}>{val}</p>
            </div>
          ))}
        </div>

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
              {ROLES.filter((r) => {
                if (r === 'owner' || r === 'admin') return canOwner;
                return true;
              }).map((r) => (
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
            <p className="pv-micro mb-2" style={{ color: th.soft }}>Записи пользователя</p>
            <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
              {theirSounds.slice(0, 12).map((s: Sound) => (
                <button key={String(s.id)} type="button"
                  className="text-left rounded-xl px-3 py-2 pv-caption"
                  style={{ background: th.phoneBg, color: th.inkText }}
                  onClick={() => push({ type: 'sound-detail', sound: s })}>
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
            onClick={() => push({
              type: 'conversation',
              name: displayName || login,
              avatar: avatar || String(profile.avatar || ''),
              peer: login,
            })}>
            <MessageCircle size={14} /> Написать
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
      </div>

      {canAdmin && (
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
