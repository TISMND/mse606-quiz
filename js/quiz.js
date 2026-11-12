import { shuffleOptions, isCorrect, applyAnswer, toggleSkip } from './logic.js';
import { rich, hint, qtag, optionHTML, reviewOptionsHTML, RADIO, setFooter, esc } from './ui.js';
import { pulse, shake, sparks } from './effects.js';

let keyHandler = null;
export function setKeys(fn) {
  if (keyHandler) document.removeEventListener('keydown', keyHandler);
  keyHandler = fn;
  if (fn) document.addEventListener('keydown', fn);
}

// Practice and drill: one question at a time with feedback after each submit.
export function runQuiz(ctx, questions, mode) {
  const results = [];
  let i = 0, order, picked, submitted, item;

  const show = () => {
    const q = questions[i];
    ({ order } = shuffleOptions(q));
    picked = new Set();
    submitted = false;
    ctx.root.innerHTML = `
      <div class="topbar"><button class="pill" data-act="quit">✕ Quit</button>
        <span>${mode === 'drill' ? 'Drill · ' : ''}Question ${i + 1} of ${questions.length}</span></div>
      <div class="progress"><i style="width:${(i / questions.length) * 100}%"></i></div>
      <div class="qwrap">
        <div class="verdict"></div>
        <div class="qtag">${qtag(ctx, q)}</div>
        <div class="q">${rich(q.stem)}</div>
        <div class="hint">${hint(q)}</div>
        <div class="opts">${order.map((idx, pos) => optionHTML(q, idx, pos, '')).join('')}</div>
      </div>`;
    setFooter('<button class="btn primary" data-act="submit" disabled>Submit</button>');
    window.scrollTo(0, 0);
  };

  const toggle = (idx) => {
    if (submitted) return;
    const q = questions[i];
    if (RADIO.has(q.type)) picked = picked.has(idx) ? new Set() : new Set([idx]);
    else if (picked.has(idx)) picked.delete(idx); else picked.add(idx);
    ctx.root.querySelectorAll('.opt').forEach((b) => b.classList.toggle('sel', picked.has(+b.dataset.idx)));
    document.querySelector('.footer [data-act="submit"]').disabled = picked.size === 0;
  };

  const submit = () => {
    if (submitted || picked.size === 0) return;
    submitted = true;
    const q = questions[i];
    const correct = isCorrect(q, [...picked]);
    item = { q, order, picked: new Set(picked), correct };
    results.push(item);
    ctx.root.querySelector('.opts').innerHTML = reviewOptionsHTML(q, order, picked);
    const v = ctx.root.querySelector('.verdict');
    v.textContent = correct ? 'Nailed it' : 'Not quite';
    v.className = `verdict ${correct ? 'good' : 'bad'}`;
    ctx.setUser(applyAnswer(ctx.user, q, correct, mode));
    ctx.logAnswer({ qid: q.id, chapter: q.chapter, picked: [...picked].sort(), correct, mode });
    if (!correct) ctx.root.querySelector('.qwrap').insertAdjacentHTML('beforeend', ctx.termsUI?.keyTermsHTML(q, ctx) || '');
    pulse(correct ? 'good' : 'bad');
    if (correct) {
      const r = v.getBoundingClientRect();
      sparks(r.left + Math.min(r.width, 120) / 2 + 20, r.top + r.height / 2);
    } else shake(ctx.root.querySelector('.qwrap'));
    const skipped = ctx.user.skipped.includes(q.id);
    setFooter(`<label class="skip"><input type="checkbox" data-act="skip" ${skipped ? 'checked' : ''}>Skip this question in future</label>
      <button class="btn primary" data-act="next">${i + 1 < questions.length ? 'Next question →' : 'See results →'}</button>`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const next = () => {
    i++;
    if (i < questions.length) show();
    else finish();
  };

  const finish = () => {
    setKeys(null);
    document.removeEventListener('click', onFooter);
    renderSummary(ctx, results, { title: mode === 'drill' ? 'Drill complete' : 'Session complete' });
  };

  const onFooter = (e) => {
    const t = e.target.closest('.footer [data-act]');
    if (!t) return;
    if (t.dataset.act === 'submit') submit();
    if (t.dataset.act === 'next') next();
    if (t.dataset.act === 'skip') ctx.setUser(toggleSkip(ctx.user, questions[i].id, t.checked));
  };
  document.addEventListener('click', onFooter);

  ctx.root.onclick = (e) => {
    // Leaving for a term drill: release this quiz's handlers *before* the drill registers its own.
    if (ctx.termsUI && e.target.closest('[data-drill]')) { setKeys(null); document.removeEventListener('click', onFooter); }
    if (ctx.termsUI?.handleTermClick(e, ctx)) return;
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.act === 'quit') {
      setKeys(null);
      document.removeEventListener('click', onFooter);
      if (results.length) renderSummary(ctx, results, { title: 'Session ended' });
      else ctx.go('menu');
      return;
    }
    if (t.dataset.idx != null && !t.disabled) toggle(+t.dataset.idx);
  };

  setKeys((e) => {
    if (e.target.matches?.('input, textarea')) return;
    if (/^[1-9]$/.test(e.key) && !submitted) {
      const idx = order[+e.key - 1];
      if (idx != null) toggle(idx);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (!submitted) submit(); else next();
    }
  });

  ctx.redraw = null;
  show();
}

// Results for a practice/drill/exam session. results: [{ q, order, picked:Set, correct }]
export function renderSummary(ctx, results, { title, showAll = false } = {}) {
  setFooter(null);
  const right = results.filter((r) => r.correct).length;
  const byCh = {};
  for (const r of results) {
    const c = (byCh[r.q.chapter] ||= { right: 0, total: 0 });
    c.total++; if (r.correct) c.right++;
  }
  const list = showAll ? results : results.filter((r) => !r.correct);
  ctx.root.innerHTML = `
    <div class="brand">${esc(title)}</div>
    <div class="score"><b>${results.length ? Math.round((right / results.length) * 100) : 0}%</b><span>${right} of ${results.length} correct</span></div>
    <div class="lbl">By chapter</div>
    <div class="bars">${Object.entries(byCh).sort((a, b) => a[0] - b[0]).map(([ch, s]) =>
      `<div class="bar"><span class="bn">Ch ${ch}</span><span class="bt"><i style="width:${Math.max((s.right / s.total) * 100, 2)}%;background:${s.right / s.total >= 0.8 ? 'var(--good)' : s.right / s.total >= 0.7 ? 'var(--amber)' : 'var(--bad)'}"></i></span><span class="bp">${s.right}/${s.total}</span></div>`).join('')}</div>
    <div class="lbl">${showAll ? 'Review' : 'Missed'}</div>
    ${list.length ? list.map((r) => `<details class="review"><summary><span class="mark ${r.correct ? 'good' : 'bad'}">${r.correct ? '✓' : '✕'}</span><span>${rich(r.q.stem)}</span></summary>
      <div class="body"><div class="qtag">${qtag(ctx, r.q)}</div><div class="hint">${hint(r.q)}</div>${reviewOptionsHTML(r.q, r.order, r.picked)}${r.correct ? '' : ctx.termsUI?.keyTermsHTML(r.q, ctx) || ''}</div></details>`).join('')
      : '<div class="empty">Nothing missed. 🎯</div>'}
    <button class="btn primary" data-act="menu">Back to menu</button>`;
  ctx.root.onclick = (e) => {
    if (ctx.termsUI?.handleTermClick(e, ctx)) return;
    if (e.target.closest('[data-act="menu"]')) ctx.go('menu');
  };
  ctx.redraw = null;
  window.scrollTo(0, 0);
}
