/** Fixed script run in an isolated world; no page strings are interpolated into code. */
export const EXTRACT_PAGE_SCRIPT = `(() => {
  if (document.contentType !== 'text/html' && document.contentType !== 'text/plain') throw new Error('PDF e outros documentos ainda não têm extração disponível.');
  if (document.querySelector('input[type=password],meta[name="moon-sensitive"][content="true"]')) throw new Error('Página marcada como sensível.');
  const root = document.querySelector('article,main,[role=main]') || document.body;
  if (!root) return {text:'',truncated:false};
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const parts=[]; let total=0; let visited=0; let node;
  while ((node=walker.nextNode()) && visited++ < 20000) {
    const parent=node.parentElement;
    if (!parent || parent.closest('script,style,noscript,form,input,textarea,select,[contenteditable],nav,header,footer,[hidden],[aria-hidden=true]')) continue;
    if (!parent.getClientRects().length || getComputedStyle(parent).visibility === 'hidden') continue;
    const text=node.textContent.trim();
    if (!text) continue;
    parts.push(text.slice(0,60000-total)); total += text.length + 1;
    if(total>=60000) break;
  }
  return {text:parts.join('\\n').slice(0,60000),truncated:total>=60000 || visited>=20000};
})()`;
