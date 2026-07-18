/**
 * Field recorders (decks only) and microphones for add-sound datalists.
 * Mic list starts with «Интегрированные» (priority / smartphone built-in).
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

export function fillGearDatalists() {
    const recList = document.getElementById('datalist-recorders');
    const micList = document.getElementById('datalist-mics');
    if (recList) {
        recList.innerHTML = FIELD_RECORDERS.map((v) => `<option value="${String(v).replace(/"/g, '&quot;')}"></option>`).join('');
        recList.dataset.filled = '1';
    }
    if (micList) {
        // «Интегрированные» already first — keep order stable for priority
        micList.innerHTML = FIELD_MICROPHONES.map((v) => `<option value="${String(v).replace(/"/g, '&quot;')}"></option>`).join('');
        micList.dataset.filled = '1';
    }
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
    window.isSmartphoneGear = isSmartphoneGear;
}
