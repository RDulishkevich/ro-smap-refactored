// @ts-nocheck — vanilla UCS/WAV/gear modules remain the source of truth until a later TS port.
export {
  ucsStructure,
  ucsByCatId,
  ucsCategories,
} from '../../../src/data/ucsCatalog.js';
export {
  FIELD_RECORDERS,
  FIELD_MICROPHONES,
} from '../../../src/data/gearCatalog.js';
export {
  ensureWavUploadFile,
  formatWavLabel,
  readWavFormatInfo,
  audioBufferToWav,
} from '../../../src/core/audioConvert.js';
export {
  embedWavMetadataBuffer,
} from '../../../src/core/wavMeta.js';
export {
  buildUcsFileName,
  sanitizeFxName,
  resolveProjectSourceId,
  UCS_PLATFORM_ID,
} from '../../../src/core/ucsName.js';
