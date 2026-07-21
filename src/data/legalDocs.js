/**
 * Legal documents for Полёвка (privacy + terms).
 * Keep in sync with docs/privacy-policy.md and docs/terms-of-service.md
 */

export const LEGAL_DOCS_VERSION = '2026.07';

/** Planned mailbox; until DNS/SMTP ready, in-app support chat is the contact channel. */
export const SUPPORT_PUBLIC_EMAIL = 'support@polevka.art';

/** @typedef {{ id: string, title: string, body: string }} LegalDocItem */
/** @typedef {{ id: string, title: string, intro?: string, items: LegalDocItem[] }} LegalDocSection */
/** @typedef {{ id: string, title: string, shortTitle: string, version: string, sections: LegalDocSection[] }} LegalDoc */

/** @type {Record<string, LegalDoc>} */
export const LEGAL_DOCS = {
    privacy: {
        id: 'privacy',
        title: 'Политика конфиденциальности',
        shortTitle: 'Политика',
        version: LEGAL_DOCS_VERSION,
        sections: [
            {
                id: 'operator',
                title: 'Оператор',
                items: [
                    {
                        id: 'P1',
                        title: 'Кто обрабатывает данные',
                        body: 'Оператор персональных данных сервиса «Полёвка» — самозанятое физическое лицо (НПД) Дулишкевич Роман Владимирович. ИНН будет указан после предоставления. Связь: чат поддержки в приложении; планируемый адрес — support@polevka.art.'
                    }
                ]
            },
            {
                id: 'data',
                title: 'Какие данные обрабатываем',
                intro: 'Мы обрабатываем только то, что нужно для работы карты, кабинета и модерации.',
                items: [
                    {
                        id: 'P2',
                        title: 'Профиль и аккаунт',
                        body: 'Логин, отображаемое имя, аватар, биография, ссылки, оборудование, анкета при регистрации, согласие на обработку ПДн.'
                    },
                    {
                        id: 'P3',
                        title: 'Email',
                        body: 'Адрес электронной почты (если вы его указали) и факт подтверждения. Коды подтверждения отправляются на указанный адрес после настройки SMTP.'
                    },
                    {
                        id: 'P4',
                        title: 'Контент и общение',
                        body: 'Звуковые файлы, фото, координаты, UCS-метаданные, комментарии, сообщения, уведомления, жалобы и реакции.'
                    },
                    {
                        id: 'P5',
                        title: 'Технические данные',
                        body: 'Данные запросов к API для лимитов и безопасности. Cookies для сессии не используются: токен и настройки хранятся в localStorage на вашем устройстве.'
                    }
                ]
            },
            {
                id: 'purposes',
                title: 'Цели и основания',
                items: [
                    {
                        id: 'P6',
                        title: 'Цели',
                        body: 'Работа сервиса (карта, кабинет, сообщения, модерация), подтверждение email, безопасность и исполнение законодательства РФ.'
                    },
                    {
                        id: 'P7',
                        title: 'Основания',
                        body: 'Согласие при регистрации, исполнение пользовательского соглашения, законные интересы оператора (модерация и безопасность) в пределах закона.'
                    }
                ]
            },
            {
                id: 'storage',
                title: 'Хранение и третьи лица',
                items: [
                    {
                        id: 'P8',
                        title: 'Где хранятся данные',
                        body: 'В облачном хранилище сервиса на территории РФ (Yandex Cloud), включая приватный бакет для чувствительных сведений.'
                    },
                    {
                        id: 'P9',
                        title: 'Третьи лица',
                        body: 'Яндекс (карты, при необходимости облако/перевод); служебные письма (код email) — через российский SMTP (например Unisender Go), без зарубежных ESP для ПДн. Персональные данные не продаются.'
                    },
                    {
                        id: 'P10',
                        title: 'Срок',
                        body: 'Пока аккаунт активен и контент нужен для сервиса, либо до удаления по запросу / решению модерации, если иное не требует закон.'
                    }
                ]
            },
            {
                id: 'rights',
                title: 'Ваши права',
                items: [
                    {
                        id: 'P11',
                        title: 'Запросы',
                        body: 'Вы можете запросить уточнение данных, ограничение обработки или удаление аккаунта через поддержку в приложении (или support@polevka.art, когда ящик будет активен).'
                    },
                    {
                        id: 'P12',
                        title: 'Изменения политики',
                        body: `Актуальная версия: ${LEGAL_DOCS_VERSION}. Существенные изменения могут сопровождаться уведомлением в продукте.`
                    }
                ]
            }
        ]
    },
    terms: {
        id: 'terms',
        title: 'Пользовательское соглашение',
        shortTitle: 'Соглашение',
        version: LEGAL_DOCS_VERSION,
        sections: [
            {
                id: 'subject',
                title: 'Предмет',
                items: [
                    {
                        id: 'T1',
                        title: 'О сервисе',
                        body: 'Соглашение регулирует использование аудиокарты «Полёвка»: просмотр, аккаунт, публикация звуков, сообщения и экспедиции. Используя сервис, вы принимаете эти условия и Политику конфиденциальности.'
                    }
                ]
            },
            {
                id: 'account',
                title: 'Аккаунт',
                items: [
                    {
                        id: 'T2',
                        title: 'Регистрация',
                        body: 'Для регистрации нужны логин, пароль и согласие на обработку персональных данных. Вы отвечаете за сохранность доступа.'
                    },
                    {
                        id: 'T3',
                        title: 'Запреты',
                        body: 'Нельзя передавать аккаунт третьим лицам и выдавать себя за другого пользователя. При нарушениях администрация может ограничить или заблокировать доступ.'
                    }
                ]
            },
            {
                id: 'content',
                title: 'Контент и модерация',
                items: [
                    {
                        id: 'T4',
                        title: 'Права на записи',
                        body: 'Вы гарантируете наличие прав на публикуемый материал и корректность метаданных (включая координаты). Лицензия должна соответствовать вашим правам.'
                    },
                    {
                        id: 'T5',
                        title: 'Модерация',
                        body: 'Новые записи проходят модерацию до появления на карте. Подробные требования — в Правилах Полёвки.'
                    },
                    {
                        id: 'T6',
                        title: 'Поведение',
                        body: 'Запрещены оскорбления, травля, спам, незаконный контент и злоупотребление жалобами. Нарушения могут повлечь удаление контента или блокировку.'
                    }
                ]
            },
            {
                id: 'license',
                title: 'Скачивание',
                items: [
                    {
                        id: 'T7',
                        title: 'Лицензии авторов',
                        body: 'При скачивании соблюдайте лицензию автора и не удаляйте требуемую атрибуцию из метаданных без оснований.'
                    }
                ]
            },
            {
                id: 'liability',
                title: 'Ответственность и поддержка',
                items: [
                    {
                        id: 'T8',
                        title: 'Сервис «как есть»',
                        body: 'Сервис предоставляется в текущем виде. Оператор стремится к стабильной работе, но не гарантирует бесперебойность. Ответственность ограничена в пределах закона РФ.'
                    },
                    {
                        id: 'T9',
                        title: 'Поддержка',
                        body: 'Вопросы и споры по модерации — через чат поддержки в приложении; планируемый email: support@polevka.art. Оператор — самозанятый Дулишкевич Роман Владимирович (НПД; ИНН — в политике). Применяется законодательство Российской Федерации.'
                    },
                    {
                        id: 'T10',
                        title: 'Изменения',
                        body: `Актуальная версия соглашения: ${LEGAL_DOCS_VERSION}. Обновления публикуются в приложении.`
                    }
                ]
            }
        ]
    }
};

