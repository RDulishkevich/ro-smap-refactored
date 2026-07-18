/**
 * Field recorders (decks only) and microphones for add-sound comboboxes.
 * Mic list starts with «Интегрированные» (priority / smartphone built-in).
 * Comboboxes: pick from catalog or type a custom value.
 */

export const FIELD_RECORDERS = [
    // Zoom
    'Zoom H1n',
    'Zoom H1essential',
    'Zoom H2n',
    'Zoom H3-VR',
    'Zoom H4n Pro',
    'Zoom H5',
    'Zoom H6',
    'Zoom H6essential',
    'Zoom H8',
    'Zoom F2',
    'Zoom F3',
    'Zoom F6',
    'Zoom F8',
    'Zoom F8n Pro',
    'Zoom M2 MicTrak',
    'Zoom M3 MicTrak',
    'Zoom M4 MicTrak',
    // Tascam
    'Tascam DR-05X',
    'Tascam DR-07XP',
    'Tascam DR-07X',
    'Tascam DR-10L',
    'Tascam DR-10X',
    'Tascam DR-22WL',
    'Tascam DR-40X',
    'Tascam DR-60D MkII',
    'Tascam DR-70D',
    'Tascam DR-100MKIII',
    'Tascam Portacapture X6',
    'Tascam Portacapture X8',
    // Sony
    'Sony PCM-A10',
    'Sony PCM-D10',
    'Sony PCM-D100',
    'Sony PCM-M10',
    // Olympus / OM System
    'Olympus LS-P4',
    'Olympus LS-P5',
    'Olympus LS-100',
    // Sound Devices
    'Sound Devices MixPre-3 II',
    'Sound Devices MixPre-6 II',
    'Sound Devices MixPre-10 II',
    'Sound Devices 552',
    'Sound Devices 633',
    'Sound Devices 664',
    'Sound Devices 688',
    'Sound Devices 833',
    'Sound Devices 888',
    'Sound Devices Scorpio',
    'Sound Devices Astral ARX16',
    // Zaxcom
    'Zaxcom Nova',
    'Zaxcom Nova 2',
    'Zaxcom Deva 24',
    'Zaxcom Maxx',
    // Roland / Marantz / others
    'Roland R-05',
    'Roland R-07',
    'Roland R-26',
    'Marantz PMD-661',
    'Marantz PMD-561',
    // Bioacoustic / autonomous
    'AudioMoth',
    'AudioMoth USB Microphone',
    'Song Meter Mini',
    'Song Meter Mini Bat',
    'Song Meter Micro',
    'Song Meter Micro 2',
    'Wildlife Acoustics SM4',
    'Wildlife Acoustics SM4BAT',
    'Frontier Labs Bar-LT'
];

