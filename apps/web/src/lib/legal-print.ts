import { LEGAL_DOCS, LEGAL_DOCS_VERSION, renderLegalDocHtml } from '../../../../src/data/legalDocs.js';
import { PUBLISH_RULES_VERSION, renderPublishRulesHtml } from '../../../../src/data/publishRules.js';

function esc(s: unknown) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function downloadLegalPrint(docId: 'privacy' | 'terms' | 'publish') {
  let title = 'Документ';
  let version = '';
  let bodyHtml = '';
  if (docId === 'publish') {
    title = 'Правила Полёвки';
    version = PUBLISH_RULES_VERSION || '';
    bodyHtml = renderPublishRulesHtml();
  } else {
    const doc = LEGAL_DOCS[docId];
    title = doc?.title || (docId === 'terms' ? 'Пользовательское соглашение' : 'Политика конфиденциальности');
    version = doc?.version || LEGAL_DOCS_VERSION || '';
    bodyHtml = renderLegalDocHtml(docId);
  }
  if (!bodyHtml) return false;
  const w = window.open('', '_blank', 'noopener,noreferrer');
  if (!w) return false;
  w.document.write(`<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  body{font-family:Georgia,'Times New Roman',serif;max-width:720px;margin:2rem auto;padding:0 1.25rem;color:#111;line-height:1.55}
  h1{font-size:1.5rem;margin:0 0 .35rem} .ver{color:#666;font-size:.85rem;margin-bottom:1.5rem}
  .publish-rule-section{margin:1.25rem 0}
  .publish-rule-section__title{font-size:1.05rem;margin:0 0 .5rem;border-bottom:1px solid #ddd;padding-bottom:.25rem}
  .publish-rule-section__intro{color:#444;font-style:italic;margin:0 0 .75rem;font-size:.92rem}
  .publish-rule-item{margin:.75rem 0}
  .publish-rule-item__title{font-size:.95rem;margin:0 0 .25rem}
  .publish-rule-item__code{font-family:ui-monospace,Consolas,monospace;color:#444;margin-right:.35rem}
  .publish-rule-item__body{margin:0;font-size:.92rem}
  @media print{body{margin:0;max-width:none}}
</style></head><body>
<h1>${esc(title)}</h1>
${version ? `<p class="ver">Версия ${esc(version)}</p>` : ''}
${bodyHtml}
<script>window.onload=function(){setTimeout(function(){window.print()},200)}<\/script>
</body></html>`);
  w.document.close();
  return true;
}