function escHtml(s) {
    return String(s || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

export function renderLegalDocHtml(docId) {
    const doc = LEGAL_DOCS[docId];
    if (!doc) return `<p class="text-sm text-slate-500">Документ временно недоступен.</p>`;

    return doc.sections.map((section) => {
        const items = (section.items || []).map((item) => `
            <article class="publish-rule-item" id="legal-${escHtml(doc.id)}-${escHtml(item.id)}">
                <h5 class="publish-rule-item__title"><span class="publish-rule-item__code">${escHtml(item.id)}</span> ${escHtml(item.title)}</h5>
                <p class="publish-rule-item__body">${escHtml(item.body)}</p>
            </article>
        `).join('');
        return `
            <section class="publish-rule-section">
                <h4 class="publish-rule-section__title">${escHtml(section.title)}</h4>
                ${section.intro ? `<p class="publish-rule-section__intro">${escHtml(section.intro)}</p>` : ''}
                <div class="publish-rule-section__items">${items}</div>
            </section>
        `;
    }).join('');
}

if (typeof window !== 'undefined') {
    window.LEGAL_DOCS_VERSION = LEGAL_DOCS_VERSION;
    window.SUPPORT_PUBLIC_EMAIL = SUPPORT_PUBLIC_EMAIL;
    window.LEGAL_DOCS = LEGAL_DOCS;
    window.renderLegalDocHtml = renderLegalDocHtml;
    const syncSupportEmailUi = () => {
        const el = document.getElementById('help-support-email');
        if (el && SUPPORT_PUBLIC_EMAIL) el.textContent = SUPPORT_PUBLIC_EMAIL;
    };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', syncSupportEmailUi);
    } else {
        syncSupportEmailUi();
    }
}
