export const ucsStructure = {
    'AMBIENCE': [{ id: 'AMBAbnd', name: 'AMBAbnd (Заброшенное)' }, { id: 'AMBCity', name: 'AMBCity (Город)' }, { id: 'AMBInds', name: 'AMBInds (Индустрия)' }, { id: 'AMBMarkt', name: 'AMBMarkt (Рынок)' }, { id: 'AMBNatr', name: 'AMBNatr (Природа)' }, { id: 'AMBPark', name: 'AMBPark (Парк)' }, { id: 'AMBRoom', name: 'AMBRoom (Комната)' }, { id: 'AMBStrt', name: 'AMBStrt (Улица)' }, { id: 'AMBUrba', name: 'AMBUrba (Урбанистика)' }],
    'WATER': [{ id: 'WATRBubl', name: 'WATRBubl (Пузыри)' }, { id: 'WATRDrop', name: 'WATRDrop (Капли)' }, { id: 'WATRSplsh', name: 'WATRSplsh (Всплеск)' }, { id: 'WATRFlow', name: 'WATRFlow (Поток)' }],
    'WEATHER': [{ id: 'WETHRain', name: 'WETHRain (Дождь)' }, { id: 'WETHThun', name: 'WETHThun (Гром)' }, { id: 'WETHWind', name: 'WETHWind (Ветер-Шторм)' }],
    'ANIMALS': [{ id: 'ANMDmst', name: 'ANMDmst (Домашние)' }, { id: 'ANMFarm', name: 'ANMFarm (Фермерские)' }, { id: 'ANMWild', name: 'ANMWild (Дикие)' }, { id: 'ANMBrd', name: 'ANMBrd (Птицы)' }, { id: 'ANMIns', name: 'ANMIns (Насекомые)' }],
    'HUMAN': [{ id: 'HUMCrwd', name: 'HUMCrwd (Толпа)' }, { id: 'HUMVoc', name: 'HUMVoc (Голос)' }, { id: 'HUMMvmt', name: 'HUMMvmt (Движение)' }],
    'INDUSTRIAL': [{ id: 'INDMchn', name: 'INDMchn (Машины/Станки)' }, { id: 'INDFctry', name: 'INDFctry (Фабрика/Завод)' }, { id: 'INDTool', name: 'INDTool (Инструмент)' }],
    'VEHICLES': [{ id: 'VEHCar', name: 'VEHCar (Автомобиль)' }, { id: 'VEHTrc', name: 'VEHTrc (Грузовик)' }, { id: 'VEHTrn', name: 'VEHTrn (Поезд)' }, { id: 'VEHAir', name: 'VEHAir (Воздушное судно)' }, { id: 'VEHBoat', name: 'VEHBoat (Лодка)' }]
};

export const sourceIdMap = {
    'Mono': 'MONO', 'Stereo XY': 'XY', 'Stereo ORTF': 'ORTF', 'Stereo AB': 'AB', 
    'Stereo M/S': 'MS', 'Ambisonics': 'AMBI', 'Binaural': 'BINA'
};

