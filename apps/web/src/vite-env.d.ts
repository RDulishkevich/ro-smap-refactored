/// <reference types="vite/client" />

declare module '../../../../src/data/legalDocs.js' {
  export const LEGAL_DOCS: Record<string, {
    title: string;
    sections: Array<{ title: string; items?: Array<{ title: string; body: string }> }>;
  }>;
}

declare module '../../../../src/data/publishRules.js' {
  export const PUBLISH_RULE_SECTIONS: Array<{
    title: string;
    items?: Array<{ title: string; body: string }>;
  }>;
}
