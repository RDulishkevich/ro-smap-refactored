/**
 * Transactional HTML email templates for Полёвка (RU, RF SMTP).
 * Keep layout simple for clients; brand = blue accent on clean white.
 */

function esc(s) {
    return String(s || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function layout({ title, preheader, bodyHtml, footHtml }) {
    const brand = 'Полёвка';
    const site = 'https://www.polevka.art';
    const foot = footHtml || `Письмо отправлено автоматически сервисом «Полёвка». Если вы не запрашивали это действие, просто проигнорируйте письмо.<br>
        <a href="${esc(site)}">${esc(site)}</a>`;
    return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<!--[if !mso]><!-->
<style>
  body{margin:0;padding:0;background:#f1f5f9;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a}
  .wrap{max-width:560px;margin:0 auto;padding:32px 16px}
  .card{background:#fff;border-radius:20px;border:1px solid #e2e8f0;overflow:hidden}
  .head{padding:28px 28px 12px;border-bottom:1px solid #f1f5f9}
  .brand{font-size:22px;font-weight:800;letter-spacing:-0.02em;color:#1d4ed8;margin:0}
  .sub{margin:6px 0 0;font-size:13px;color:#64748b}
  .body{padding:28px}
  .h1{margin:0 0 12px;font-size:18px;font-weight:700;color:#0f172a}
  .p{margin:0 0 14px;font-size:15px;line-height:1.55;color:#334155}
  .msg{margin:0 0 14px;font-size:15px;line-height:1.65;color:#334155;white-space:pre-wrap}
  .code{display:inline-block;margin:8px 0 18px;padding:14px 22px;border-radius:14px;background:#eff6ff;border:1px solid #bfdbfe;font-size:28px;font-weight:800;letter-spacing:0.22em;color:#1e3a8a;font-family:ui-monospace,Consolas,monospace}
  .foot{padding:18px 28px 28px;font-size:12px;line-height:1.5;color:#94a3b8}
  .foot a{color:#64748b}
</style>
<!--<![endif]-->
</head>
<body>
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</div>
  <div class="wrap">
    <div class="card">
      <div class="head">
        <p class="brand">${esc(brand)}</p>
        <p class="sub">Аудиокарта полевых записей · ${esc(site.replace('https://', ''))}</p>
      </div>
      <div class="body">${bodyHtml}</div>
      <div class="foot">${foot}</div>
    </div>
  </div>
</body>
</html>`;
}

function verificationEmail(code) {
    const c = esc(code);
    return {
        subject: 'Код подтверждения email — Полёвка',
        text: `Ваш код подтверждения email в Полёвке: ${code}\n\nКод действует 10 минут. Если вы не запрашивали код, проигнорируйте письмо.\n\nhttps://www.polevka.art`,
        html: layout({
            title: 'Код подтверждения',
            preheader: `Код подтверждения: ${code}`,
            bodyHtml: `
              <h1 class="h1">Подтверждение email</h1>
              <p class="p">Введите этот код в кабинете Полёвки. Он действует <strong>10 минут</strong>.</p>
              <div class="code">${c}</div>
              <p class="p" style="margin-bottom:0;font-size:13px;color:#64748b">Никому не сообщайте код — даже если вас об этом просят.</p>
            `
        })
    };
}

function passwordResetEmail(code) {
    const c = esc(code);
    return {
        subject: 'Сброс пароля — Полёвка',
        text: `Код для сброса пароля в Полёвке: ${code}\n\nКод действует 15 минут. Если вы не запрашивали сброс, проигнорируйте письмо.\n\nhttps://www.polevka.art`,
        html: layout({
            title: 'Сброс пароля',
            preheader: `Код сброса пароля: ${code}`,
            bodyHtml: `
              <h1 class="h1">Сброс пароля</h1>
              <p class="p">Вы запросили новый пароль. Введите код на экране входа. Действует <strong>15 минут</strong>.</p>
              <div class="code">${c}</div>
              <p class="p" style="margin-bottom:0;font-size:13px;color:#64748b">Если это были не вы — смените пароль после входа и напишите в поддержку в приложении.</p>
            `
        })
    };
}

/** Staff → user message (admin / moderator). Body must already be plain text; we escape for HTML. */
function staffMessageEmail({ subject, message, fromLabel }) {
    const site = 'https://www.polevka.art';
    const subj = String(subject || 'Сообщение от поддержки Полёвки').slice(0, 120);
    const msg = String(message || '').slice(0, 4000);
    const from = String(fromLabel || 'Поддержка Полёвки').slice(0, 80);
    const msgHtml = esc(msg).replace(/\r\n|\r|\n/g, '<br>');
    return {
        subject: subj.includes('Полёвка') ? subj : `${subj} — Полёвка`,
        text: `${from}:\n\n${msg}\n\n—\nОтветить можно в чате поддержки в приложении или на support@polevka.art\n${site}`,
        html: layout({
            title: subj,
            preheader: msg.slice(0, 100),
            bodyHtml: `
              <h1 class="h1">${esc(subj)}</h1>
              <p class="p" style="font-size:13px;color:#64748b;margin-bottom:16px">От: ${esc(from)}</p>
              <p class="msg">${msgHtml}</p>
            `,
            footHtml: `Это письмо от команды Полёвки. Ответить удобнее в чате поддержки в приложении или на <a href="mailto:support@polevka.art">support@polevka.art</a>.<br>
        <a href="${esc(site)}">${esc(site)}</a>`
        })
    };
}

module.exports = {
    verificationEmail,
    passwordResetEmail,
    staffMessageEmail
};
