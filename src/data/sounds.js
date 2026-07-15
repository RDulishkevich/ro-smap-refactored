import { sourceIdMap } from './dict.js';

export const transliterate = function(word) {
    const a = {"Ё":"Yo","Й":"I","Ц":"Ts","У":"U","К":"K","Е":"E","Н":"N","Г":"G","Ш":"Sh","Щ":"Sch","З":"Z","Х":"H","Ъ":"","ё":"yo","й":"i","ц":"ts","у":"u","к":"k","е":"e","н":"n","г":"g","ш":"sh","щ":"sch","з":"z","х":"h","ъ":"","Ф":"F","Ы":"I","В":"V","А":"A","П":"P","Р":"R","О":"O","Л":"L","Д":"D","Ж":"Zh","Э":"E","ф":"f","ы":"i","в":"v","а":"a","п":"p","р":"r","о":"o","л":"l","д":"d","ж":"zh","э":"e","Я":"Ya","Ч":"Ch","С":"S","М":"M","И":"I","Т":"T","Ь":"","Б":"B","Ю":"Yu","я":"ya","ч":"ch","с":"s","м":"m","и":"i","т":"t","ь":"","б":"b","ю":"yu", " ":"_"};
    return word.split('').map(char => a[char] || char).join('').replace(/[^a-zA-Z0-9_]/g, '');
}

export const rawSoundsData = [
    { 
        id: 'r0', 
        title: 'Тестовый Ambisonic', 
        ecoCategory: 'anthrophony', 
        ucsCat: 'AMBIENCE', 
        lat: 47.23371, 
        lng: 39.74427, 
        duration: '0:35', 
        url: 'https://archive.org/download/260613-001-test/260613_001_Test.wav', 
        typeTag: 'AMBCity', 
        semanticTag: 'Urban Life', 
        gear: 'Zoom H3-VR', 
        date: '14 дек. 2023 г.', 
        description: 'Тестовая 4-х канальная B-format амбисоник-запись. Направленная фиксация. Запустите аудио, включите режим 360° в плеере и покрутите компас для вращения звука (требуются наушники).', 
        comments: [], 
        keywords: 'Test, Ambisonics, 360, Street', 
        micType: 'Ambisonic', 
        recPrinciple: 'Направленная фиксация (Spot)', 
        channels: 'Ambisonics', 
        weather: 'Облачно (Cloudy)'
    },
    { id: 'r1', title: 'Набережная Дона', ecoCategory: 'geophony', ucsCat: 'WATER', lat: 47.2130, lng: 39.7150, duration: '1:08', url: '', typeTag: 'WATRFlow', semanticTag: 'Nature', gear: 'Tascam DR-40X', date: '21 авг. 2023 г.', description: 'Ритмичный плеск волн великой реки Дон о бетонную набережную Ростова.', comments: [{author: 'Анна', text: 'Очень успокаивает, спасибо!', date: '12.10.2023'}], keywords: 'River, Waves, Night', micType: 'Sennheiser NTG3', recPrinciple: 'Направленная фиксация (Spot)', channels: 'Stereo AB', weather: 'Ясно (Clear)' },
    { id: 'r2', title: 'Центральный рынок', ecoCategory: 'anthrophony', ucsCat: 'AMBIENCE', lat: 47.2173, lng: 39.7083, duration: '2:12', url: '', typeTag: 'AMBMarkt', semanticTag: 'Trade Identity', gear: 'Zoom F6', date: '04 июн. 2023 г.', description: 'Пульс Ростова. Шумный Старый базар утром.', keywords: 'Crowd, Voices, Morning, Market', micType: 'Lavalier', recPrinciple: 'Звуковая прогулка (Soundwalk)', channels: 'Binaural', weather: 'Ясно (Clear)', route: [[47.2173, 39.7083], [47.2180, 39.7085], [47.2185, 39.7090], [47.2180, 39.7100], [47.2170, 39.7095]] },
    { id: 'r3', title: 'Завод Ростсельмаш', ecoCategory: 'anthrophony', ucsCat: 'INDUSTRIAL', lat: 47.2600, lng: 39.7600, duration: '0:45', url: '', typeTag: 'INDMchn', semanticTag: 'Industry', gear: 'Rode NTG4+', date: '15 сен. 2023 г.', description: 'Индустриальный звуковой ландшафт.', keywords: 'Machines, Metal, Factory, Heavy', micType: 'Shotgun', recPrinciple: 'Направленная фиксация (Spot)', channels: 'Mono', weather: 'Облачно (Cloudy)' },
    { id: 'r4', title: 'Парк Горького', ecoCategory: 'anthrophony', ucsCat: 'AMBIENCE', lat: 47.2210, lng: 39.7020, duration: '1:45', url: '', typeTag: 'AMBPark', semanticTag: 'Leisure', gear: 'Zoom H5', date: '12 мая 2023 г.', description: 'Спокойная атмосфера центрального парка.', keywords: 'Park, Birds, Wind, Children', micType: 'Rode NT4', recPrinciple: 'Оставленный рекордер (Drop rig)', channels: 'Stereo XY', weather: 'Ясно (Clear)' },
    { id: 'r5', title: 'Улица Пушкинская', ecoCategory: 'anthrophony', ucsCat: 'AMBIENCE', lat: 47.2260, lng: 39.7180, duration: '1:30', url: '', typeTag: 'AMBCity', semanticTag: 'Urban Life', gear: 'Binaural Mic', date: '02 окт. 2023 г.', description: 'Прогулка по пешеходной зоне.', keywords: 'Steps, Street, Leaves, Walk', micType: 'Soundman OKM II', recPrinciple: 'Звуковая прогулка (Soundwalk)', channels: 'Ambisonics', weather: 'Ветер (Wind)', route: [[47.2260, 39.7180], [47.2265, 39.7200], [47.2270, 39.7220], [47.2275, 39.7240]] }
];

export const formatSoundObject = function(s) {
    const keywordsStr = s.keywords || `soundscape, rostov`;
    const tagsList = keywordsStr.split(',').map(t => t.trim()).filter(Boolean);
    const cleanTitle = transliterate(s.title || 'Sound').substring(0, 20);
    const cleanRecordist = transliterate(s.recordist || 'Ivan').replace(/\s+/g, '');
    const mappedSourceID = sourceIdMap[s.channels] || 'ST';
    return {
        ...s,
        time: s.time || '14:30',
        weather: s.weather || 'Ясно (Clear)',
        micType: s.micType || 'Stereo Pair',
        recPrinciple: s.recPrinciple || 'Направленная фиксация (Spot)',
        format: s.format || 'WAV 96kHz / 24-bit',
        channels: s.channels || 'Stereo XY',
        fileName: s.fileName || `${s.typeTag}_${cleanTitle}_${cleanRecordist}_${mappedSourceID}.wav`,
        recordist: s.recordist || 'Автор',
        license: s.license || 'CC BY 4.0',
        keywords: keywordsStr,
        tagArray: tagsList,
        comments: s.comments || [],
        images: s.images || [] 
    };
};