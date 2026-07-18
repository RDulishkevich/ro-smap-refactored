/**
 * Система развития полевого рекордиста: XP, уровни, задания и достижения.
 * Прогресс считается по реальным действиям (публикации, метаданные, экспедиции, Guessr)
 * и сохраняется в profiles.json через saveMyProfile.
 */

window.FIELD_LEVEL_TITLES = {
    ru: [
        'Новичок поля',
        'Стажёр записи',
        'Полевой слушатель',
        'Рекордист',
        'Картограф звука',
        'Мастер ландшафта',
        'Акустический проводник',
        'Хранитель региона'
    ],
    en: [
        'Field novice',
        'Recording trainee',
        'Field listener',
        'Recordist',
        'Sound cartographer',
        'Landscape master',
        'Acoustic guide',
        'Region keeper'
    ]
};

/** Задания: помогают освоить практику полевой записи */
window.QUEST_CATALOG = [
    {
        id: 'q_first_publish',
        xp: 40,
        icon: 'fa-microphone-lines',
        title: { ru: 'Первая метка', en: 'First marker' },
        hint: { ru: 'Отправьте первую запись на карту (не черновик).', en: 'Submit your first recording to the map (not a draft).' },
        target: 1,
        progress: (s) => s.submitted
    },
    {
        id: 'q_eco_trio',
        xp: 60,
        icon: 'fa-layer-group',
        title: { ru: 'Три слоя ландшафта', en: 'Three soundscape layers' },
        hint: { ru: 'Запишите геофонию, биофонию и антропофонию.', en: 'Record geophony, biophony and anthrophony.' },
        target: 3,
        progress: (s) => s.ecoCount
    },
    {
        id: 'q_soundwalk',
        xp: 50,
        icon: 'fa-route',
        title: { ru: 'Звуковая прогулка', en: 'Soundwalk debut' },
        hint: { ru: 'Опубликуйте Soundwalk с маршрутом из ≥2 точек.', en: 'Publish a Soundwalk with a route of ≥2 points.' },
        target: 1,
        progress: (s) => s.soundwalks
    },
    {
        id: 'q_field_notes',
        xp: 45,
        icon: 'fa-clipboard-list',
        title: { ru: 'Полевой дневник', en: 'Field notes' },
        hint: { ru: 'Заполните описание, погоду, микрофон и рекордер у одной записи.', en: 'Fill description, weather, mic and recorder on one sound.' },
        target: 1,
        progress: (s) => s.richMeta
    },
    {
        id: 'q_photo_proof',
        xp: 35,
        icon: 'fa-camera',
        title: { ru: 'Визуальный контекст', en: 'Visual context' },
        hint: { ru: 'Прикрепите фото к записи — так проще понять место.', en: 'Attach a photo to a recording for place context.' },
        target: 1,
        progress: (s) => s.withPhotos
    },
    {
        id: 'q_expedition',
        xp: 55,
        icon: 'fa-map',
        title: { ru: 'Первая экспедиция', en: 'First expedition' },
        hint: { ru: 'Создайте экспедицию и сгруппируйте выезд.', en: 'Create an expedition to group a field trip.' },
        target: 1,
        progress: (s) => s.sessions
    },
    {
        id: 'q_profile_ready',
        xp: 40,
        icon: 'fa-id-card',
        title: { ru: 'Визитка рекордиста', en: 'Recordist card' },
        hint: { ru: 'Заполните био, аватар и список оборудования.', en: 'Add bio, avatar and gear list.' },
        target: 3,
        progress: (s) => s.profileScore
    },
    {
        id: 'q_map_five',
        xp: 70,
        icon: 'fa-location-dot',
        title: { ru: 'Пять точек на карте', en: 'Five map points' },
        hint: { ru: 'Добавьте 5 записей (не черновики).', en: 'Add 5 recordings (not drafts).' },
        target: 5,
        progress: (s) => s.submitted
    },
    {
        id: 'q_ear_train',
        xp: 50,
        icon: 'fa-ear-listen',
        title: { ru: 'Тренировка слуха', en: 'Ear training' },
        hint: { ru: 'Наберите ≥2500 очков за раунд в Audio Guessr.', en: 'Score ≥2500 points in one Audio Guessr round.' },
        target: 2500,
        progress: (s) => s.guessrBest
    },
    {
        id: 'q_ambisonic',
        xp: 60,
        icon: 'fa-cube',
        title: { ru: 'Пространственный звук', en: 'Spatial sound' },
        hint: { ru: 'Загрузите запись в формате Ambisonics.', en: 'Upload an Ambisonics recording.' },
        target: 1,
        progress: (s) => s.ambisonic
    }
];

