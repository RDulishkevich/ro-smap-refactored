import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Send, Check, CheckCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { color, tap } from '@polevka/design';
import {
  apiSyncJson, makeMailMsg, markThreadReadPatch, spamGuardCheck, spamGuardMessage,
  SUPPORT_LOGIN, threadWith, uploadUserMedia, upsertInboxPatch,
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

function formatTime(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function ConversationScreen({ name, avatar, peer, onBack }: {
  name: string; avatar: string; peer: string; onBack: () => void;
}) {
  const th = useTh();
  const { user, isLoggedIn } = useAuth();
  const { mail, profiles, reloadMail } = useData();
  const { toast } = useUi();
  const { push } = useNav();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>('');
  const [lightbox, setLightbox] = useState<string>('');
  const listRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const pickRef = useRef<HTMLInputElement>(null);
  const kb = useKeyboardInset();
  const msgs = user ? threadWith(mail, user.loginName, peer) : [];
  const support = peer === SUPPORT_LOGIN;
  const profile = profiles.find((p) => String(p.loginName || '').toLowerCase() === peer);
  const letter = (name.trim()[0] || '?').toUpperCase();

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs.length, preview]);

  useEffect(() => {
    if (!user) return;
    const patch = markThreadReadPatch(mail, user.loginName, peer);
    if (!patch) return;
    void apiSyncJson('mail.json', [patch]).then(() => reloadMail()).catch(() => {});
  }, [peer, user?.loginName, msgs.filter((m) => !m.mine && !m.read).length]);

  useEffect(() => {
    const t = window.setInterval(() => { void reloadMail(); }, 8000);
    return () => window.clearInterval(t);
  }, [reloadMail]);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

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
    setBusy(true);
    try {
      let image: string | undefined;
      let video: string | undefined;
      if (file) {
        const ext = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')) : '';
        const safe = `dm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}${ext}`;
        const url = await uploadUserMedia(file, safe, file.type);
        if (file.type.startsWith('video/')) video = url;
        else image = url;
      }
      const msg = makeMailMsg(user.loginName, user.displayName || user.username, t || (video ? 'Видео' : image ? 'Фото' : ''), {
        ...(image ? { image } : {}),
        ...(video ? { video } : {}),
      });
      const notif = {
        id: `n${Date.now()}`,
        type: 'message',
        text: `${user.username} написал(а) вам`,
        fromId: user.loginName,
        fromName: user.username,
        date: msg.date,
        read: false,
      };
      const next = upsertInboxPatch(mail, peer, msg, support ? undefined : notif);
      await apiSyncJson('mail.json', next);
      setText('');
      pickFile(null);
      if (areaRef.current) areaRef.current.style.height = 'auto';
      await reloadMail();
    } catch (e: unknown) {
      toast((e as Error).message || 'Не удалось отправить');
    } finally { setBusy(false); }
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
          <div key={m.id} className={`max-w-[82%] ${m.mine ? 'self-end' : 'self-start'}`}>
            <div className="px-3.5 py-2.5 rounded-[20px] overflow-hidden"
              style={{ background: m.mine ? ACCENT : th.cardBg, color: m.mine ? '#fff' : th.inkText }}>
              {m.image && (
                <button type="button" className="block mb-1.5 -mx-1" onClick={() => setLightbox(m.image || '')}>
                  <img src={m.image} alt="" className="max-h-56 rounded-2xl object-cover" />
                </button>
              )}
              {m.video && (
                <video src={m.video} controls playsInline className="max-h-56 w-full rounded-2xl mb-1.5 bg-black" />
              )}
              {m.text && m.text !== 'Фото' && m.text !== 'Видео' && (
                <p className="pv-body whitespace-pre-wrap break-words">{m.text}</p>
              )}
              <div className={`flex items-center gap-1 mt-1 ${m.mine ? 'justify-end text-white/75' : 'justify-end'}`}
                style={{ color: m.mine ? 'rgba(255,255,255,0.72)' : SAGE }}>
                <span className="pv-micro">{formatTime(m.date)}</span>
                {m.mine && (m.read
                  ? <CheckCheck size={13} aria-label="Прочитано" />
                  : <Check size={13} aria-label="Доставлено" />)}
              </div>
            </div>
          </div>
        ))}
      </div>
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
          placeholder="Сообщение"
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
