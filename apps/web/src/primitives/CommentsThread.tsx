import { useEffect, useState } from 'react';
import { Flag, Heart, Send } from 'lucide-react';
import { color } from '@polevka/design';
import {
  normalizeComment, spamGuardCheck, spamGuardMessage,
  type Comment,
} from '@polevka/core';
import { useAuth } from '../state/AuthContext';
import { useData } from '../state/DataContext';
import { useNav } from '../state/NavContext';
import { useTh } from '../state/ThemeContext';
import { useUi } from '../state/UiContext';
import { useT } from '../state/PrefsContext';
import { useStaffOptional } from '../staff/StaffContext';
import { Avatar } from './Avatar';
import { EmptyNote } from './EmptyNote';

const ACCENT = color.accent;

/** One-level threads: root comments + replies[] only (no reply-to-reply nesting). */
export function CommentsThread({
  comments,
  onSave,
}: {
  comments: Comment[];
  /** Persist to server; UI already shows `next` optimistically. */
  onSave: (next: Comment[]) => Promise<void>;
}) {
  const th = useTh();
  const t = useT();
  const { user, isLoggedIn } = useAuth();
  const { profiles } = useData();
  const { push } = useNav();
  const { toast } = useUi();
  const staff = useStaffOptional();
  const [local, setLocal] = useState(comments);
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { setLocal(comments); }, [comments]);

  const actorLogin = staff?.supportIdentity.login || user?.loginName || '';
  const actorName = staff?.supportIdentity.name || user?.username || user?.loginName || '';
  const actorAvatar = staff?.supportIdentity.avatar;

  const avatarFor = (authorId?: string | null, author?: string) => {
    const login = String(authorId || '').toLowerCase();
    if (staff && login === staff.supportIdentity.login) {
      return { src: staff.supportIdentity.avatar, name: staff.supportIdentity.name };
    }
    const p = login ? profiles.find((x) => String(x.loginName || '').toLowerCase() === login) : undefined;
    return { src: p?.avatar, name: String(p?.displayName || p?.username || author || '?') };
  };

  const openAuthor = (authorId?: string | null, author?: string) => {
    const login = String(authorId || '').toLowerCase();
    if (!login || (staff && login === staff.supportIdentity.login)) return;
    const p = profiles.find((x) => String(x.loginName || '').toLowerCase() === login);
    if (staff) {
      staff.openUser(p || { loginName: login, displayName: author || login });
      return;
    }
    push({
      type: 'user-profile',
      name: String(p?.displayName || author || login),
      avatar: String(p?.avatar || ''),
      username: `@${login}`,
    });
  };

  const commit = async (next: Comment[], rollback: Comment[]) => {
    setLocal(next);
    try {
      await onSave(next);
    } catch (e: unknown) {
      setLocal(rollback);
      toast((e as Error).message || 'Не удалось сохранить');
      throw e;
    }
  };

  const postRoot = async () => {
    const text = draft.trim();
    if (!text || !actorLogin || busy) return;
    if (!isLoggedIn && !staff) { push({ type: 'auth' }); return; }
    const guard = spamGuardCheck('comment');
    if (!guard.ok) { toast(spamGuardMessage(guard)); return; }
    const prev = local;
    const next = [
      ...local,
      normalizeComment({
        author: actorName,
        authorId: actorLogin,
        ...(actorAvatar ? { avatar: actorAvatar } : {}),
        text,
        date: new Date().toLocaleDateString('ru'),
      }),
    ];
    setDraft('');
    setBusy(true);
    try {
      await commit(next, prev);
      toast(staff ? 'Комментарий от Поддержки' : 'Комментарий отправлен');
    } catch { /* rolled back */ }
    finally { setBusy(false); }
  };

  const postReply = async (rootId: string) => {
    const text = replyText.trim();
    if (!text || !actorLogin || busy) return;
    if (!isLoggedIn && !staff) { push({ type: 'auth' }); return; }
    const guard = spamGuardCheck('comment');
    if (!guard.ok) { toast(spamGuardMessage(guard)); return; }
    const prev = local;
    const next = local.map((c) => {
      if (c.id !== rootId) return c;
      return {
        ...c,
        replies: [
          ...(c.replies || []),
          {
            id: `cr${Date.now()}`,
            author: actorName,
            authorId: actorLogin,
            text,
            date: new Date().toLocaleDateString('ru'),
          },
        ],
      };
    });
    setReplyText('');
    setReplyTo(null);
    setBusy(true);
    try {
      await commit(next, prev);
      toast(staff ? 'Ответ от Поддержки' : 'Ответ отправлен');
    } catch { /* rolled back */ }
    finally { setBusy(false); }
  };

  const toggleHeart = async (cm: Comment) => {
    if (!user && !staff) { push({ type: 'auth' }); return; }
    const login = actorLogin;
    const has = (cm.reactedBy || []).includes(login);
    const prev = local;
    const next = local.map((c) => {
      if (c.id !== cm.id) return c;
      const reactedBy = has
        ? (c.reactedBy || []).filter((x) => x !== login)
        : [...(c.reactedBy || []), login];
      return { ...c, reactedBy };
    });
    try { await commit(next, prev); } catch { /* rolled back */ }
  };

  const report = async (cm: Comment) => {
    if (!user) { push({ type: 'auth' }); return; }
    const prev = local;
    const next = local.map((c) => {
      if (c.id !== cm.id) return c;
      return {
        ...c,
        reports: [...(c.reports || []), { by: user.loginName, at: new Date().toISOString() }],
      };
    });
    try {
      await commit(next, prev);
      toast('Жалоба отправлена');
    } catch { /* rolled back */ }
  };

  return (
    <div>
      <p className="pv-label uppercase mb-3" style={{ color: th.soft }}>
        {t('comments')} · {local.length}
        {staff ? ' · Поддержка' : ''}
      </p>
      {!local.length && <EmptyNote title={t('noComments')} hint={t('noCommentsHint')} />}
      <div className="flex flex-col gap-4">
        {local.map((cm) => {
          const av = avatarFor(cm.authorId, cm.author);
          const liked = (cm.reactedBy || []).includes(actorLogin);
          const replies = cm.replies || [];
          return (
            <div key={cm.id} className="flex gap-3">
              <button type="button" onClick={() => openAuthor(cm.authorId, cm.author)} className="flex-shrink-0">
                <Avatar src={av.src} name={av.name} size={36} rounded="rounded-full" fallback="icon" />
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2 mb-0.5">
                  <button type="button" className="pv-subtitle truncate text-left" style={{ color: th.inkText }}
                    onClick={() => openAuthor(cm.authorId, cm.author)}>{cm.author}</button>
                  <p className="pv-micro flex-shrink-0" style={{ color: th.soft }}>{cm.date}</p>
                </div>
                <p className="pv-caption leading-relaxed" style={{ color: th.muted }}>{cm.text}</p>
                {replies.length > 0 && (
                  <div className="mt-2.5 pl-3 flex flex-col gap-2.5" style={{ borderLeft: `2px solid ${th.border}` }}>
                    {replies.map((r) => {
                      const rav = avatarFor(r.authorId, r.author);
                      return (
                        <div key={r.id} className="flex gap-2">
                          <button type="button" onClick={() => openAuthor(r.authorId, r.author)} className="flex-shrink-0">
                            <Avatar src={rav.src} name={rav.name} size={28} rounded="rounded-full" fallback="icon" />
                          </button>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-2">
                              <button type="button" className="pv-caption font-semibold truncate text-left" style={{ color: th.inkText }}
                                onClick={() => openAuthor(r.authorId, r.author)}>{r.author}</button>
                              <p className="pv-micro flex-shrink-0" style={{ color: th.soft }}>{r.date}</p>
                            </div>
                            <p className="pv-caption leading-relaxed" style={{ color: th.muted }}>{r.text}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {(isLoggedIn || !!staff) && (
                  <div className="flex items-center gap-3 mt-1.5">
                    <button type="button" className="pv-micro inline-flex items-center gap-1"
                      style={{ color: liked ? ACCENT : th.soft }}
                      onClick={() => void toggleHeart(cm)}>
                      <Heart size={12} fill={liked ? ACCENT : 'none'} />
                      {(cm.reactedBy || []).length || ''}
                    </button>
                    <button type="button" className="pv-micro" style={{ color: th.soft }}
                      onClick={() => {
                        setReplyTo((cur) => (cur === cm.id ? null : cm.id));
                        setReplyText('');
                      }}>
                      Ответить
                    </button>
                    {!staff && (
                      <button type="button" className="pv-micro inline-flex items-center gap-1" style={{ color: th.soft }}
                        onClick={() => void report(cm)}>
                        <Flag size={11} />пожаловаться
                      </button>
                    )}
                  </div>
                )}
                {replyTo === cm.id && (
                  <div className="flex gap-2 mt-2">
                    <input
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder={staff ? `Ответ поддержки для ${cm.author}…` : `Ответ для ${cm.author}…`}
                      className="flex-1 rounded-2xl px-3 py-2 text-xs outline-none min-h-11"
                      style={{ background: th.lightBg, color: th.inkText }}
                      onKeyDown={(e) => { if (e.key === 'Enter') void postReply(cm.id); }}
                    />
                    <button type="button" disabled={busy} onClick={() => void postReply(cm.id)}
                      className="w-11 h-11 rounded-2xl flex items-center justify-center text-white flex-shrink-0"
                      style={{ background: ACCENT }} aria-label="Отправить ответ">
                      <Send size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {(isLoggedIn || !!staff) ? (
        <div className="flex gap-2 mt-4 pt-3" style={{ borderTop: `1px solid ${th.border}` }}>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={staff ? 'Комментарий от Поддержки…' : 'Написать комментарий…'}
            className="flex-1 text-sm rounded-2xl px-4 py-2.5 outline-none min-h-11"
            style={{ background: th.lightBg, color: th.inkText }}
            onKeyDown={(e) => { if (e.key === 'Enter') void postRoot(); }}
          />
          <button type="button" disabled={busy} onClick={() => void postRoot()}
            aria-label="Отправить комментарий"
            className="w-11 h-11 rounded-2xl flex items-center justify-center text-white flex-shrink-0"
            style={{ background: ACCENT }}>
            <Send size={15} />
          </button>
        </div>
      ) : (
        <button type="button" className="mt-4 w-full py-2.5 rounded-2xl text-xs font-semibold"
          style={{ background: th.lightBg, color: th.muted }}
          onClick={() => push({ type: 'auth' })}>
          Войдите, чтобы комментировать
        </button>
      )}
    </div>
  );
}
