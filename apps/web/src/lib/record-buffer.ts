export type DraftRecording = { blob: Blob; durationSec: number; mime: string };

let draft: DraftRecording | null = null;

export function setDraftRecording(next: DraftRecording | null) {
  draft = next;
}

export function getDraftRecording() {
  return draft;
}