/** Built-in first — shown with priority in the datalist. */
export const FIELD_MICROPHONES = [
    'Интегрированные',
    // AP Sound Capture (apsound.ru) — microphones only
    'AP Sound Capture Minimics Basic',
    'AP Sound Capture Minimics Basic Modular',
    'AP Sound Capture Minimics Flex',
    'AP Sound Capture Minimics FOLD',
    'AP Sound Capture Minimics 272 Compact',
    'AP Sound Capture Minimics 272 Modular Pro',
    'AP Sound Capture Minimics F3 / F6 / Sound Devices',
    'AP Sound Capture Tinymics',
    'AP Sound Capture Tinymics Binaural',
    'AP Sound Capture Tinymics Modular Ultrasonic 70k',
    'AP Sound Capture Ultrasonicmic 96k MKIII',
    'AP Sound Capture ORTFmic',
    'AP Sound Capture ORTFmic F3',
    'AP Sound Capture Unimic Module',
    'AP Sound Capture Unimic Plant',
    'AP Sound Capture Contactmic',
    'AP Sound Capture Electromics',
    'AP Sound Capture Electromic XL',
    'AP Sound Capture EMF XLR',
    'AP Sound Capture Vibromic Omni',
    'AP Sound Capture Vibromic Lite',
    // iOAudio (ioaudio.tk)
    'iOAudio AOM Microphone',
    'iOAudio Condenser mic Auris parva',
    'iOAudio Ea Geophone',
    'iOAudio EMF Stereo',
    'iOAudio EMF Stereo RE',
    'iOAudio IMO Hydrophone',
    'iOAudio Piezo contact mic Metal Rev.2',
    'iOAudio Piezo contact mic Metal Rev.3',
    // Sennheiser
    'Sennheiser NTG1',
    'Sennheiser NTG2',
    'Sennheiser NTG3',
    'Sennheiser NTG4',
    'Sennheiser NTG4+',
    'Sennheiser NTG5',
    'Sennheiser MKH 30',
    'Sennheiser MKH 40',
    'Sennheiser MKH 50',
    'Sennheiser MKH 60',
    'Sennheiser MKH 70',
    'Sennheiser MKH 80',
    'Sennheiser MKH 800',
    'Sennheiser MKH 8040',
    'Sennheiser MKH 8050',
    'Sennheiser MKH 8060',
    'Sennheiser MKH 8070',
    'Sennheiser MKH 8090',
    'Sennheiser MKH 416',
    'Sennheiser MKH 418-S',
    'Sennheiser MKE 600',
    'Sennheiser MKE 400',
    'Sennheiser Ambeo VR Mic',
    'Sennheiser Ambeo Smart Headset',
    'Sennheiser ME 66',
    'Sennheiser ME 67',
    'Sennheiser MD 421',
    // Rode
    'Rode NTG1',
    'Rode NTG2',
    'Rode NTG3',
    'Rode NTG4',
    'Rode NTG4+',
    'Rode NTG5',
    'Rode NTG8',
    'Rode NT1',
    'Rode NT1 5th Generation',
    'Rode NT2-A',
    'Rode NT4',
    'Rode NT5',
    'Rode NT55',
    'Rode NT6',
    'Rode TF-5',
    'Rode VideoMic',
    'Rode VideoMic Pro',
    'Rode VideoMic Pro+',
    'Rode VideoMic NTG',
    'Rode VideoMic GO II',
    'Rode Lavalier GO',
    'Rode Lavalier II',
    'Rode Wireless GO II',
    'Rode Wireless PRO',
    'Rode Stereo VideoMic X',
    // Schoeps
    'Schoeps CMC 1',
    'Schoeps CMC 6',
    'Schoeps CMC 6 U',
    'Schoeps MK 2',
    'Schoeps MK 2H',
    'Schoeps MK 4',
    'Schoeps MK 4V',
    'Schoeps MK 41',
    'Schoeps MK 41V',
    'Schoeps MK 5',
    'Schoeps MK 8',
    'Schoeps CCM 4',
    'Schoeps CCM 41',
    'Schoeps CMIT 5',
    'Schoeps CMIT 5 U',
    'Schoeps SuperCMIT',
    'Schoeps MiniCMIT',
    // Neumann
    'Neumann KMR 81 i',
    'Neumann KMR 82 i',
    'Neumann KM 183',
    'Neumann KM 184',
    'Neumann KM 185',
    'Neumann TLM 103',
    'Neumann U 87 Ai',
    // DPA
    'DPA 2011',
    'DPA 4011',
    'DPA 4015',
    'DPA 4017',
    'DPA 4017C',
    'DPA 4018',
    'DPA 4060',
    'DPA 4061',
    'DPA 4062',
    'DPA 4063',
    'DPA 4099',
    'DPA CORE 6060',
    'DPA CORE 6061',
    'DPA 5100',
    // Audio-Technica
    'Audio-Technica AT875R',
    'Audio-Technica AT897',
    'Audio-Technica AT8035',
    'Audio-Technica AT4053b',
    'Audio-Technica AT4021',
    'Audio-Technica AT4022',
    'Audio-Technica AT4040',
    'Audio-Technica AT4050',
    'Audio-Technica BP4025',
    'Audio-Technica BP4071',
    'Audio-Technica AT2020',
    // Shure
    'Shure VP82',
    'Shure VP89',
    'Shure SM7B',
    'Shure SM57',
    'Shure SM58',
    'Shure Beta 58A',
    'Shure KSM141',
    'Shure KSM137',
    'Shure MV88+',
    // AKG / Audio
    'AKG C414 XLII',
    'AKG C451 B',
    'AKG C568',
    'AKG Lyra',
    // Countryman / lavs
    'Countryman B3',
    'Countryman B6',
    'Countryman EMW',
    'Countryman IsoMax',
    'Sanken COS-11D',
    'Sanken CSS-50',
    'Sanken CS-3e',
    'Sanken CUB-01',
    // Deity / budget shotgun
    'Deity S-Mic 2',
    'Deity S-Mic 2S',
    'Deity V-Mic D3 Pro',
    'Deity V-Mic D4 Duo',
    'Deity W.Lav Pro',
    // Small diaphragm / field pairs
    'Line Audio CM3',
    'Line Audio CM4',
    'Line Audio OM1',
    'Line Audio OM1-S',
    'Clippy EM172',
    'Clippy EM272',
    'Primo EM172',
    'Primo EM272',
    'Primo EM200',
    'FEL Communications Clippy XLR',
    // Binaural / ambisonic capsules
    'Soundman OKM II Classic',
    'Soundman OKM II Rock',
    'Roland CS-10EM',
    'Hooke Verse',
    '3Dio Free Space',
    '3Dio Free Space XLR',
    'Core Sound TetraMic',
    'Sennheiser Ambeo Mic',
    'Zoom SSH-6',
    'Zoom XYH-5',
    'Zoom XYH-6',
    'Zoom MSH-6',
    'Zoom EXH-6',
    'Zoom Mid-Side Capsule',
    // Hydro / contact / geo
    'Aquarian Audio H2a',
    'Aquarian Audio H2d',
    'JrF Hydrophone',
    'AS-1 Hydrophone',
    'Ambient Recording Emesser',
    'Schwingungstechnik contact mic',
    'Barcus Berry Planar Wave',
    'Schertler DYN-G-P48',
    'Geospace GS-11D geophone',
    'Geospace GS-20DX geophone'
];

