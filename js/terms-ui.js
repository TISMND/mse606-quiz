// Glossary screen, term cards and the "View key terms" reveal. Loaded with a dynamic import by
// app.js; every hook in older files calls in through ctx.termsUI?.…, so if this file (or
// glossary.json) fails to load, the rest of the app is unaffected.
import { termsFor, struggling, sortTerms, searchTerms } from './terms.js';
import { esc } from './ui.js';

export { indexGlossary } from './terms.js';

// Own stylesheet, so a stale cached styles.css can't leave these screens unstyled.
if (!document.querySelector('link[data-terms-css]')) {
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = 'terms.css';
  l.dataset.termsCss = '1';
  document.head.appendChild(l);
}

const pretty = (id) => id.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());

function moreHTML(t, ctx, qids) {
  const parts = [];
  if (t.more) parts.push(`<p>${esc(t.more)}</p>`);
  if (t.confusedWith?.length) {
    parts.push(`<h5>Don't confuse with</h5>${t.confusedWith.map((c) => {
      const other = ctx.glossary.byId[c.id];
      return `<div class="tvs"><b>${esc(other ? other.term : pretty(c.id))}</b>: ${esc(c.note)}</div>`;
    }).join('')}`);
  }
  if (t.trap) parts.push(`<h5>Exam trap</h5><div class="ttrap">${esc(t.trap)}</div>`);
  if (qids.length) {
    parts.push(`<button class="tdrill" data-drill="${qids.join(',')}">Drill the ${qids.length} question${qids.length === 1 ? '' : 's'} you missed →</button>`);
  }
  if (!parts.length) parts.push(`<p class="tnone">${esc(t.section || '')}</p>`);
  return parts.join('');
}

export function termCardHTML(t, ctx, { count = 0, qids = [] } = {}) {
  return `<div class="tcard" data-term="${esc(t.id)}">
    <div class="tt"><span class="tn">${esc(t.term)}</span><span class="tc">Ch ${t.chapter}</span></div>
    <div class="td">${esc(t.short)}</div>
    ${count ? `<div class="tmiss">Missed ${count}×</div>` : ''}
    <div class="tmore" hidden>${moreHTML(t, ctx, qids)}</div>
  </div>`;
}

// Missed questions per term, so a card shown under a question can still offer its drill.
function missInfo(ctx) {
  return Object.fromEntries(struggling(ctx.bank, ctx.user, ctx.glossary?.byId).map((s) => [s.term.id, s]));
}

export function keyTermsHTML(q, ctx) {
  if (!ctx.glossary) return '';
  const terms = termsFor(q, ctx.glossary.byId);
  if (!terms.length) return '';
  const info = missInfo(ctx);
  return `<div class="kt">
    <button class="ktbtn" data-kt>View key terms <span>${terms.length}</span> ▾</button>
    <div class="ktlist" hidden><div class="lbl">Key terms</div>
      ${terms.map((t) => termCardHTML(t, ctx, { qids: info[t.id]?.qids || [] })).join('')}</div>
  </div>`;
}

export function strugglingCount(ctx) {
  return struggling(ctx.bank, ctx.user, ctx.glossary?.byId).length;
}

// Called first from the existing screens' click handlers. Returns true when it handled the click.
export function handleTermClick(e, ctx) {
  const kt = e.target.closest('[data-kt]');
  if (kt) {
    kt.hidden = true;
    const list = kt.parentElement.querySelector('.ktlist');
    list.hidden = false;
    list.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return true;
  }
  const drill = e.target.closest('[data-drill]');
  if (drill) { ctx.drillIds(drill.dataset.drill.split(',')); return true; }
  const card = e.target.closest('.tcard');
  if (card) {
    const open = card.classList.toggle('open');
    card.querySelector('.tmore').hidden = !open;
    return true;
  }
  return false;
}

export function renderGlossary(ctx) {
  const all = sortTerms(ctx.glossary.terms);
  const st = { tab: null, query: '' };
  const struggle = () => struggling(ctx.bank, ctx.user, ctx.glossary.byId);

  const listHTML = () => {
    const s = struggle();
    if (st.tab === 'struggling') {
      const rows = s.filter((x) => searchTerms([x.term], st.query).length);
      if (!s.length) return '<div class="empty">No struggling terms. Nice.</div>';
      if (!rows.length) return '<div class="empty">No matches.</div>';
      return rows.map((x) => termCardHTML(x.term, ctx, { count: x.count, qids: x.qids })).join('');
    }
    const info = Object.fromEntries(s.map((x) => [x.term.id, x]));
    const rows = searchTerms(all, st.query);
    if (!rows.length) return '<div class="empty">No matches.</div>';
    return rows.map((t) => termCardHTML(t, ctx, { qids: info[t.id]?.qids || [] })).join('');
  };

  const draw = () => {
    const n = struggle().length;
    if (!st.tab) st.tab = n ? 'struggling' : 'all';
    ctx.root.innerHTML = `
      <div class="topbar"><button class="pill" data-act="back">← Menu</button><span>Glossary</span></div>
      <h1 class="gtitle">Terms</h1>
      <div class="subtitle">${st.tab === 'struggling' ? "From the questions you've missed" : 'Every key term in the course'}</div>
      <div class="gtabs"><button data-tab="struggling" class="${st.tab === 'struggling' ? 'on' : ''}">Struggling (${n})</button>
        <button data-tab="all" class="${st.tab === 'all' ? 'on' : ''}">All terms (${all.length})</button></div>
      <input class="gsearch" type="search" placeholder="Search terms…" value="${esc(st.query)}" aria-label="Search terms">
      <div class="glist">${listHTML()}</div>`;
    ctx.root.querySelector('.gsearch').addEventListener('input', (e) => {
      st.query = e.target.value;
      ctx.root.querySelector('.glist').innerHTML = listHTML();
    });
  };

  ctx.root.onclick = (e) => {
    if (e.target.closest('[data-act="back"]')) { ctx.go('menu'); return; }
    const tab = e.target.closest('[data-tab]');
    if (tab) { st.tab = tab.dataset.tab; draw(); return; }
    handleTermClick(e, ctx);
  };
  // Live sync can change misses while this screen is open: refresh the list, keep the search.
  ctx.redraw = () => {
    const input = ctx.root.querySelector('.gsearch');
    if (input && document.activeElement === input) return;
    draw();
  };
  draw();
  window.scrollTo(0, 0);
}
