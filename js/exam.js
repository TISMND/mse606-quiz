import { shuffleOptions, scoreExam, applyAnswer, EXAM_SECONDS_PER_QUESTION } from './logic.js';
import { rich, hint, qtag, optionHTML, RADIO, setFooter, confirmModal } from './ui.js';
import { pulse } from './effects.js';
import { setKeys, renderSummary } from './quiz.js';

// Timed exam: answers can be changed until Finish or time-out; feedback only at the end.
export function runExam(ctx, questions) {
  const orders = Object.fromEntries(questions.map((q) => [q.id, shuffleOptions(q).order]));
  const answers = {}; // id -> Set of original option indices
  let i = 0, done = false;
  let remaining = window.__examSeconds ?? questions.length * EXAM_SECONDS_PER_QUESTION;
  const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const tick = setInterval(() => {
    remaining--;
    const t = ctx.root.querySelector('.timer');
    if (t) { t.textContent = fmt(Math.max(remaining, 0)); t.classList.toggle('low', remaining <= 60); }
    if (remaining <= 0) finish(true);
  }, 1000);

  const show = () => {
    const q = questions[i];
    const sel = answers[q.id] || new Set();
    ctx.root.innerHTML = `
      <div class="topbar"><button class="pill" data-act="quit">✕ Quit</button>
        <span class="timer ${remaining <= 60 ? 'low' : ''}">${fmt(remaining)}</span>
        <button class="pill" data-act="finish">Finish exam</button></div>
      <div class="strip">${questions.map((qq, k) =>
        `<button data-go="${k}" class="${answers[qq.id]?.size ? 'done' : ''} ${k === i ? 'cur' : ''}">${k + 1}</button>`).join('')}</div>
      <div class="qtag">Question ${i + 1} of ${questions.length} · ${qtag(ctx, q)}</div>
      <div class="q">${rich(q.stem)}</div>
      <div class="hint">${hint(q)}</div>
      <div class="opts">${orders[q.id].map((idx, pos) => optionHTML(q, idx, pos, sel.has(idx) ? 'sel' : '')).join('')}</div>`;
    setFooter(`<div class="row"><button class="btn ghost" data-act="prev" ${i === 0 ? 'disabled' : ''}>← Previous</button>
      ${i + 1 < questions.length ? '<button class="btn primary" data-act="next">Next →</button>' : '<button class="btn primary" data-act="finish">Finish exam</button>'}</div>`);
    window.scrollTo(0, 0);
  };

  const toggle = (idx) => {
    const q = questions[i];
    const cur = answers[q.id] || new Set();
    let nxt;
    if (RADIO.has(q.type)) nxt = cur.has(idx) ? new Set() : new Set([idx]);
    else { nxt = new Set(cur); if (nxt.has(idx)) nxt.delete(idx); else nxt.add(idx); }
    answers[q.id] = nxt;
    ctx.root.querySelectorAll('.opt').forEach((b) => b.classList.toggle('sel', nxt.has(+b.dataset.idx)));
    ctx.root.querySelector(`.strip [data-go="${i}"]`).classList.toggle('done', nxt.size > 0);
  };

  const cleanup = () => {
    done = true;
    clearInterval(tick);
    setKeys(null);
    document.removeEventListener('click', onClick);
  };

  async function finish(timeUp = false) {
    if (done) return;
    if (!timeUp) {
      const blank = questions.filter((q) => !answers[q.id]?.size).length;
      if (blank && !(await confirmModal(`${blank} question${blank === 1 ? ' is' : 's are'} unanswered and will count as wrong. Finish anyway?`, 'Finish exam', 'Keep going'))) return;
      if (done) return; // time ran out while the dialog was open
    }
    cleanup();
    document.querySelector('.modal')?.remove();
    const picked = Object.fromEntries(Object.entries(answers).map(([id, s]) => [id, [...s]]));
    const { right, total, results } = scoreExam(questions, picked);
    let user = ctx.user;
    for (const r of results) {
      user = applyAnswer(user, r.q, r.correct, 'exam');
      ctx.logAnswer({ qid: r.q.id, chapter: r.q.chapter, picked: [...r.picked].sort(), correct: r.correct, mode: 'exam' });
    }
    ctx.setUser(user);
    pulse(right / total >= 0.7 ? 'good' : 'bad');
    renderSummary(ctx, results.map((r) => ({ q: r.q, order: orders[r.q.id], picked: new Set(r.picked), correct: r.correct })),
      { title: timeUp ? "Time's up · Exam results" : 'Exam results', showAll: true });
  }

  const onClick = async (e) => {
    const t = e.target.closest('button');
    if (!t || done) return;
    if (t.closest('.modal')) return;
    if (t.dataset.go != null) { i = +t.dataset.go; show(); return; }
    if (t.dataset.idx != null) { toggle(+t.dataset.idx); return; }
    switch (t.dataset.act) {
      case 'prev': if (i > 0) { i--; show(); } break;
      case 'next': if (i + 1 < questions.length) { i++; show(); } break;
      case 'finish': finish(); break;
      case 'quit':
        if (await confirmModal('Quit the exam? Nothing will be scored.', 'Quit exam', 'Keep going')) { cleanup(); ctx.go('menu'); }
        break;
    }
  };
  ctx.root.onclick = null;
  document.addEventListener('click', onClick);

  setKeys((e) => {
    if (document.querySelector('.modal')) return;
    if (/^[1-9]$/.test(e.key)) {
      const idx = orders[questions[i].id][+e.key - 1];
      if (idx != null) toggle(idx);
    } else if (e.key === 'ArrowRight' && i + 1 < questions.length) { i++; show(); }
    else if (e.key === 'ArrowLeft' && i > 0) { i--; show(); }
  });

  ctx.redraw = null;
  show();
}