const GEAR_COMBO = {
    recorder: {
        inputId: 'add-recorder',
        listId: 'add-recorder-list',
        options: () => FIELD_RECORDERS,
        emptyLabel: 'Нет совпадений — можно вписать своё'
    },
    mic: {
        inputId: 'add-mic',
        listId: 'add-mic-list',
        options: () => FIELD_MICROPHONES,
        emptyLabel: 'Нет совпадений — можно вписать своё'
    }
};

const gearComboState = {
    openKey: null,
    activeIndex: -1,
    filtered: [],
    bound: false
};

function escHtml(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function normalizeGearQuery(q) {
    return String(q || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function filterGearOptions(options, query) {
    const q = normalizeGearQuery(query);
    let list;
    if (!q) list = options.slice();
    else {
        const starts = [];
        const contains = [];
        for (const opt of options) {
            const n = normalizeGearQuery(opt);
            if (n.startsWith(q)) starts.push(opt);
            else if (n.includes(q)) contains.push(opt);
        }
        list = starts.concat(contains);
    }
    const MAX = 60;
    return list.length > MAX ? list.slice(0, MAX) : list;
}

function getGearComboEls(key) {
    const cfg = GEAR_COMBO[key];
    if (!cfg) return null;
    const input = document.getElementById(cfg.inputId);
    const list = document.getElementById(cfg.listId);
    const wrap = input?.closest('.gear-combo');
    const control = wrap?.querySelector('.gear-combo__control');
    if (!input || !list || !control) return null;
    return { cfg, input, list, wrap, control };
}

function positionGearComboList(key) {
    const els = getGearComboEls(key);
    if (!els) return;
    const { input, list, control } = els;
    const rect = control.getBoundingClientRect();
    const vw = window.innerWidth || document.documentElement.clientWidth;
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const maxH = Math.min(280, Math.max(140, vh - 24));
    const spaceBelow = vh - rect.bottom - 10;
    const spaceAbove = rect.top - 10;
    const openUp = spaceBelow < 160 && spaceAbove > spaceBelow;
    const height = Math.min(maxH, openUp ? spaceAbove : spaceBelow);
    const width = Math.min(Math.max(rect.width, 220), vw - 16);
    let left = rect.left;
    if (left + width > vw - 8) left = Math.max(8, vw - width - 8);
    if (left < 8) left = 8;
    list.style.position = 'fixed';
    list.style.left = `${Math.round(left)}px`;
    list.style.width = `${Math.round(width)}px`;
    list.style.maxHeight = `${Math.round(Math.max(120, height))}px`;
    list.style.zIndex = '320';
    if (openUp) {
        list.style.top = 'auto';
        list.style.bottom = `${Math.round(vh - rect.top + 6)}px`;
    } else {
        list.style.bottom = 'auto';
        list.style.top = `${Math.round(rect.bottom + 6)}px`;
    }
    void input;
}

function renderGearComboList(key, { keepActive = false } = {}) {
    const els = getGearComboEls(key);
    if (!els) return;
    const { cfg, input, list } = els;
    const query = input.value;
    const filtered = filterGearOptions(cfg.options(), query);
    gearComboState.filtered = filtered;
    if (!keepActive) gearComboState.activeIndex = filtered.length ? 0 : -1;
    else if (gearComboState.activeIndex >= filtered.length) {
        gearComboState.activeIndex = filtered.length ? filtered.length - 1 : -1;
    }

    const qNorm = normalizeGearQuery(query);
    const exact = filtered.some((o) => normalizeGearQuery(o) === qNorm);
    const custom = qNorm && !exact ? String(query).trim() : '';

    if (!filtered.length && !custom) {
        list.innerHTML = `<div class="gear-combo__empty">${escHtml(cfg.emptyLabel)}</div>`;
        return;
    }

    const items = filtered.map((opt, i) => {
        const active = i === gearComboState.activeIndex ? ' is-active' : '';
        return `<button type="button" class="gear-combo__option${active}" role="option" data-idx="${i}" data-value="${escHtml(opt)}" aria-selected="${i === gearComboState.activeIndex ? 'true' : 'false'}">${escHtml(opt)}</button>`;
    }).join('');

    const customRow = custom
        ? `<button type="button" class="gear-combo__option gear-combo__option--custom${gearComboState.activeIndex < 0 ? ' is-active' : ''}" role="option" data-custom="1" data-value="${escHtml(custom)}">
            <span class="gear-combo__option-kicker">Своё значение</span>
            <span class="gear-combo__option-label">${escHtml(custom)}</span>
           </button>`
        : '';

    list.innerHTML = customRow + items;
    // Event delegation — one listener, not N per option
    if (!list._gearComboDelegated) {
        list._gearComboDelegated = true;
        list.addEventListener('mousedown', (e) => {
            if (e.target?.closest?.('.gear-combo__option')) e.preventDefault();
        });
        list.addEventListener('click', (e) => {
            const btn = e.target?.closest?.('.gear-combo__option');
            if (!btn) return;
            const openKey = gearComboState.openKey;
            if (!openKey) return;
            pickGearComboValue(openKey, btn.getAttribute('data-value') || '');
        });
    }

    const activeBtn = list.querySelector('.gear-combo__option.is-active');
    if (activeBtn && typeof activeBtn.scrollIntoView === 'function') {
        activeBtn.scrollIntoView({ block: 'nearest' });
    }
}

function mountGearComboList(key, list, control) {
    if (!list || !control) return;
    if (!list._gearComboHome) {
        list._gearComboHome = { parent: control, next: list.nextSibling };
    }
    if (list.parentElement !== document.body) {
        document.body.appendChild(list);
    }
}

function unmountGearComboList(list) {
    if (!list?._gearComboHome) return;
    const { parent, next } = list._gearComboHome;
    if (!parent || list.parentElement === parent) return;
    if (next && next.parentNode === parent) parent.insertBefore(list, next);
    else parent.appendChild(list);
}

function setGearComboOpen(key, open) {
    const els = getGearComboEls(key);
    if (!els) return;
    const { input, list, wrap, control } = els;
    if (open) {
        if (gearComboState.openKey && gearComboState.openKey !== key) {
            setGearComboOpen(gearComboState.openKey, false);
        }
        gearComboState.openKey = key;
        mountGearComboList(key, list, control);
        list.hidden = false;
        list.classList.remove('hidden');
        wrap?.classList.add('is-open');
        input.setAttribute('aria-expanded', 'true');
        renderGearComboList(key);
        positionGearComboList(key);
    } else {
        if (gearComboState.openKey === key) gearComboState.openKey = null;
        list.hidden = true;
        list.classList.add('hidden');
        wrap?.classList.remove('is-open');
        input.setAttribute('aria-expanded', 'false');
        gearComboState.activeIndex = -1;
        gearComboState.filtered = [];
        unmountGearComboList(list);
    }
}

function pickGearComboValue(key, value) {
    const els = getGearComboEls(key);
    if (!els) return;
    els.input.value = value;
    els.input.dispatchEvent(new Event('input', { bubbles: true }));
    els.input.dispatchEvent(new Event('change', { bubbles: true }));
    setGearComboOpen(key, false);
    if (key === 'recorder' || key === 'mic') {
        if (typeof window.syncSmartphoneRecordingFromFields === 'function') {
            window.syncSmartphoneRecordingFromFields();
        }
    }
}

export function closeGearCombo(key) {
    if (key) setGearComboOpen(key, false);
    else if (gearComboState.openKey) setGearComboOpen(gearComboState.openKey, false);
}

export function toggleGearCombo(key) {
    const open = gearComboState.openKey !== key;
    setGearComboOpen(key, open);
    if (open) {
        const els = getGearComboEls(key);
        els?.input.focus();
    }
}

function onGearComboKeydown(key, e) {
    const els = getGearComboEls(key);
    if (!els) return;
    const isOpen = gearComboState.openKey === key;

    if (e.key === 'Escape') {
        if (isOpen) {
            e.preventDefault();
            setGearComboOpen(key, false);
        }
        return;
    }

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!isOpen) {
            setGearComboOpen(key, true);
            return;
        }
        const count = gearComboState.filtered.length;
        if (!count) return;
        if (e.key === 'ArrowDown') {
            gearComboState.activeIndex = (gearComboState.activeIndex + 1) % count;
        } else {
            gearComboState.activeIndex = gearComboState.activeIndex <= 0
                ? count - 1
                : gearComboState.activeIndex - 1;
        }
        renderGearComboList(key, { keepActive: true });
        return;
    }

    if (e.key === 'Enter' && isOpen) {
        const idx = gearComboState.activeIndex;
        if (idx >= 0 && gearComboState.filtered[idx]) {
            e.preventDefault();
            pickGearComboValue(key, gearComboState.filtered[idx]);
        } else {
            setGearComboOpen(key, false);
        }
    }
}

function bindGearCombosOnce() {
    if (gearComboState.bound) return;
    gearComboState.bound = true;
    let repositionRaf = 0;
    const scheduleReposition = () => {
        if (!gearComboState.openKey) return;
        if (repositionRaf) return;
        repositionRaf = requestAnimationFrame(() => {
            repositionRaf = 0;
            if (gearComboState.openKey) positionGearComboList(gearComboState.openKey);
        });
    };

    Object.keys(GEAR_COMBO).forEach((key) => {
        const els = getGearComboEls(key);
        if (!els) return;
        const { input } = els;
        // Open on typing / arrows / toggle — not on mere focus (avoids lag when tabbing fields)
        input.addEventListener('input', () => {
            if (gearComboState.openKey !== key) setGearComboOpen(key, true);
            else {
                renderGearComboList(key);
                positionGearComboList(key);
            }
            if (key === 'recorder' || key === 'mic') {
                if (typeof window.syncSmartphoneRecordingFromFields === 'function') {
                    window.syncSmartphoneRecordingFromFields();
                }
            }
        });
        input.addEventListener('keydown', (e) => onGearComboKeydown(key, e));
        input.addEventListener('blur', () => {
            setTimeout(() => {
                if (document.activeElement === input) return;
                if (gearComboState.openKey === key) setGearComboOpen(key, false);
            }, 120);
        });
    });

    document.addEventListener('click', (e) => {
        const openKey = gearComboState.openKey;
        if (!openKey) return;
        const t = e.target;
        if (t?.closest?.(`[data-gear-combo="${openKey}"]`)) return;
        if (t?.closest?.(`#${GEAR_COMBO[openKey].listId}`)) return;
        setGearComboOpen(openKey, false);
    });

    document.addEventListener('click', (e) => {
        const btn = e.target?.closest?.('[data-gear-combo-toggle]');
        if (!btn) return;
        e.preventDefault();
        const key = btn.getAttribute('data-gear-combo-toggle');
        if (key) toggleGearCombo(key);
    });

    window.addEventListener('resize', scheduleReposition, { passive: true });

    document.addEventListener('scroll', (e) => {
        if (!gearComboState.openKey) return;
        const list = document.getElementById(GEAR_COMBO[gearComboState.openKey]?.listId);
        if (list && e.target && (list === e.target || list.contains(e.target))) return;
        scheduleReposition();
    }, true);
}

/** Init / refresh gear comboboxes (recorder + mic). Keeps free-text entry. */
export function fillGearDatalists() {
    bindGearCombosOnce();
    Object.keys(GEAR_COMBO).forEach((key) => {
        const els = getGearComboEls(key);
        if (!els) return;
        els.wrap?.classList.add('gear-combo--ready');
        if (gearComboState.openKey === key) {
            renderGearComboList(key);
            positionGearComboList(key);
        }
    });
}

export function isSmartphoneGear(gear, mic) {
    const g = String(gear || '').trim().toLowerCase();
    const m = String(mic || '').trim().toLowerCase();
    if (g === 'smartphone' || g === 'смартфон') return true;
    if (m === 'интегрированный' || m === 'интегрированные') return true;
    return false;
}

if (typeof window !== 'undefined') {
    window.FIELD_RECORDERS = FIELD_RECORDERS;
    window.FIELD_MICROPHONES = FIELD_MICROPHONES;
    window.fillGearDatalists = fillGearDatalists;
    window.toggleGearCombo = toggleGearCombo;
    window.closeGearCombo = closeGearCombo;
    window.isSmartphoneGear = isSmartphoneGear;
}
