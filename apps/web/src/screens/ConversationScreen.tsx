import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Check, CheckCheck, Copy, CornerUpLeft, ImagePlus, Reply, Send, Trash2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { color, spring, tap } from '@polevka/design';
import {
  apiSyncJson, makeMailMsg, markThreadReadPatch, messageHomeBox, patchInboxMessage,
  previewReply, REACTION_EMOJIS, spamGuardCheck, spamGuardMessage, SUPPORT_LOGIN,
  threadWith, toggleMailReaction, uploadUserMedia, upsertInbox,
  type MailMsg, type MailReplyTo,
} from '@polevka/core';
import { useAuth } from '../state/AuthContext';
import { useData } from '../state/DataContext';
import { useNav } from '../state/NavContext';
import { useTh } from '../state/ThemeContext';
import { useUi } from '../state/UiContext';
import { ScreenHeader } from '../primitives/ui';
import { useKeyboardInset } from '../lib/keyboard-inset';

const SAGE = color.sage;
const ACCENT = color.accent;
const MAX_IMAGE = 12 * 1024 * 1024;
const MAX_VIDEO = 80 * 1024 * 1024;

type ThreadMsg = MailMsg & { mine: boolean };

function formatTime(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function replySnippet(m: Pick<MailMsg, 'fromId' | 'fromName' | 'text' | 'image' | 'video' | 'id'>): MailReplyTo {
  return {
    id: m.id,
    fromId: m.fromId,
    fromName: m.fromName,
    text: String(m.text || '').slice(0, 200),
    image: !!m.image,
    video: !!m.video,
  };
}

export function ConversationScreen({ name, avatar, peer, onBack }: {
  name: string; avatar: string; peer: string; onBack: () => void;
}) {
  const th = useTh();
  const { user, isLoggedIn } = useAuth();
  const { mail, profiles, reloadMail, applyMail } = useData();
  const { toast, confirm } = useUi();
  const { push } = useNav();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [lightbox, setLightbox] = useState('');
  const [replyTo, setReplyTo] = useState<MailReplyTo | null>(null);
  const [pending, setPending] = useState<ThreadMsg[]>([]);
  const [freshIds, setFreshIds] = useState<Set<string>>(() => new Set());
  const [menu, setMenu] = useState<{ msg: ThreadMsg; x: number; y: number } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const pickRef = useRef<HTMLInputElement>(null);
  const seenRef = useRef<Set<string>>(new Set());
  const bootRef = useRef(true);
  const kb = useKeyboardInset();
  const live = user ? threadWith(mail, user.loginName, peer) : [];
  const liveIds = new Set(live.map((m) => m.id));
  const msgs = [...live, ...pending.filter((m) => !liveIds.has(m.id))];
  const support = peer === SUPPORT_LOGIN;
  const profile = profiles.find((p) => String(p.loginName || '').toLowerCase() === peer);
  const letter = (name.trim()[0] || '?').toUpperCase();

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs.length, preview, replyTo]);

  useEffect(() => {
    if (bootRef.current) {
      bootRef.current = false;
      seenRef.current = new Set(msgs.map((m) => m.id));
      return;
    }
    const next = new Set<string>();
    for (const m of msgs) {
      if (!seenRef.current.has(m.id)) next.add(m.id);
    }
    if (next.size) {
      setFreshIds(next);
      next.forEach((id) => seenRef.current.add(id));
    }
  }, [msgs]);

  useEffect(() => {
    if (!user) return;
    const patch = markThreadReadPatch(mail, user.loginName, peer);
    if (!patch) return;
    void apiSyncJson('mail.json', [patch]).catch(() => {});
  }, [peer, user?.loginName, live.filter((m) => !m.mine && !m.read).length]);

  useEffect(() => {
    const t = window.setInterval(() => { void reloadMail(); }, 12000);
    return () => window.clearInterval(t);
  }, [reloadMail]);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [menu]);

  const openProfile = () => {
    if (support) return;
    push({
      type: 'user-profile',
      name: String(profile?.displayName || name),
      avatar: String(profile?.avatar || avatar || '🎙️'),
      username: `@${peer}`,
    });
  };

  const pickFile = (next: File | null) => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(next);
    setPreview(next ? URL.createObjectURL(next) : '');
  };

  const startReply = (m: ThreadMsg) => {
    setReplyTo(replySnippet(m));
    setMenu(null);
    window.setTimeout(() => areaRef.current?.focus(), 20);
  };

  const react = (m: ThreadMsg, emoji: string) => {
    if (!user || !isLoggedIn) { push({ type: 'auth' }); return; }
    const box = messageHomeBox(user.loginName, peer, m.mine);
    const reactions = toggleMailReaction(m.reactions, emoji, user.loginName);
    applyMail((prev) => patchInboxMessage(prev, box, m.id, { reactions }));
    const row = (mail.find((b) => b.loginName === box)?.inbox || []).find((row) => row.id === m.id);
    const next = { ...(row || m), reactions };
    void apiSyncJson('mail.json', [{
      loginName: box,
      inbox: [next],
      notifications: [],
      activityLog: [],
    }]).catch(() => toast('Не удалось поставить реакцию'));
    setMenu(null);
  };

  const copyMsg = async (m: ThreadMsg) => {
    const body = m.text && m.text !== 'Фото' && m.text !== 'Видео' ? m.text : (m.video ? 'Видео' : m.image ? 'Фото' : '');
    try { await navigator.clipboard.writeText(body); toast('Скопировано'); } catch { toast('Не удалось скопировать'); }
    setMenu(null);
  };

  const removeMsg = async (m: ThreadMsg) => {
    if (!user || !m.mine) return;
    const ok = await confirm({ title: 'Удалить сообщение?', body: 'Оно исчезнет из переписки.', ok: 'Удалить' });
    if (!ok) return;
    const box = messageHomeBox(user.loginName, peer, true);
    applyMail((prev) => patchInboxMessage(prev, box, m.id, { deleted: true, text: '', image: undefined, video: undefined, reactions: {} }));
    void apiSyncJson('mail.json', [{
      loginName: box,
      inbox: [{ ...m, deleted: true, text: '', image: undefined, video: undefined, reactions: {} }],
      notifications: [],
      activityLog: [],
    }]).catch(() => toast('Не удалось удалить'));
    setMenu(null);
  };

  const send = async () => {
    const t = text.trim();
    if ((!t && !file) || !user) return;
    if (!isLoggedIn) { push({ type: 'auth' }); return; }
    const guard = spamGuardCheck('comment');
    if (!guard.ok) { toast(spamGuardMessage(guard)); return; }
    if (file?.type.startsWith('video/') && file.size > MAX_VIDEO) {
      toast('Видео до 80 МБ');
      return;
    }
    if (file && !file.type.startsWith('video/') && file.size > MAX_IMAGE) {
      toast('Фото до 12 МБ');
      return;
    }
    const draftText = t || (file?.type.startsWith('video/') ? 'Видео' : file ? 'Фото' : '');
    const reply = replyTo || undefined;
    setText('');
    setReplyTo(null);
    if (areaRef.current) areaRef.current.style.height = 'auto';
    const attached = file;
    pickFile(null);

    let image: string | undefined;
    let video: string | undefined;
    if (attached) {
      setBusy(true);
      try {
        const ext = attached.name.includes('.') ? attached.name.slice(attached.name.lastIndexOf('.')) : '';
        const safe = `dm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}${ext}`;
        const url = await uploadUserMedia(attached, safe, attached.type);
        if (attached.type.startsWith('video/')) video = url;
        else image = url;
      } catch (e: unknown) {
        toast((e as Error).message || 'Не удалось загрузить файл');
        setBusy(false);
        return;
      }
    }

    const msg = makeMailMsg(user.loginName, user.displayName || user.username, draftText, {
      ...(image ? { image } : {}),
      ...(video ? { video } : {}),
      ...(reply ? { replyTo: reply } : {}),
      reactions: {},
    });
    const notif = support ? undefined : {
      id: `n${Date.now()}`,
      type: 'message',
      text: `${user.username} написал(а) вам`,
      fromId: user.loginName,
      fromName: user.username,
      date: msg.date,
      read: false,
    };
    applyMail((prev) => upsertInbox(prev, peer, msg, notif));
    setPending((cur) => [...cur, { ...msg, mine: true }]);
    setBusy(false);
    void apiSyncJson('mail.json', [{
      loginName: String(peer).toLowerCase(),
      inbox: [msg],
      notifications: notif ? [notif] : [],
      activityLog: [],
    }])
      .then(() => setPending((cur) => cur.filter((row) => row.id !== msg.id)))
      .catch((e: unknown) => {
        setPending((cur) => cur.filter((row) => row.id !== msg.id));
        applyMail((prev) => patchInboxMessage(prev, peer, msg.id, { deleted: true }));
        toast((e as Error).message || 'Не удалось отправить');
      });
  };

  return (
    <div className="flex flex-col h-full" style={{ background: th.phoneBg, paddingBottom: kb }}>
      <ScreenHeader
        title={name}
        onBack={onBack}
        onTitleClick={support ? undefined : openProfile}
        right={support ? undefined : (
          <button type="button" onClick={openProfile}
            className="w-11 h-11 rounded-2xl overflow-hidden flex items-center justify-center flex-shrink-0"
            style={{ background: th.lightBg, color: SAGE }} aria-label="Открыть профиль">
            {profile?.avatar && String(profile.avatar).startsWith('http')
              ? <img src={String(profile.avatar)} alt="" className="w-full h-full object-cover" />
              : letter}
          </button>
        )}
      />
      <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2 scrollbar-none">
        {msgs.length === 0 && <p className="pv-caption text-center py-8" style={{ color: SAGE }}>Начните переписку</p>}
        {msgs.map((m) => (
          <MessageBubble
            key={m.id}
            msg={m}
            fresh={freshIds.has(m.id)}
            th={th}
            me={user?.loginName || ''}
            onLightbox={setLightbox}
            onReply={() => startReply(m)}
            onReact={(emoji) => react(m, emoji)}
            onMenu={(x, y) => setMenu({ msg: m, x, y })}
          />
        ))}
      </div>
      <AnimatePresence>
        {menu && (
          <ActionHover
            key={menu.msg.id}
            x={menu.x}
            y={menu.y}
            mine={menu.msg.mine}
            th={th}
            onReact={(emoji) => react(menu.msg, emoji)}
            onReply={() => startReply(menu.msg)}
            onCopy={() => void copyMsg(menu.msg)}
            onDelete={menu.msg.mine ? () => void removeMsg(menu.msg) : undefined}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {replyTo && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={spring.chip}
            className="mx-3 mb-1 px-3 py-2 rounded-2xl flex items-center gap-2"
            style={{ background: th.cardBg }}>
            <Reply size={14} color={ACCENT} className="flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="pv-micro" style={{ color: ACCENT }}>{replyTo.fromName || 'Сообщение'}</p>
              <p className="pv-caption truncate" style={{ color: SAGE }}>{previewReply(replyTo) || 'Сообщение'}</p>
            </div>
            <button type="button" className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ color: SAGE }}
              onClick={() => setReplyTo(null)} aria-label="Отменить ответ">×</button>
          </motion.div>
        )}
      </AnimatePresence>
      {preview && (
        <div className="px-4 pb-2">
          <div className="relative inline-block">
            {file?.type.startsWith('video/')
              ? <video src={preview} className="h-20 rounded-2xl" />
              : <img src={preview} alt="" className="h-20 rounded-2xl object-cover" />}
            <button type="button" className="absolute -top-1 -right-1 w-7 h-7 rounded-full text-white"
              style={{ background: ACCENT }} onClick={() => pickFile(null)} aria-label="Убрать">×</button>
          </div>
        </div>
      )}
      <div className="px-3 pt-2 flex items-end gap-2" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))' }}>
        <input ref={pickRef} type="file" accept="image/*,video/mp4,video/quicktime,video/webm,video/3gpp"
          className="hidden" onChange={(e) => pickFile(e.target.files?.[0] || null)} />
        <motion.button type="button" whileTap={tap.cta} disabled={busy}
          onClick={() => pickRef.current?.click()}
          className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ background: th.cardBg }} aria-label="Фото или видео">
          <ImagePlus size={18} color={SAGE} />
        </motion.button>
        <textarea
          ref={areaRef}
          value={text}
          rows={1}
          enterKeyHint="send"
          placeholder={replyTo ? 'Ответ…' : 'Сообщение'}
          className="flex-1 min-h-11 max-h-32 rounded-2xl px-3.5 py-2.5 outline-none resize-none pv-body"
          style={{ background: th.cardBg, color: th.inkText }}
          onChange={(e) => {
            setText(e.target.value);
            e.target.style.height = 'auto';
            e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`;
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <motion.button type="button" whileTap={tap.cta} disabled={busy || (!text.trim() && !file)}
          onClick={() => void send()}
          className="w-11 h-11 rounded-2xl text-white flex items-center justify-center flex-shrink-0"
          style={{ background: ACCENT, opacity: busy || (!text.trim() && !file) ? 0.45 : 1 }}
          aria-label="Отправить">
          <Send size={16} />
        </motion.button>
      </div>
      {lightbox && (
        <button type="button" className="fixed inset-0 z-[400] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightbox('')}>
          <img src={lightbox} alt="" className="max-w-full max-h-full rounded-2xl" />
        </button>
      )}
    </div>
  );
}

function MessageBubble({ msg, fresh, th, me, onLightbox, onReply, onReact, onMenu }: {
  msg: ThreadMsg;
  fresh: boolean;
  th: { cardBg: string; inkText: string; lightBg: string };
  me: string;
  onLightbox: (src: string) => void;
  onReply: () => void;
  onReact: (emoji: string) => void;
  onMenu: (x: number, y: number) => void;
}) {
  const [dx, setDx] = useState(0);
  const start = useRef<{ x: number; y: number; t: number } | null>(null);
  const hold = useRef<number>(0);
  const moved = useRef(false);

  const clearHold = () => {
    if (hold.current) window.clearTimeout(hold.current);
    hold.current = 0;
  };

  const onDown = (e: ReactPointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    start.current = { x: e.clientX, y: e.clientY, t: Date.now() };
    moved.current = false;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    clearHold();
    hold.current = window.setTimeout(() => {
      if (!start.current || moved.current) return;
      onMenu(e.clientX, e.clientY);
      start.current = null;
    }, 420);
  };

  const onMove = (e: ReactPointerEvent) => {
    if (!start.current) return;
    const mx = e.clientX - start.current.x;
    const my = e.clientY - start.current.y;
    if (Math.abs(my) > 12 && Math.abs(my) > Math.abs(mx)) {
      clearHold();
      start.current = null;
      setDx(0);
      return;
    }
    if (Math.abs(mx) > 8 || Math.abs(my) > 8) {
      moved.current = true;
      clearHold();
    }
    const next = Math.max(-72, Math.min(72, mx));
    setDx(next);
  };

  const onUp = () => {
    clearHold();
    if (Math.abs(dx) > 48) onReply();
    setDx(0);
    start.current = null;
  };

  const reactions = Object.entries(msg.reactions || {}).filter(([, users]) => users.length);

  return (
    <div className={`relative max-w-[82%] ${msg.mine ? 'self-end' : 'self-start'}`}>
      <motion.div
        className="absolute top-1/2 -translate-y-1/2"
        style={{ [msg.mine ? 'right' : 'left']: -28, opacity: Math.min(1, Math.abs(dx) / 48) }}
        aria-hidden>
        <CornerUpLeft size={16} color={SAGE} />
      </motion.div>
      <motion.div
        initial={fresh ? { opacity: 0, y: 12, scale: 0.96 } : false}
        animate={{ opacity: 1, y: 0, scale: 1, x: dx }}
        transition={fresh ? spring.list : { type: 'tween', duration: 0.08, ease: 'linear' }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onContextMenu={(e) => {
          e.preventDefault();
          onMenu(e.clientX, e.clientY);
        }}
        className="px-3.5 py-2.5 rounded-[20px] overflow-hidden select-none"
        style={{
          background: msg.mine ? ACCENT : th.cardBg,
          color: msg.mine ? '#fff' : th.inkText,
          WebkitTouchCallout: 'none',
        }}>
        {msg.replyTo && (
          <div className="mb-1.5 pl-2 border-l-2 pv-caption line-clamp-2"
            style={{ borderColor: msg.mine ? 'rgba(255,255,255,0.45)' : ACCENT, opacity: 0.88 }}>
            <span className="font-medium">{msg.replyTo.fromName || 'Сообщение'}</span>
            {' · '}
            {previewReply(msg.replyTo) || 'Сообщение'}
          </div>
        )}
        {msg.image && (
          <button type="button" className="block mb-1.5 -mx-1" onClick={() => onLightbox(msg.image || '')}>
            <img src={msg.image} alt="" className="max-h-56 rounded-2xl object-cover" />
          </button>
        )}
        {msg.video && (
          <video src={msg.video} controls playsInline className="max-h-56 w-full rounded-2xl mb-1.5 bg-black" />
        )}
        {msg.text && msg.text !== 'Фото' && msg.text !== 'Видео' && (
          <p className="pv-body whitespace-pre-wrap break-words">{msg.text}</p>
        )}
        <div className="flex items-center gap-1 mt-1 justify-end"
          style={{ color: msg.mine ? 'rgba(255,255,255,0.72)' : SAGE }}>
          <span className="pv-micro">{formatTime(msg.date)}</span>
          {msg.mine && (msg.read
            ? <CheckCheck size={13} aria-label="Прочитано" />
            : <Check size={13} aria-label="Доставлено" />)}
        </div>
      </motion.div>
      {reactions.length > 0 && (
        <div className={`flex flex-wrap gap-1 mt-1 ${msg.mine ? 'justify-end' : 'justify-start'}`}>
          {reactions.map(([emoji, users]) => (
            <motion.button key={emoji} type="button" layout
              initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              transition={spring.chip} whileTap={tap.btn}
              onClick={() => onReact(emoji)}
              className="pv-micro px-1.5 h-6 rounded-full flex items-center gap-0.5"
              style={{
                background: users.some((u) => u === me) ? color.light : th.lightBg,
                color: th.inkText,
              }}>
              {emoji}{users.length > 1 ? <span>{users.length}</span> : null}
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
}

function ActionHover({ x, y, mine, th, onReact, onReply, onCopy, onDelete }: {
  x: number; y: number; mine: boolean;
  th: { cardBg: string; inkText: string };
  onReact: (emoji: string) => void;
  onReply: () => void;
  onCopy: () => void;
  onDelete?: () => void;
}) {
  const left = Math.max(12, Math.min(window.innerWidth - 240, x - 110));
  const top = Math.max(12, Math.min(window.innerHeight - 160, y - 88));
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, y: 4 }}
      transition={spring.chip}
      className="fixed z-[360] w-[220px] rounded-3xl p-2 shadow-[0_16px_40px_rgba(45,60,57,0.18)]"
      style={{ left, top, background: th.cardBg }}
      onPointerDown={(e) => e.stopPropagation()}>
      <div className="flex justify-between px-1 py-1">
        {REACTION_EMOJIS.map((emoji) => (
          <motion.button key={emoji} type="button" whileTap={tap.btn}
            className="w-8 h-8 rounded-full text-lg leading-none"
            onClick={() => onReact(emoji)} aria-label={emoji}>
            {emoji}
          </motion.button>
        ))}
      </div>
      <button type="button" className="w-full flex items-center gap-2 px-3 py-2 rounded-2xl pv-subtitle text-left"
        style={{ color: th.inkText }} onClick={onReply}>
        <Reply size={15} color={SAGE} /> Ответить
      </button>
      <button type="button" className="w-full flex items-center gap-2 px-3 py-2 rounded-2xl pv-subtitle text-left"
        style={{ color: th.inkText }} onClick={onCopy}>
        <Copy size={15} color={SAGE} /> Копировать
      </button>
      {mine && onDelete && (
        <button type="button" className="w-full flex items-center gap-2 px-3 py-2 rounded-2xl pv-subtitle text-left"
          style={{ color: ACCENT }} onClick={onDelete}>
          <Trash2 size={15} /> Удалить
        </button>
      )}
    </motion.div>
  );
}