/** Достижения — вехи развития (отображаются в профиле) */
window.ACHIEVEMENT_CATALOG = [
    {
        id: 'a_first_steps',
        icon: 'fa-shoe-prints',
        cls: 'ach-chip-field',
        title: { ru: 'Первые шаги', en: 'First steps' },
        hint: { ru: 'Первая запись отправлена на карту', en: 'First recording submitted' },
        check: (s) => s.submitted >= 1
    },
    {
        id: 'a_eco_balance',
        icon: 'fa-earth-europe',
        cls: 'ach-chip-eco',
        title: { ru: 'Баланс ландшафта', en: 'Landscape balance' },
        hint: { ru: 'Все три эко-категории в портфолио', en: 'All three eco-categories in portfolio' },
        check: (s) => s.ecoCount >= 3
    },
    {
        id: 'a_walker',
        icon: 'fa-person-walking',
        cls: 'ach-chip-walk',
        title: { ru: 'Странник', en: 'Wanderer' },
        hint: { ru: 'Есть звуковая прогулка с маршрутом', en: 'Completed a routed soundwalk' },
        check: (s) => s.soundwalks >= 1
    },
    {
        id: 'a_archivist',
        icon: 'fa-box-archive',
        cls: 'ach-chip-field',
        title: { ru: 'Архивариус', en: 'Archivist' },
        hint: { ru: '10 записей на карте', en: '10 recordings on the map' },
        check: (s) => s.submitted >= 10
    },
    {
        id: 'a_expedition_lead',
        icon: 'fa-flag',
        cls: 'ach-chip-exp',
        title: { ru: 'Глава выезда', en: 'Trip lead' },
        hint: { ru: 'Создана хотя бы одна экспедиция', en: 'Created at least one expedition' },
        check: (s) => s.sessions >= 1
    },
    {
        id: 'a_gear_ready',
        icon: 'fa-walkie-talkie',
        cls: 'ach-chip-gear',
        title: { ru: 'Готов к полю', en: 'Field-ready' },
        hint: { ru: 'В профиле указано оборудование', en: 'Gear listed on profile' },
        check: (s) => s.hasGear
    },
    {
        id: 'a_listener',
        icon: 'fa-headphones',
        cls: 'ach-chip-ear',
        title: { ru: 'Острый слух', en: 'Sharp ear' },
        hint: { ru: 'Сильный результат в Audio Guessr', en: 'Strong Audio Guessr result' },
        check: (s) => s.guessrBest >= 2500
    },
    {
        id: 'a_spatial',
        icon: 'fa-cube',
        cls: 'ach-chip-spatial',
        title: { ru: '360°', en: '360°' },
        hint: { ru: 'Есть Ambisonics-запись', en: 'Has an Ambisonics recording' },
        check: (s) => s.ambisonic >= 1
    },
    {
        id: 'a_level5',
        icon: 'fa-star',
        cls: 'ach-chip-level',
        title: { ru: 'Картограф звука', en: 'Sound cartographer' },
        hint: { ru: 'Достигнут 5 уровень', en: 'Reached level 5' },
        check: (s, prog) => (prog?.level || 1) >= 5
    }
];

window.xpToLevel = function(xp) {
    const n = Math.max(0, Number(xp) || 0);
    return Math.floor(Math.sqrt(n / 40)) + 1;
};

window.xpForLevel = function(level) {
    const lv = Math.max(1, Number(level) || 1);
    return Math.pow(lv - 1, 2) * 40;
};

window.xpForNextLevel = function(level) {
    return window.xpForLevel((Number(level) || 1) + 1);
};

