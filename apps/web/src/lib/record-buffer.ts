import type { TimeMarker } from '@polevka/core';

export type DraftRecording = {
  blob: Blob;
  durationSec: number;
  mime: string;
  trimStart?: number;
  trimEnd?: number;
  gain?: number;
  timeMarkers?: TimeMarker[];
};

let draft: DraftRecording | null = null;

export function setDraftRecording(next: DraftRecording | null) {
  draft = next;
}

export function getDraftRecording() {
  return draft;
}