export const translations = {
    ru: {
        title: "Ростовская область", subtitle: "Аудиокарта", search_placeholder: "Поиск звуков...",
        filter_tab_ucs: "Библиотека", filter_tab_tags: "Теги", filter_tab_meta: "Параметры", 
        ucs_category: "Категория (UCS)", ucs_sub: "Субкатегория (CatID)", ucs_layer: "Слои аудиоландшафта", ucs_block_title: "Классификация по стандарту UCS",
        meta_gear: "Рекордер", meta_channels: "Система / Каналы", meta_license: "Лицензия", meta_recordist: "Автор", meta_weather: "Погода", meta_date: "Дата", mic_type: "Микрофон", meta_principle: "Принцип записи",
        filter_geophony: "Геофония", filter_biophony: "Биофония", filter_anthrophony: "Антропофония",
        settings_title: "Настройки", gui_scale: "Масштаб интерфейса", theme: "Тема оформления", map_style: "Стиль карты (Фильтр)", map_normal: "Стандарт", map_mono: "Монохром", language: "Язык", close: "Закрыть",
        add_audio_title: "Добавить аудио", drag_drop: "Нажмите или перетащите аудиофайл (.wav)", display_title: "Отображаемое название (Внутреннее)", sound_desc: "Описание звука", file_name: "Имя файла (UCS)", file_name_ucs: "Сгенерированное имя файла (UCS)", keywords: "Свободные теги (через запятую)", add_photo: "Прикрепить фото (до 3-х шт.)", user_defined: "Описание для файла (UserDefined)",
        location: "Локация", coords: "Координаты", date: "Дата", time: "Время", weather: "Погода", datetime: "Дата и Время",
        rec_model: "Рекордер", format: "Формат", channels: "Каналы", recordist: "Автор", license: "Лицензия", publish: "Опубликовать",
        rec_prefix: "Rec: ", coords_prefix: "Координаты: ", gear_prefix: "Оборудование: ",
        err_no_audio: "Ошибка загрузки файла. Режим симуляции.", err_publish: "Функция загрузки будет доступна позже.",
        success_publish: "Аудио успешно добавлено на карту!", audio_loaded: "Аудиофайл загружен", select_audio: "Пожалуйста, выберите аудиофайл",
        comments: "Комментарии", comment_placeholder: "Оставьте комментарий...", send: "Отправить", no_comments: "Пока нет комментариев. Будьте первым!",
        moderation_notice: "Данные сохраняются в Яндекс.Облако", meta_embedded: "Координаты {coords} успешно вшиты в метаданные файла.", soundwalk_notice: "Маршрут звуковой прогулки", ambisonics_pan: "Вращение 360°",
        analyzers_title: "Анализаторы", goniometer_title: "Гониометр (Стереокартина)", frequency_analyzer_title: "Частотный анализатор", loudness_meter: "Loudness Meter",
        admin_login: "Вход для администратора", admin_panel: "Админ-панель", password_prompt: "Введите пароль администратора:", wrong_password: "Неверный пароль!", delete_confirm: "Вы уверены, что хотите удалить этот звук?",
        close_confirm: "Вы уверены, что хотите закрыть? Введенные данные не сохранятся.", edit_audio: "Редактировать аудио", save_changes: "Сохранить изменения",
        add_here_title: "Новая метка", add_here_msg: "Создать аудиометку по координатам", create: "Создать", cancel: "Отмена"
    },
    en: {
        title: "Rostov Region", subtitle: "Audio Map", search_placeholder: "Search sounds...",
        filter_tab_ucs: "Library", filter_tab_tags: "Tags", filter_tab_meta: "Params",
        ucs_category: "Category (UCS)", ucs_sub: "Subcategory (CatID)", ucs_layer: "Soundscape Layers", ucs_block_title: "UCS Classification",
        meta_gear: "Recorder", meta_channels: "System / Channels", meta_license: "License", meta_recordist: "Recordist", meta_weather: "Weather", meta_date: "Date", mic_type: "Microphone", meta_principle: "Recording Principle",
        filter_geophony: "Geophony", filter_biophony: "Biophony", filter_anthrophony: "Anthrophony",
        settings_title: "Settings", gui_scale: "Interface Scale", theme: "Visual Theme", map_style: "Map Style (Filter)", map_normal: "Default", map_mono: "Monochrome", language: "Language", close: "Close",
        add_audio_title: "Add Audio", drag_drop: "Click or drag audio file here (.wav)", display_title: "Display Title (Internal)", sound_desc: "Sound Description", file_name: "File Name (UCS)", file_name_ucs: "Generated File Name (UCS)", keywords: "Free tags (comma separated)", add_photo: "Attach photos (up to 3)", user_defined: "UCS UserDefined (Location and subject)",
        location: "Location", coords: "Coordinates", date: "Date", time: "Time", weather: "Weather", datetime: "Date & Time",
        rec_model: "Recorder Model", format: "Format", channels: "Channels", recordist: "Recordist", license: "License", publish: "Publish Sound",
        rec_prefix: "Rec: ", coords_prefix: "Coordinates: ", gear_prefix: "Gear: ",
        err_no_audio: "Audio load error. Simulation mode.", err_publish: "Upload feature will be available later.",
        success_publish: "Sound added to map successfully!", audio_loaded: "Audio file loaded", select_audio: "Please select an audio file",
        comments: "Comments", comment_placeholder: "Leave a comment...", send: "Send", no_comments: "No comments yet. Be the first!",
        moderation_notice: "Data is saved to Yandex Cloud", meta_embedded: "Coordinates {coords} embedded successfully into file metadata.", soundwalk_notice: "Soundwalk Route", ambisonics_pan: "360° Rotation",
        analyzers_title: "Analyzers", goniometer_title: "Goniometer (Stereo Image)", frequency_analyzer_title: "Frequency Analyzer", loudness_meter: "Loudness Meter",
        admin_login: "Admin Login", admin_panel: "Admin Panel", password_prompt: "Enter admin password:", wrong_password: "Wrong password!", delete_confirm: "Are you sure you want to delete this sound?",
        close_confirm: "Are you sure you want to close? Data will be lost.", edit_audio: "Edit Audio", save_changes: "Save Changes",
        add_here_title: "New Marker", add_here_msg: "Create audio marker at coordinates", create: "Create", cancel: "Cancel"
    }
};