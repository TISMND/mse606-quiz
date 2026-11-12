// Shared rendering helpers.

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Escaped text with *word* rendered as emphasis (used for "*incorrect*" stems).
export const rich = (s) => esc(s).replace(/\*([^*]+)\*/g, '<em>$1</em>');

export const RADIO = new Set(['tf', 'term', 'single']);
export function hint(q) {
  if (q.type === 'tf') return 'True or false?';
  if (q.type === 'term') return 'Name the term. Pick one';
  if (q.type === 'single') return 'Pick one';
  return 'Check all that apply';
}

export function qtag(ctx, q) {
  return `Ch ${q.chapter} · ${esc(ctx.chapters[q.chapter] || '')}`;
}

// One option card. state: '' | 'sel' | 'right' | 'wrong' | 'missed'.
export function optionHTML(q, idx, pos, state, { picked = false, disabled = false, key = true } = {}) {
  const o = q.options[idx];
  const tags = [];
  if (disabled && picked) tags.push('<span class="tag pick">You picked</span>');
  if (disabled && o.correct) tags.push('<span class="tag ans">Correct answer</span>');
  return `<button class="opt ${RADIO.has(q.type) ? 'radio' : ''} ${state}" data-idx="${idx}" ${disabled ? 'disabled' : ''}>
    <span class="box"></span>${key && !disabled && pos < 9 ? `<span class="key">${pos + 1}</span>` : ''}${rich(o.text)}
    ${tags.length ? `<div class="tags">${tags.join('')}</div>` : ''}</button>`;
}

export function reviewState(o, picked) {
  if (picked && o.correct) return 'right';
  if (picked) return 'wrong';
  if (o.correct) return 'missed';
  return '';
}

// The post-submit view of every option, in the order shown.
export function reviewOptionsHTML(q, order, pickedSet) {
  return order.map((idx, pos) => optionHTML(q, idx, pos, reviewState(q.options[idx], pickedSet.has(idx)),
    { picked: pickedSet.has(idx), disabled: true })).join('');
}

export function confirmModal(text, okLabel = 'OK', cancelLabel = 'Cancel') {
  return new Promise((resolve) => {
    const m = document.createElement('div');
    m.className = 'modal';
    m.innerHTML = `<div class="card"><p>${esc(text)}</p><div class="row">
      <button class="btn ghost" data-v="0">${esc(cancelLabel)}</button><button class="btn primary" data-v="1">${esc(okLabel)}</button></div></div>`;
    m.addEventListener('click', (e) => {
      const b = e.target.closest('[data-v]');
      if (!b && e.target !== m) return;
      m.remove();
      resolve(b ? b.dataset.v === '1' : false);
    });
    document.body.appendChild(m);
  });
}

export function toast(text, ms = 3500) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = text;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), ms);
}

export function setFooter(html) {
  let f = document.querySelector('.footer');
  if (!html) { f?.remove(); document.documentElement.style.setProperty('--footer-h', '0px'); return null; }
  if (!f) { f = document.createElement('div'); f.className = 'footer'; document.body.appendChild(f); }
  f.innerHTML = html;
  document.documentElement.style.setProperty('--footer-h', `${f.offsetHeight}px`);
  return f;
}

export function pctText(p) { return p == null ? '—' : `${Math.round(p * 100)}%`; }
export function pctColor(p) { return p >= 0.8 ? 'var(--good)' : p >= 0.7 ? 'var(--amber)' : 'var(--bad)'; }