window.getLevelTitle = function(level) {
    const lang = window.currentLang === 'en' ? 'en' : 'ru';
    const titles = window.FIELD_LEVEL_TITLES[lang] || window.FIELD_LEVEL_TITLES.ru;
    const idx = Math.min(titles.length - 1, Math.max(0, (Number(level) || 1) - 1));
    return titles[idx];
};

window.locQuestText = function(obj) {
    if (!obj) return '';
    if (typeof obj === 'string') return obj;
    const lang = window.currentLang === 'en' ? 'en' : 'ru';
    return obj[lang] || obj.ru || obj.en || '';
};

window.getEmptyProgress = function() {
    return {
        xp: 0,
        level: 1,
        achievements: [],
        completedQuests: [],
        guessrBestScore: 0,
        updatedAt: null
    };
};

window.getProgressForLogin = function(login) {
    const empty = window.getEmptyProgress();
    if (!login) return empty;
    const profile = window.getProfileByLogin ? window.getProfileByLogin(login) : null;
    const fromProfile = profile?.progress || null;
    const fromUser = (window.currentUser && (window.currentUser.loginName || String(window.currentUser.username || '').toLowerCase()) === login)
        ? window.currentUser.progress
        : null;
    const raw = fromUser || fromProfile || empty;
    const xp = Math.max(0, Number(raw.xp) || 0);
    return {
        xp,
        level: window.xpToLevel(xp),
        achievements: Array.isArray(raw.achievements) ? [...raw.achievements] : [],
        completedQuests: Array.isArray(raw.completedQuests) ? [...raw.completedQuests] : [],
        guessrBestScore: Math.max(0, Number(raw.guessrBestScore) || 0),
        updatedAt: raw.updatedAt || null
    };
};

window.getMyProgress = function() {
    if (!window.currentUser) return window.getEmptyProgress();
    const login = window.currentUser.loginName || String(window.currentUser.username || '').toLowerCase();
    return window.getProgressForLogin(login);
};

window.collectFieldStats = function(login) {
    const loginNorm = String(login || '').toLowerCase();
    const profile = window.getProfileByLogin ? window.getProfileByLogin(loginNorm) : null;
    const sounds = (window.soundsData || []).filter((s) => {
        const rid = String(s.recordistId || '').toLowerCase();
        const name = String(s.recordist || '').toLowerCase();
        return rid === loginNorm || (!rid && name === loginNorm);
    });
    const active = sounds.filter((s) => s.status !== 'draft');
    const ecos = new Set(active.map((s) => s.ecoCategory).filter(Boolean));
    const soundwalks = active.filter((s) => Array.isArray(s.route) && s.route.length > 1).length;
    const withPhotos = active.filter((s) => Array.isArray(s.images) && s.images.length > 0).length;
    const richMeta = active.filter((s) => {
        const desc = String(s.description || '').trim().length > 20;
        const weather = String(s.weather || '').trim().length > 0;
        const mic = String(s.micType || '').trim().length > 0;
        const gear = String(s.gear || '').trim().length > 0;
        return desc && weather && mic && gear;
    }).length;
    const ambisonic = active.filter((s) => String(s.channels || '').toLowerCase().includes('ambison')).length;
    const sessions = (profile?.sessions || []).length;
    const bio = String(profile?.bio || window.currentUser?.bio || '').trim();
    const avatar = profile?.avatar || window.currentUser?.avatar || '';
    const gearList = profile?.gear || window.currentUser?.gear || [];
    const hasBio = bio.length >= 12;
    const hasAvatar = !!avatar;
    const hasGear = Array.isArray(gearList) && gearList.length > 0;
    const progress = window.getProgressForLogin(loginNorm);
    return {
        submitted: active.length,
        ecoCount: ecos.size,
        soundwalks,
        withPhotos,
        richMeta,
        ambisonic,
        sessions,
        hasBio,
        hasAvatar,
        hasGear,
        profileScore: [hasBio, hasAvatar, hasGear].filter(Boolean).length,
        guessrBest: progress.guessrBestScore || 0
    };
};

