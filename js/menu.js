import { lengthCounts, missCount, average, chapterPct, resetStats, toggleSkip, available, EXAM_SIZE, EXAM_SECONDS_PER_QUESTION } from './logic.js';
import { esc, rich, confirmModal, setFooter, pctText, pctColor, toast } from './ui.js';

const PREFS = 'mse606.prefs';
const LENGTH_LABELS = { short: 'Short', moderate: 'Moderate', long: 'Long', all: 'Comprehensive' };

export function loadPrefs(ctx) {
  const all = Object.keys(ctx.chapters).map(Number);
  try {
    const p = JSON.parse(localStorage.getItem(PREFS));
    if (p && Array.isArray(p.chapters)) return { chapters: p.chapters.filter((c) => all.includes(c)), length: p.length in LENGTH_LABELS ? p.length : 'moderate' };
  } catch { /* fall through */ }
  return { chapters: all, length: 'moderate' };
}
const savePrefs = (p) => { try { localStorage.setItem(PREFS, JSON.stringify(p)); } catch { /* ignore */ } };

export function renderMenu(ctx) {
  setFooter(null);
  const prefs = loadPrefs(ctx);
  const draw = () => {
    const { user } = ctx;
    const counts = lengthCounts(ctx.bank, prefs.chapters, user);
    const misses = missCount(ctx.bank, user);
    const examN = Math.min(EXAM_SIZE, available(ctx.bank, prefs.chapters, user).length);
    const examMin = Math.round((examN * EXAM_SECONDS_PER_QUESTION) / 60);
    const avg = average(user);
    const nSkipped = user.skipped.filter((id) => ctx.byId[id]).length;
    const a = ctx.auth;
    ctx.root.innerHTML = `
      <div class="brand">MSE 606 · Final prep</div>
      <h1 class="title">What are we studying?</h1>
      <div class="lbl">Chapters</div>
      <div class="chips">${Object.entries(ctx.chapters).map(([n, t]) =>
        `<button class="chip ${prefs.chapters.includes(+n) ? 'on' : ''}" data-ch="${n}"><b>${n}</b>${esc(t)}</button>`).join('')}</div>
      <div class="minilinks"><button class="link" data-act="all">Select all</button><button class="link" data-act="none">Clear</button></div>
      <div class="lbl">Length</div>
      <div class="seg">${Object.entries(LENGTH_LABELS).map(([k, label]) =>
        `<button class="${prefs.length === k ? 'on' : ''}" data-len="${k}">${label}<span>${counts[k]}</span></button>`).join('')}</div>
      <button class="btn primary" data-act="start" ${counts[prefs.length] ? '' : 'disabled'}>Start practice</button>
      <div class="lbl">Modes</div>
      <button class="btn ghost" data-act="drill" ${misses ? '' : 'disabled'}>Drill My Wrong Answers<small>${misses ? `${misses} miss${misses === 1 ? '' : 'es'} waiting` : 'No misses waiting'}</small></button>
      <button class="btn ghost" data-act="exam" ${examN ? '' : 'disabled'}>Exam mode<small>${examN} questions · ${examMin} min · feedback at the end</small></button>
      <div class="lbl">Stats</div>
      <div class="avg"><b>${pctText(avg)}</b><span>Average score</span></div>
      <div class="bars">${Object.keys(ctx.chapters).map((n) => {
        const p = chapterPct(user, n);
        return `<div class="bar"><span class="bn">Ch ${n}</span><span class="bt">${p == null ? '' : `<i style="width:${Math.max(p * 100, 2)}%;background:${pctColor(p)}"></i>`}</span><span class="bp">${pctText(p)}</span></div>`;
      }).join('')}</div>
      <button class="btn ghost danger" data-act="reset" ${avg == null ? 'disabled' : ''}>Reset stats</button>
      <div class="account">
        ${!a.cloud ? 'Offline: progress is saved on this device.' : a.isAnonymous
          ? 'Progress is saved on this device.<br><button class="link" data-act="google">Sign in with Google</button> to sync across devices.'
          : `Signed in as ${esc(a.displayName || 'Google user')} · <button class="link" data-act="signout">Sign out</button>`}
        <br><button class="link" data-act="skipped">Skipped questions (${nSkipped})</button>
      </div>`;
  };

  ctx.root.onclick = async (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.ch) {
      const n = +t.dataset.ch;
      prefs.chapters = prefs.chapters.includes(n) ? prefs.chapters.filter((c) => c !== n) : [...prefs.chapters, n].sort((x, y) => x - y);
      savePrefs(prefs); draw(); return;
    }
    if (t.dataset.len) { prefs.length = t.dataset.len; savePrefs(prefs); draw(); return; }
    switch (t.dataset.act) {
      case 'all': prefs.chapters = Object.keys(ctx.chapters).map(Number); savePrefs(prefs); draw(); break;
      case 'none': prefs.chapters = []; savePrefs(prefs); draw(); break;
      case 'start': ctx.go('practice', prefs); break;
      case 'drill': ctx.go('drill', prefs); break;
      case 'exam': ctx.go('exam', prefs); break;
      case 'reset':
        if (await confirmModal('Reset your scores? Your wrong-answer pool and skipped questions are kept.', 'Reset stats')) {
          ctx.setUser(resetStats(ctx.user)); draw();
        }
        break;
      case 'google':
        try { if (await ctx.signInGoogle()) toast('Signed in. Your progress now syncs across devices.'); } catch (err) { toast(err.message || 'Sign-in failed.'); }
        break;
      case 'signout':
        if (await confirmModal('Sign out? This device will start a fresh anonymous session.', 'Sign out')) await ctx.signOutUser();
        break;
      case 'skipped': renderSkipped(ctx); break;
    }
  };
  ctx.redraw = draw;
  draw();
  window.scrollTo(0, 0);
}

function renderSkipped(ctx) {
  const draw = () => {
    const items = ctx.user.skipped.map((id) => ctx.byId[id]).filter(Boolean);
    ctx.root.innerHTML = `
      <div class="topbar"><button class="pill" data-act="back">← Menu</button><span>${items.length} skipped</span></div>
      <div class="lbl">Skipped</div>
      ${items.length ? items.map((q) => `<div class="skiprow"><div><div class="qtag">Ch ${q.chapter}</div>${rich(q.stem)}</div>
        <button class="pill" data-unskip="${q.id}">Un-skip</button></div>`).join('') : '<div class="empty">No skipped questions.</div>'}`;
  };
  ctx.root.onclick = (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.act === 'back') renderMenu(ctx);
    if (t.dataset.unskip) { ctx.setUser(toggleSkip(ctx.user, t.dataset.unskip, false)); draw(); }
  };
  ctx.redraw = draw;
  draw();
  window.scrollTo(0, 0);
}
