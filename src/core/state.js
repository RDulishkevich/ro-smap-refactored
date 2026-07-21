import { sourceIdMap, translations } from '../data/dict.js';
import { ucsStructure, ucsByCatId, ucsCategories } from '../data/ucsCatalog.js';
import { transliterate, rawSoundsData, formatSoundObject } from '../data/sounds.js';

export function initGlobalState() {
    // 1. Прокидываем данные и словари в глобальную область
    window.ucsStructure = ucsStructure;
    window.ucsByCatId = ucsByCatId;
    window.ucsCategories = ucsCategories;
    window.sourceIdMap = sourceIdMap;
    window.translations = translations;
    window.transliterate = transliterate;
    window.rawSoundsData = rawSoundsData;
    window.formatSoundObject = formatSoundObject;
    
    // 2. Константы Облака
    // YANDEX_FUNCTION_URL — Secure API (auth + sync + email verification). См. cloud/api/README.md
    // YANDEX_EMAIL_FUNCTION_URL — optional override; основной путь — Secure API requestEmailVerification
    window.YANDEX_BUCKET_URL = 'https://storage.yandexcloud.net/rosmap2026';
    window.YANDEX_FUNCTION_URL = 'https://functions.yandexcloud.net/d4ebp9rd7rd53iso4p8u';
    window.YANDEX_EMAIL_FUNCTION_URL = '';
    window.cloudDataCache = [];
    window.profilesData = [];
    window.mailData = [];
    window.feedPosts = [];
    window.__lastFeedPollKey = '';
    window.eventsData = [];
    window.__lastEventsPollKey = '';
    window.__lastMailPollKey = '';
    window.__secureApiEnabled = true;

    // 3. Состояния плеера и приложения
    window.map = null;
    window.markerClusterer = null;
    window.currentPlayingId = null;
    window.isPlaying = false;
    window.animationFrameId = null;
    window.currentLang = 'ru';
    window.currentTheme = 'light';
    window.currentPalette = 'coral';
    window.currentMapStyle = 'normal';
    window.currentMapProvider = 'yandex';
    try {
        const savedProvider = localStorage.getItem('rosmap_map_provider');
        if (savedProvider) {
            window.currentMapProvider = savedProvider;
        }
    } catch (_) {}
    try {
        window.DGIS_API_KEY = localStorage.getItem('rosmap_dgis_key') || '';
        window.GOOGLE_MAPS_API_KEY = localStorage.getItem('rosmap_google_maps_key') || '';
    } catch (_) {
        window.DGIS_API_KEY = '';
        window.GOOGLE_MAPS_API_KEY = '';
    }
    window.mockInterval = null;
    window.simulatedTime = 0;
    window.simulatedDuration = 120;
            
    // 4. Фильтры
    window.activeEcoLayer = new Set(); window.activeUcsCat = new Set(); window.activeUcsSub = new Set(); window.activeGenTags = new Set();
    window.activeGear = new Set(); window.activeChannels = new Set(); window.activeLicense = new Set(); window.activeRecordist = new Set();
    window.activeWeather = new Set(); window.activeDate = new Set(); window.activeMic = new Set(); window.activePrinciple = new Set(); 
    window.__sidebarTab = 'library';
    window.activeSessionId = null;

    window.allExtractedEcoLayers = new Set(); window.allExtractedUcsCats = new Set(); window.allExtractedTags = new Set();
    window.allExtractedSubcats = new Set(); window.allExtractedGears = new Set(); window.allExtractedChannels = new Set();
    window.allExtractedLicenses = new Set(); window.allExtractedRecordists = new Set(); window.allExtractedWeathers = new Set();
    window.allExtractedDates = new Set(); window.allExtractedMics = new Set(); window.allExtractedPrinciples = new Set();

    // 5. Загрузка и модалки
    window.currentUploadedFileUrl = '';
    window.currentUploadedFile = null; 
    window.pendingImages = []; 
    window.addModalMap = null;
    window.addModalPlacemark = null;
    window.activePolyline = null;
    window.walkerMarker = null;
    window.walkerLayout = null;
    window.addModalRoute = [];
    window.addModalPolyline = null;
    window.editingSoundId = null;
    window.openedFromAdmin = false;

    // 6. Аудио-контекст и Ambisonics
    window.audioContext = null;
    window.foaDecoder = null;
    window.audioElementSource = null;
    window.gainNode = null;
    window.stereoPannerNode = null;
    window.analyserNode = null;
    window.channelSplitter = null;
    window.channelAnalysers = [];
    window.meterChannelCount = 2;
    window.currentChannelLayout = null;
    window.loudnessPeaks = [];
    window.loudnessPeakHold = [];
    window.omnitoneInitialized = false;
    window.isAmbisonicMode = false;
    window.analyzersOpen = false;
    window.currentStereoPan = 0;
    window.analyzerFrameId = null;
    window._normalAudioRouted = false;
    window._ambiAudioRouted = false;
    window.compassAngle = 0;
    window.isDraggingCompass = false;
    window.lastVolume = 1;
}