window.persistMyProgress = async function(progress, { silent = true } = {}) {
    if (!window.currentUser || !window.saveMyProfile) return false;
    const next = {
        xp: Math.max(0, Number(progress.xp) || 0),
        level: window.xpToLevel(progress.xp),
        achievements: [...(progress.achievements || [])],
        completedQuests: [...(progress.completedQuests || [])],
        guessrBestScore: Math.max(0, Number(progress.guessrBestScore) || 0),
        updatedAt: new Date().toISOString()
    };
    window.currentUser.progress = next;
    const ok = await window.saveMyProfile({ progress: next });
    if (!silent && window.showToast) window.showToast(window.currentLang === 'en' ? 'Progress saved' : 'Прогресс сохранён');
    if (window.renderQuestsPanel && document.querySelector('[data-cab-panel="quests"]:not(.hidden)')) {
        window.renderQuestsPanel();
    }
    return ok;
};

/**
 * Пересчитывает задания/достижения по текущей статистике.
 * Начисляет XP за новые завершённые квесты и открывает ачивки.
 */
window.evaluateFieldProgress = async function(opts = {}) {
    if (!window.currentUser) return null;
    const login = window.currentUser.loginName || String(window.currentUser.username || '').toLowerCase();
    const stats = window.collectFieldStats(login);
    const prog = window.getMyProgress();
    if (opts.guessrScore != null) {
        prog.guessrBestScore = Math.max(prog.guessrBestScore || 0, Number(opts.guessrScore) || 0);
        stats.guessrBest = prog.guessrBestScore;
    }

    const newlyCompleted = [];
    const newlyAchieved = [];
    let xpGain = 0;

    (window.QUEST_CATALOG || []).forEach((q) => {
        if (prog.completedQuests.includes(q.id)) return;
        const cur = Math.min(q.target, Number(q.progress(stats)) || 0);
        if (cur >= q.target) {
            prog.completedQuests.push(q.id);
            xpGain += q.xp;
            newlyCompleted.push(q);
        }
    });

    const levelBefore = window.xpToLevel(prog.xp);
    prog.xp += xpGain;
    prog.level = window.xpToLevel(prog.xp);

    (window.ACHIEVEMENT_CATALOG || []).forEach((a) => {
        if (prog.achievements.includes(a.id)) return;
        if (a.check(stats, prog)) {
            prog.achievements.push(a.id);
            newlyAchieved.push(a);
            if (!xpGain) {
                // small bonus only if not already granted via quest same tick
            }
        }
    });

    // small XP for brand-new achievements not tied to a quest claim this tick
    if (newlyAchieved.length && xpGain === 0) {
        const bonus = newlyAchieved.length * 15;
        prog.xp += bonus;
        prog.level = window.xpToLevel(prog.xp);
        xpGain += bonus;
    }

    const changed = newlyCompleted.length > 0 || newlyAchieved.length > 0 || opts.guessrScore != null;
    if (changed) {
        await window.persistMyProgress(prog, { silent: true });
        if (newlyCompleted.length && window.logUserActivity) {
            newlyCompleted.forEach(q => {
                window.logUserActivity({
                    type: 'quest',
                    text: `Выполнил задание «${window.locQuestText(q.title)}»`,
                    questId: q.id
                }, login);
            });
        }
        if (newlyCompleted.length && window.showToast) {
            const q = newlyCompleted[0];
            const more = newlyCompleted.length > 1 ? ` (+${newlyCompleted.length - 1})` : '';
            window.showToast(`${window.locQuestText(q.title)}${more}: +${newlyCompleted.reduce((n, x) => n + x.xp, 0)} XP`);
        } else if (newlyAchieved.length && window.showToast) {
            window.showToast(`${window.currentLang === 'en' ? 'Achievement' : 'Достижение'}: ${window.locQuestText(newlyAchieved[0].title)}`);
        }
        if (prog.level > levelBefore && window.showToast) {
            window.showToast(`${window.currentLang === 'en' ? 'Level' : 'Уровень'} ${prog.level}: ${window.getLevelTitle(prog.level)}`);
        }
        if (window.playSfx && (newlyCompleted.length || newlyAchieved.length)) {
            try { window.playSfx('open'); } catch (_) {}
        }
    }

    if (opts.refreshUi !== false) {
        if (window.renderQuestsPanel) window.renderQuestsPanel();
        if (window.refreshCabinetProgressChip) window.refreshCabinetProgressChip();
    }
    return { progress: prog, newlyCompleted, newlyAchieved, xpGain, stats };
};

