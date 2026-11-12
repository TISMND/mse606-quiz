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
    // Optional glossary: if anything here fails, the app runs exactly as before without it.
    try {
      const [g, ui] = await Promise.all([fetch('glossary.json', { cache: 'no-cache' }).then((r) => r.json()), import('./terms-ui.js')]);
      ctx.glossary = ui.indexGlossary(g);
      ctx.termsUI = ctx.glossary.terms.length ? ui : null;
      if (!ctx.termsUI) ctx.glossary = null;
    } catch (e) {
      console.warn('[glossary] unavailable', e.message);
      ctx.glossary = null; ctx.termsUI = null;
    }
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
