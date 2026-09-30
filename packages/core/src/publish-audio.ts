import { buildUcsFileName, embedWavMetadataBuffer, ensureWavUploadFile } from './catalogs';

export type PublishWavMeta = {
  title?: string;
  description?: string;
  location?: string;
  recordist?: string;
  catId?: string;
  fxName?: string;
  creatorId?: string;
  sourceId?: string;
  channels?: string;
  ucsCategory?: string;
  ucsSubCategory?: string;
};

export async function preparePublishWav(
  blob: Blob,
  originalName: string,
  meta: PublishWavMeta,
): Promise<{ blob: Blob; fileName: string; formatLabel: string; converted: boolean; sampleRate: number; channels: number }> {
  const file = new File([blob], originalName || 'audio.wav', { type: blob.type || 'audio/wav' });
  const wav = await ensureWavUploadFile(file) as {
    file: File;
    formatLabel: string;
    converted: boolean;
    sampleRate: number;
    channels: number;
  };
  const ucsName = buildUcsFileName({
    catId: meta.catId || 'AMBMisc',
    fxName: meta.fxName || meta.title || 'Untitled',
    creatorId: meta.creatorId || meta.recordist || 'Anon',
    sourceId: meta.sourceId || 'NONE',
    channels: meta.channels,
    location: meta.location,
  }) as string;
  const buf = await wav.file.arrayBuffer();
  let out: ArrayBuffer = buf;
  try {
    out = embedWavMetadataBuffer(buf, {
      title: meta.title,
      description: meta.description,
      artist: meta.recordist,
      comment: meta.location,
      originator: meta.creatorId || meta.recordist,
      originatorReference: ucsName.replace(/\.wav$/i, ''),
      category: meta.ucsCategory,
      subcategory: meta.ucsSubCategory,
      fxName: meta.fxName || meta.title,
    }) as ArrayBuffer;
  } catch {
    out = buf;
  }
  return {
    blob: new Blob([out], { type: 'audio/wav' }),
    fileName: ucsName,
    formatLabel: wav.formatLabel,
    converted: wav.converted,
    sampleRate: wav.sampleRate,
    channels: wav.channels,
  };
}