window.refreshCabinetProgressChip = function() {
    const chip = document.getElementById('cabinet-user-level');
    if (!chip || !window.currentUser) return;
    const prog = window.getMyProgress();
    chip.innerHTML = `<i class="fa-solid fa-bolt"></i>Lv ${prog.level} · ${prog.xp} XP`;
    chip.classList.remove('hidden');
};

window.renderQuestsPanel = function() {
    const root = document.getElementById('cab-panel-quests');
    if (!root || !window.currentUser) return;

    const login = window.currentUser.loginName || String(window.currentUser.username || '').toLowerCase();
    const stats = window.collectFieldStats(login);
    const prog = window.getMyProgress();
    const level = prog.level;
    const xp = prog.xp;
    const floor = window.xpForLevel(level);
    const ceil = window.xpForNextLevel(level);
    const span = Math.max(1, ceil - floor);
    const pct = Math.min(100, Math.round(((xp - floor) / span) * 100));

    const hero = document.getElementById('cab-quests-hero');
    if (hero) {
        hero.innerHTML = `
            <div class="quest-hero">
                <div class="quest-hero__top">
                    <div>
                        <p class="quest-hero__kicker" data-lang="quests_level">${window.currentLang === 'en' ? 'Field level' : 'Полевой уровень'}</p>
                        <h4 class="quest-hero__title">${level}. ${window.getLevelTitle(level)}</h4>
                    </div>
                    <div class="quest-hero__xp"><strong>${xp}</strong> XP</div>
                </div>
                <div class="quest-xp-bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
                    <span style="width:${pct}%"></span>
                </div>
                <p class="quest-hero__meta">${xp - floor} / ${span} XP ${window.currentLang === 'en' ? 'to next level' : 'до следующего уровня'}</p>
                <p class="quest-hero__blurb">${window.currentLang === 'en'
                    ? 'Quests guide real field-recording practice: layers, metadata, walks, expeditions.'
                    : 'Задания ведут по реальной практике полевой записи: слои ландшафта, метаданные, прогулки, экспедиции.'}</p>
            </div>`;
    }

    const list = document.getElementById('cab-quests-list');
    if (list) {
        list.innerHTML = (window.QUEST_CATALOG || []).map((q) => {
            const done = prog.completedQuests.includes(q.id);
            const cur = Math.min(q.target, Number(q.progress(stats)) || 0);
            const qPct = Math.min(100, Math.round((cur / q.target) * 100));
            return `
                <article class="quest-card ${done ? 'is-done' : ''}">
                    <div class="quest-card__icon"><i class="fa-solid ${q.icon}"></i></div>
                    <div class="quest-card__body">
                        <div class="quest-card__head">
                            <h5>${window.locQuestText(q.title)}</h5>
                            <span class="quest-card__xp">+${q.xp} XP</span>
                        </div>
                        <p>${window.locQuestText(q.hint)}</p>
                        <div class="quest-card__bar"><span style="width:${qPct}%"></span></div>
                        <div class="quest-card__foot">
                            <span>${cur} / ${q.target}</span>
                            <span class="quest-card__status">${done
                                ? (window.currentLang === 'en' ? 'Done' : 'Выполнено')
                                : (window.currentLang === 'en' ? 'In progress' : 'В процессе')}</span>
                        </div>
                    </div>
                </article>`;
        }).join('');
    }

    const grid = document.getElementById('cab-achievements-grid');
    if (grid) {
        grid.innerHTML = (window.ACHIEVEMENT_CATALOG || []).map((a) => {
            const unlocked = prog.achievements.includes(a.id) || a.check(stats, prog);
            return `
                <div class="ach-tile ${unlocked ? 'is-on' : 'is-off'}" title="${window.locQuestText(a.hint)}">
                    <i class="fa-solid ${a.icon}"></i>
                    <strong>${window.locQuestText(a.title)}</strong>
                    <span>${window.locQuestText(a.hint)}</span>
                </div>`;
        }).join('');
    }

    window.refreshCabinetProgressChip();
};

