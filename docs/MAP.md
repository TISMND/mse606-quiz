# MSE 606 Study Quiz: map

Live at https://mse606.tozicabingames.com (GitHub Pages, repo `TISMND/mse606-quiz`, branch `main`).
It's a static site with no build step; pushing to `main` puts it live. Design:
`docs/superpowers/specs/2026-11-12-mse606-study-quiz-design.md`.

| System | Files | Notes |
|---|---|---|
| Quiz logic | `js/logic.js`, `tests/logic.test.mjs` | Pure functions for sessions, scoring, misses, stats and account merging. `npm test`. |
| Screens | `index.html`, `styles.css`, `js/app.js`, `js/menu.js`, `js/quiz.js`, `js/exam.js`, `js/ui.js`, `js/effects.js` | Night Shift theme. The menu covers chapters, length, Modes and Stats; then practice/drill, the timed exam and the summary. |
| Question bank | `questions.json` (generated), `tools/build-questions.mjs`, `tools/validate.mjs`, `tests/questions.test.mjs` | `node tools/build-questions.mjs` merges `work/checked/chNN.json` into `questions.json`. |
| Question sources | `chapters/chNN.md`, `README (3).md`, `practice-exam-1.md`, `work/` (all gitignored) | `work/WRITER-BRIEF.md` and `work/CHECKER-BRIEF.md` are the agent briefs. Each chapter has a writer and then an independent checker. |
| Accounts and data | `js/store.js`, `js/firebase-config.js`, `firestore.rules`, `firebase.json`, `.firebaserc` | Firebase project `mse606-quiz` (Spark plan). Anonymous auth with an optional link to Google. Data in `users/{uid}`, answer log in `users/{uid}/answers`. Mirrored to `localStorage`. Rules: `firebase deploy --only firestore:rules`. |
| Domain | `CNAME` | Cloudflare DNS: `mse606` CNAME to `tismnd.github.io`, DNS only. |

## Analysing a student's traps
Every answer is logged with `qid`, `picked` (option indices in bank order), `correct` and `mode`.
Join `picked` against `questions.json` option `trap` tags to see which trap patterns catch them.
