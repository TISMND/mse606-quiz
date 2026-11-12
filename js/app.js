import { emptyUser, buildSession } from './logic.js';
import { initStore, saveUser, logAnswer, signInGoogle, signOutUser } from './store.js';
import { renderMenu } from './menu.js';
import { runQuiz, setKeys } from './quiz.js';
import { runExam } from './exam.js';
import { toast } from './ui.js';

const root = document.getElementById('app');
const ctx = {
  root, bank: [], byId: {}, chapters: {}, glossary: null, termsUI: null, user: emptyUser(), auth: { isAnonymous: true, cloud: false }, redraw: null,
  setUser(u) { ctx.user = u; saveUser(u); },
  logAnswer, signInGoogle, signOutUser,
  drillIds(ids) {
    setKeys(null);
    const skipped = new Set(ctx.user.skipped);
    const qs = ids.map((id) => ctx.byId[id]).filter((q) => q && !skipped.has(q.id));
    if (!qs.length) { toast('No questions to show.'); return renderMenu(ctx); }
    return runQuiz(ctx, qs.sort(() => Math.random() - 0.5), 'drill');
  },
  go(screen, prefs) {
    setKeys(null);
    if (screen === 'menu') return renderMenu(ctx);
    if (screen === 'glossary') return ctx.termsUI ? ctx.termsUI.renderGlossary(ctx) : renderMenu(ctx);
    const qs = buildSession(ctx.bank, { mode: screen, chapters: prefs.chapters, length: prefs.length }, ctx.user);
    if (!qs.length) { toast('No questions to show.'); return renderMenu(ctx); }
    if (screen === 'exam') return runExam(ctx, qs);
    return runQuiz(ctx, qs, screen);
  },
};

async function main() {
  try {
    const bank = await (await fetch('questions.json', { cache: 'no-cache' })).json();
    ctx.bank = bank.questions;
    ctx.chapters = bank.chapters;
    ctx.byId = Object.fromEntries(bank.questions.map((q) => [q.id, q]));
    // Optional glossary, loaded in the background: the app never waits for it, and if it fails
    // the app runs exactly as before. When it arrives, the current screen redraws to show it.
    Promise.all([fetch('glossary.json', { cache: 'no-cache' }).then((r) => r.json()), import('./terms-ui.js')])
      .then(([g, ui]) => {
        const glossary = ui.indexGlossary(g);
        if (!glossary.terms.length) return;
        ctx.glossary = glossary;
        ctx.termsUI = ui;
        ctx.redraw?.();
      })
      .catch((e) => console.warn('[glossary] unavailable', e.message));
  } catch (e) {
    root.innerHTML = '<div class="loading">Could not load the questions. Check your connection and reload.</div>';
    return;
  }
  let first = true;
  await initStore((user, auth) => {
    ctx.user = user;
    ctx.auth = auth;
    if (first) { first = false; renderMenu(ctx); } else if (ctx.redraw) ctx.redraw();
  });
}
main();