window.renderProfileAchievements = function(login, profile) {
    const wrap = document.getElementById('pp-achievements');
    const levelEl = document.getElementById('pp-level-chip');
    if (!wrap) return;

    const prog = window.getProgressForLogin(login);
    // Merge profile.progress if richer
    if (profile?.progress) {
        prog.xp = Math.max(prog.xp, Number(profile.progress.xp) || 0);
        prog.level = window.xpToLevel(prog.xp);
        prog.achievements = Array.from(new Set([...(prog.achievements || []), ...(profile.progress.achievements || [])]));
    }

    if (levelEl) {
        if (prog.xp > 0 || prog.achievements.length) {
            levelEl.classList.remove('hidden');
            levelEl.innerHTML = `<i class="fa-solid fa-bolt"></i>${window.currentLang === 'en' ? 'Lv' : 'Ур.'} ${prog.level} · ${window.getLevelTitle(prog.level)}`;
        } else {
            levelEl.classList.add('hidden');
        }
    }

    const unlocked = (window.ACHIEVEMENT_CATALOG || []).filter((a) => prog.achievements.includes(a.id));
    if (!unlocked.length) {
        wrap.innerHTML = '';
        wrap.classList.add('hidden');
        return;
    }
    wrap.classList.remove('hidden');
    wrap.innerHTML = `
        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2"><i class="fa-solid fa-trophy mr-1"></i>${window.currentLang === 'en' ? 'Achievements' : 'Достижения'}</p>
        <div class="pp-ach-row">${unlocked.map((a) => `
            <span class="ach-chip ${a.cls}" title="${window.locQuestText(a.hint)}"><i class="fa-solid ${a.icon}"></i>${window.locQuestText(a.title)}</span>
        `).join('')}</div>`;
};

window.noteGuessrScore = async function(points) {
    if (!window.currentUser || !points) return;
    await window.evaluateFieldProgress({ guessrScore: points });
};

/**
 * Админ: начислить XP / открыть достижение победителю ивента.
 * Идемпотентность — на стороне setEventWinner (xpGranted в winners[]).
 */
window.grantEventPrizeToUser = async function(login, prize = {}) {
    if (!window.isCurrentUserAdmin || !window.isCurrentUserAdmin()) return { ok: false, reason: 'not_admin' };
    const loginNorm = String(login || '').toLowerCase();
    if (!loginNorm) return { ok: false, reason: 'no_login' };

    const xpAdd = Math.max(0, Math.floor(Number(prize.xp) || 0));
    const achievementId = String(prize.achievementId || '').trim();
    if (!xpAdd && !achievementId) return { ok: true, skipped: true };

    const updated = [...(window.profilesData || [])];
    const idx = updated.findIndex((p) => String(p.loginName || '').toLowerCase() === loginNorm);
    if (idx < 0) return { ok: false, reason: 'no_profile' };

    const prev = updated[idx].progress || { xp: 0, achievements: [], completedQuests: [], guessrBestScore: 0 };
    const achievements = Array.from(new Set([...(prev.achievements || [])]));
    let achGranted = false;
    if (achievementId && !achievements.includes(achievementId)) {
        achievements.push(achievementId);
        achGranted = true;
    }
    const nextXp = Math.max(0, (Number(prev.xp) || 0) + xpAdd);
    const next = {
        xp: nextXp,
        level: window.xpToLevel ? window.xpToLevel(nextXp) : 1,
        achievements,
        completedQuests: [...(prev.completedQuests || [])],
        guessrBestScore: Math.max(0, Number(prev.guessrBestScore) || 0),
        updatedAt: new Date().toISOString()
    };
    updated[idx] = { ...updated[idx], progress: next, profileUpdatedAt: new Date().toISOString() };
    window.profilesData = updated;

    const me = window.currentUser?.loginName || String(window.currentUser?.username || '').toLowerCase();
    if (me === loginNorm) window.currentUser.progress = next;

    const ok = await window.syncProfilesData(updated);
    return { ok: !!ok, xpGranted: xpAdd, achievementGranted: achGranted ? achievementId : '' };
};

window.getAchievementTitle = function(id) {
    const a = (window.ACHIEVEMENT_CATALOG || []).find((x) => x.id === id);
    if (!a) return id || '';
    return window.locQuestText ? window.locQuestText(a.title) : (a.title?.ru || a.title?.en || id);
};
