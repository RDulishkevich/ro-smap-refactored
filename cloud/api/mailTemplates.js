/**
 * Transactional HTML email templates for Полёвка (RU, RF SMTP).
 * Brand tokens from product UI: ink #141414, accent #ff5a3d.
 * Table + inline styles for client compatibility; soft depth via shadows/layers.
 */

function esc(s) {
    return String(s || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

const BRAND = {
    ink: '#141414',
    accent: '#ff5a3d',
    accentHover: '#e84a2f',
    accentSoft: '#fff1ee',
    accentBorder: '#ffd0c6',
    muted: '#6b7280',
    soft: '#9ca3af',
    line: '#efe8e6',
    paper: '#ffffff',
    canvas: '#f6f3f2',
    site: 'https://www.polevka.art'
};

function layout({ title, preheader, bodyHtml, footHtml }) {
    const brand = 'Полёвка';
    const site = BRAND.site;
    const foot = footHtml || `Письмо отправлено автоматически сервисом «Полёвка». Если вы не запрашивали это действие, просто проигнорируйте письмо.<br>
        <a href="${esc(site)}" style="color:${BRAND.muted};text-decoration:underline">${esc(site.replace('https://', ''))}</a>`;

    return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${esc(title)}</title>
<!--[if !mso]><!-->
<style>
  body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
  table,td{mso-table-lspace:0pt;mso-table-rspace:0pt}
  img{border:0;height:auto;line-height:100%;outline:none;text-decoration:none}
  body{margin:0;padding:0;width:100%!important;background:${BRAND.canvas};font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${BRAND.ink}}
  .wrap{width:100%;background:${BRAND.canvas};background-image:radial-gradient(ellipse 80% 50% at 50% -10%,rgba(255,90,61,0.12),transparent 55%),linear-gradient(180deg,#faf8f7 0%,${BRAND.canvas} 40%,#f0ebe9 100%)}
  .shell{max-width:560px;margin:0 auto;padding:40px 16px}
  .card{background:${BRAND.paper};border-radius:24px;overflow:hidden;border:1px solid ${BRAND.line};box-shadow:0 1px 2px rgba(20,20,20,0.04),0 12px 28px rgba(20,20,20,0.08),0 28px 56px rgba(255,90,61,0.08)}
  .accent-bar{height:5px;background:linear-gradient(90deg,${BRAND.accentHover} 0%,${BRAND.accent} 45%,#ff8a72 100%)}
  .head{padding:28px 32px 20px;background:linear-gradient(180deg,#fffbfa 0%,${BRAND.paper} 100%)}
  .brand{margin:0;font-size:26px;font-weight:800;letter-spacing:-0.03em;color:${BRAND.accent};line-height:1.15}
  .sub{margin:8px 0 0;font-size:13px;font-weight:600;letter-spacing:0.01em;color:${BRAND.muted}}
  .body{padding:8px 32px 28px}
  .h1{margin:0 0 12px;font-size:20px;font-weight:800;letter-spacing:-0.02em;color:${BRAND.ink};line-height:1.25}
  .p{margin:0 0 16px;font-size:15px;line-height:1.6;color:#3f3f46}
  .msg{margin:0 0 16px;font-size:15px;line-height:1.7;color:#3f3f46;white-space:pre-wrap}
  .code-wrap{margin:8px 0 20px;padding:4px;border-radius:18px;background:linear-gradient(145deg,${BRAND.accentBorder},${BRAND.accentSoft});box-shadow:inset 0 1px 0 rgba(255,255,255,0.85),0 8px 20px rgba(255,90,61,0.12)}
  .code{display:block;padding:18px 20px;border-radius:14px;background:${BRAND.paper};font-size:30px;font-weight:800;letter-spacing:0.28em;text-align:center;color:${BRAND.ink};font-family:ui-monospace,Consolas,'Courier New',monospace;box-shadow:0 1px 0 rgba(20,20,20,0.04)}
  .note{margin:0;font-size:13px;line-height:1.5;color:${BRAND.muted}}
  .foot{padding:20px 32px 28px;border-top:1px solid ${BRAND.line};background:#fcfaf9;font-size:12px;line-height:1.55;color:${BRAND.soft}}
  .foot a{color:${BRAND.muted}}
  @media (max-width:620px){
    .shell{padding:24px 12px}
    .head,.body{padding-left:22px;padding-right:22px}
    .foot{padding-left:22px;padding-right:22px}
    .brand{font-size:24px}
    .code{font-size:26px;letter-spacing:0.2em}
  }
</style>
<!--<![endif]-->
</head>
<body style="margin:0;padding:0;background:${BRAND.canvas}">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${esc(preheader)}</div>
  <table role="presentation" class="wrap" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background:${BRAND.canvas}">
    <tr>
      <td align="center" style="padding:0">
        <div class="shell" style="max-width:560px;margin:0 auto;padding:40px 16px">
          <table role="presentation" class="card" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background:${BRAND.paper};border-radius:24px;overflow:hidden;border:1px solid ${BRAND.line};box-shadow:0 12px 28px rgba(20,20,20,0.08),0 28px 56px rgba(255,90,61,0.08)">
            <tr><td class="accent-bar" style="height:5px;background:${BRAND.accent};font-size:0;line-height:0">&nbsp;</td></tr>
            <tr>
              <td class="head" style="padding:28px 32px 20px;background:#fffbfa">
                <p class="brand" style="margin:0;font-size:26px;font-weight:800;letter-spacing:-0.03em;color:${BRAND.accent};font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif">${esc(brand)}</p>
                <p class="sub" style="margin:8px 0 0;font-size:13px;font-weight:600;color:${BRAND.muted};font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif">Аудиокарта полевых записей</p>
              </td>
            </tr>
            <tr>
              <td class="body" style="padding:8px 32px 28px;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif">${bodyHtml}</td>
            </tr>
            <tr>
              <td class="foot" style="padding:20px 32px 28px;border-top:1px solid ${BRAND.line};background:#fcfaf9;font-size:12px;line-height:1.55;color:${BRAND.soft};font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif">${foot}</td>
            </tr>
          </table>
        </div>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function codeBlock(code) {
    const c = esc(code);
    return `<div class="code-wrap" style="margin:8px 0 20px;padding:4px;border-radius:18px;background:${BRAND.accentSoft};border:1px solid ${BRAND.accentBorder}">
  <div class="code" style="display:block;padding:18px 20px;border-radius:14px;background:${BRAND.paper};font-size:30px;font-weight:800;letter-spacing:0.28em;text-align:center;color:${BRAND.ink};font-family:ui-monospace,Consolas,'Courier New',monospace">${c}</div>
</div>`;
}

function verificationEmail(code) {
    return {
        subject: 'Код подтверждения email — Полёвка',
        text: `Ваш код подтверждения email в Полёвке: ${code}\n\nКод действует 10 минут. Если вы не запрашивали код, проигнорируйте письмо.\n\nhttps://www.polevka.art`,
        html: layout({
            title: 'Код подтверждения',
            preheader: `Код подтверждения: ${code}`,
            bodyHtml: `
              <h1 class="h1" style="margin:0 0 12px;font-size:20px;font-weight:800;color:${BRAND.ink}">Подтверждение email</h1>
              <p class="p" style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3f3f46">Введите этот код в кабинете Полёвки. Он действует <strong style="color:${BRAND.ink}">10 минут</strong>.</p>
              ${codeBlock(code)}
              <p class="note" style="margin:0;font-size:13px;line-height:1.5;color:${BRAND.muted}">Никому не сообщайте код — даже если вас об этом просят.</p>
            `
        })
    };
}

function passwordResetEmail(code) {
    return {
        subject: 'Сброс пароля — Полёвка',
        text: `Код для сброса пароля в Полёвке: ${code}\n\nКод действует 15 минут. Если вы не запрашивали сброс, проигнорируйте письмо.\n\nhttps://www.polevka.art`,
        html: layout({
            title: 'Сброс пароля',
            preheader: `Код сброса пароля: ${code}`,
            bodyHtml: `
              <h1 class="h1" style="margin:0 0 12px;font-size:20px;font-weight:800;color:${BRAND.ink}">Сброс пароля</h1>
              <p class="p" style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3f3f46">Вы запросили новый пароль. Введите код на экране входа. Действует <strong style="color:${BRAND.ink}">15 минут</strong>.</p>
              ${codeBlock(code)}
              <p class="note" style="margin:0;font-size:13px;line-height:1.5;color:${BRAND.muted}">Если это были не вы — смените пароль после входа и напишите в поддержку в приложении.</p>
            `
        })
    };
}

/** Staff → user message (admin / moderator). */
function staffMessageEmail({ subject, message, fromLabel }) {
    const site = BRAND.site;
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
              <h1 class="h1" style="margin:0 0 12px;font-size:20px;font-weight:800;color:${BRAND.ink}">${esc(subj)}</h1>
              <p class="p" style="margin:0 0 16px;font-size:13px;color:${BRAND.muted}">От: ${esc(from)}</p>
              <div style="margin:0 0 8px;padding:16px 18px;border-radius:16px;background:${BRAND.accentSoft};border:1px solid ${BRAND.accentBorder}">
                <p class="msg" style="margin:0;font-size:15px;line-height:1.7;color:#3f3f46">${msgHtml}</p>
              </div>
            `,
            footHtml: `Это письмо от команды Полёвки. Ответить удобнее в чате поддержки в приложении или на <a href="mailto:support@polevka.art" style="color:${BRAND.muted}">support@polevka.art</a>.<br>
        <a href="${esc(site)}" style="color:${BRAND.muted};text-decoration:underline">${esc(site.replace('https://', ''))}</a>`
        })
    };
}

module.exports = {
    verificationEmail,
    passwordResetEmail,
    staffMessageEmail
};
