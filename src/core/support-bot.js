/**
 * Support chatbot – FAQ auto-replies before escalating to a numbered ticket.
 */

window.SUPPORT_BOT_FAQ = [
    {
        keys: ['как добавить', 'добавить звук', 'загрузить', 'опубликовать', 'публикация', 'upload', 'publish'],
        answer: 'Чтобы добавить звук: нажмите «+» на карте, войдите в аккаунт и заполните форму. Новая запись уходит на модерацию и появится на карте после одобрения.'
    },
    {
        keys: ['не играет', 'не воспроизводится', 'нет звука', 'playback', 'play'],
        answer: 'Если звук не играет: проверьте интернет, громкость браузера и попробуйте другую запись. На iOS иногда помогает нажать play ещё раз после разблокировки экрана.'
    },
    {
        keys: ['фильтр', 'слой', 'ucs', 'категор', 'найти звук', 'поиск'],
        answer: 'Фильтры – в библиотеке слева: слои (гео/био/антропо), UCS-категории и теги. Активные фильтры видны в верхней панели карты.'
    },
    {
        keys: ['вход', 'регистрац', 'аккаунт', 'логин', 'login'],
        answer: 'Регистрация и вход – через кнопку профиля. Карту можно смотреть без аккаунта; публикация, сообщения и лайки требуют входа.'
    },
    {
        keys: ['пароль', 'сброс парол', 'забыл парол', 'восстанов', 'password', 'forgot'],
        answer: 'На экране входа нажмите «Забыли пароль?», укажите логин или подтверждённый email и введите код из письма. Без подтверждённого email сброс недоступен — напишите «обращение».'
    },
    {
        keys: ['подтверд email', 'подтвердить почт', 'код на почт', 'верификац', 'email код'],
        answer: 'Email подтверждается один раз: в кабинете нажмите «Отправить код», введите код из письма noreply@polevka.art. После подтверждения повторно код не нужен, пока не смените адрес.'
    },
    {
        keys: ['тема', 'тёмн', 'dark', 'язык', 'english', 'карта стиль', 'базовая карта'],
        answer: 'Тема, язык и стиль карты меняются в настройках (шестерёнка в левой панели).'
    },
    {
        keys: ['экспедиц', 'сесси', 'маршрут', 'soundwalk'],
        answer: 'Экспедиции создаются в личном кабинете. К записи можно привязать сессию – она появится во вкладке «Экспедиции».'
    },
    {
        keys: ['жалоба', 'репорт', 'модерац', 'удалить комментарий'],
        answer: 'На запись или комментарий можно пожаловаться из карточки (флаг). Жалобы рассматривает модерация в админ-панели.'
    },
    {
        keys: ['скачать', 'download', 'wav', 'лиценз'],
        answer: 'Скачивание WAV доступно в карточке записи. Лицензия указана в метаданных (часто CC BY).'
    },
    {
        keys: ['360', 'амбисоник', 'ambisonic', 'сфера'],
        answer: 'Для амбисоник-записей в плеере появляется кнопка сферы 360°. Нужны наушники и жест поворота компаса.'
    },
    {
        keys: ['на экран', 'домой', 'домашний экран', 'добавить на экран', 'ярлык', 'pwa', 'установить приложение', 'home screen'],
        answer: 'На iPhone: откройте сайт в Safari → «Поделиться» → «На экран „Домой“». На Android часто есть «Установить приложение» в меню браузера. Подробнее – в Помощи → FAQ.'
    },
    {
        keys: ['политик', 'конфиденциал', 'персональн', '152-фз', 'пдн', 'privacy'],
        answer: 'Открываю политику конфиденциальности. Связь по ПДн – чат поддержки в приложении (планируемый адрес support@polevka.art).',
        openLegal: 'privacy'
    },
    {
        keys: ['соглашен', 'оферт', 'terms', 'условия пользования', 'пользовательск'],
        answer: 'Открываю пользовательское соглашение. Правила публикации звуков – отдельный документ в Помощи → FAQ.',
        openLegal: 'terms'
    },
    {
        keys: ['поддержк', 'контакт', 'написать вам', 'email поддержки', 'почта поддержки', 'support@'],
        answer: 'Пишите в этот чат поддержки. Также: support@polevka.art. Если FAQ не помог — напишите «обращение», создадим тикет с номером.'
    },
    {
        keys: ['привет', 'здравств', 'hello', 'hi'],
        answer: 'Здравствуйте! Я бот поддержки Полёвки. Опишите вопрос своими словами – подскажу по FAQ. Если ответа не хватит, напишите «обращение».'
    }
];

window.matchSupportBotFaq = function(text) {
    const q = String(text || '').toLowerCase().trim();
    if (!q) return null;
    let best = null;
    let bestScore = 0;
    (window.SUPPORT_BOT_FAQ || []).forEach((item) => {
        let score = 0;
        (item.keys || []).forEach((k) => {
            if (q.includes(String(k).toLowerCase())) score += 1;
        });
        if (score > bestScore) {
            bestScore = score;
            best = item;
        }
    });
    return bestScore > 0 ? best : null;
};

window.isSupportEscalationRequest = function(text) {
    const q = String(text || '').toLowerCase();
    return /^(обращение|создать обращение|оператор|человек|не помогло|не подходит|эскалац)/i.test(q.trim())
        || q.includes('создать обращение')
        || q.includes('нужен оператор')
        || q.includes('свяжите с человеком');
};

window.getNextSupportTicketNumber = function() {
    let max = 0;
    const support = window.getProfileByLogin ? window.getProfileByLogin(window.SUPPORT_LOGIN) : null;
    (support?.inbox || []).forEach((m) => {
        const n = Number(m.ticketNumber) || 0;
        if (n > max) max = n;
    });
    (window.mailData || []).forEach((box) => {
        (box.inbox || []).forEach((m) => {
            const n = Number(m.ticketNumber) || 0;
            if (n > max) max = n;
        });
    });
    return max + 1;
};

window.appendSupportBotReply = async function(userLogin, text, extra = {}) {
    const updated = [...(window.profilesData || [])];
    const login = String(userLogin || '').toLowerCase();
    let idx = updated.findIndex((p) => String(p.loginName || '').toLowerCase() === login);
    if (idx < 0) {
        updated.push({ loginName: login, displayName: login, inbox: [], notifications: [] });
        idx = updated.length - 1;
    }
    const msg = {
        id: 'mbot' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
        fromId: window.SUPPORT_LOGIN,
        fromName: window.SUPPORT_NAME || 'Поддержка Полёвки',
        text,
        date: new Date().toISOString(),
        read: false,
        _bot: true,
        ...extra
    };
    updated[idx] = {
        ...updated[idx],
        inbox: [msg, ...(updated[idx].inbox || [])].slice(0, 200)
    };
    return window.syncProfilesData(updated);
};

window.createSupportTicket = async function(userLogin, subjectText) {
    const ticketNumber = window.getNextSupportTicketNumber();
    const myLogin = String(userLogin || '').toLowerCase();
    const display = window.currentUser?.username || myLogin;
    await window.ensureSupportProfile();

    const updated = [...(window.profilesData || [])];
    let sIdx = updated.findIndex((p) => String(p.loginName || '').toLowerCase() === String(window.SUPPORT_LOGIN || '').toLowerCase());
    if (sIdx < 0) {
        updated.push({ loginName: window.SUPPORT_LOGIN, displayName: window.SUPPORT_NAME, role: 'support', inbox: [], notifications: [] });
        sIdx = updated.length - 1;
    }
    const ticketMsg = {
        id: 'mtk' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
        fromId: myLogin,
        fromName: display,
        text: subjectText || 'Обращение в поддержку',
        date: new Date().toISOString(),
        read: false,
        ticketNumber,
        ticketStatus: 'open',
        _ticket: true
    };
    updated[sIdx] = {
        ...updated[sIdx],
        inbox: [ticketMsg, ...(updated[sIdx].inbox || [])].slice(0, 300)
    };

    let uIdx = updated.findIndex((p) => String(p.loginName || '').toLowerCase() === myLogin);
    if (uIdx < 0) {
        updated.push({ loginName: myLogin, displayName: display, inbox: [], notifications: [] });
        uIdx = updated.length - 1;
    }
    const confirm = {
        id: 'mconf' + Date.now().toString(36),
        fromId: window.SUPPORT_LOGIN,
        fromName: window.SUPPORT_NAME,
        text: `Обращение № ${ticketNumber} создано. Оператор ответит в этом чате. Кратко: «${String(subjectText || '').slice(0, 120)}»`,
        date: new Date().toISOString(),
        read: false,
        ticketNumber,
        _bot: true
    };
    updated[uIdx] = {
        ...updated[uIdx],
        inbox: [confirm, ...(updated[uIdx].inbox || [])].slice(0, 200)
    };

    const ok = await window.syncProfilesData(updated);
    if (ok && window.notifyAdmins) {
        window.notifyAdmins({
            type: 'support',
            text: `Обращение № ${ticketNumber} от ${display}: ${String(subjectText || '').slice(0, 140)}`,
            fromId: myLogin,
            fromName: display
        });
    }
    if (window.refreshAdminSupportBadge) window.refreshAdminSupportBadge();
    return ok ? ticketNumber : null;
};

/**
 * @returns {'handled'|'escalate'|null} handled = bot answered; escalate = create ticket after user msg; null = normal send
 */
window.trySupportBotBeforeSend = async function(text) {
    if (!window.currentUser) return null;
    const myLogin = window.currentUser.loginName || String(window.currentUser.username || '').toLowerCase();

    if (window.isSupportEscalationRequest(text)) {
        const lastUserQ = window.__supportBotLastQuestion || text;
        const num = await window.createSupportTicket(myLogin, lastUserQ);
        if (num != null) {
            window.showToast(`Обращение № ${num} создано`);
            if (window.openMessageThread) window.openMessageThread(window.SUPPORT_LOGIN);
            return 'handled';
        }
        return null;
    }

    const faq = window.matchSupportBotFaq(text);
    window.__supportBotLastQuestion = text;

    if (faq) {
        // User message already saved by caller; append bot reply
        const footer = '\n\nПомогло? Если нет – напишите «обращение», и мы создадим тикет с номером для оператора.';
        await window.appendSupportBotReply(myLogin, faq.answer + footer);
        if (faq.openLegal && window.openLegalDocModal) {
            try { window.openLegalDocModal(faq.openLegal); } catch (_) { /* ignore */ }
        }
        if (window.openMessageThread) window.openMessageThread(window.SUPPORT_LOGIN);
        return 'handled';
    }

    // No FAQ hit – soft prompt + still allow message to reach support inbox via normal path
    await window.appendSupportBotReply(
        myLogin,
        'Пока не нашёл точный ответ в базе. Могу создать обращение для оператора – напишите «обращение». Или уточните вопрос (публикация, плеер, фильтры, аккаунт).'
    );
    if (window.openMessageThread) window.openMessageThread(window.SUPPORT_LOGIN);
    return 'escalate'; // still deliver user text to support inbox
};
