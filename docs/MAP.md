# MSE 606 Study Quiz: map

Live at https://mse606.tozicabingames.com (GitHub Pages, repo `TISMND/mse606-quiz`, branch `main`).
It's a static site with no build step; pushing to `main` puts it live. Design:
`docs/superpowers/specs/2026-11-12-mse606-study-quiz-design.md`.

| System | Files | Notes |
|---|---|---|
| Quiz logic | `js/logic.js`, `tests/logic.test.mjs` | Pure functions for sessions, scoring, misses, stats and account merging. `npm test`. |
| Screens | `index.html`, `styles.css`, `js/app.js`, `js/menu.js`, `js/quiz.js`, `js/exam.js`, `js/ui.js`, `js/effects.js` | Night Shift theme. The menu covers chapters, length, Modes and Stats; then practice/drill, the timed exam and the summary. |
| Question bank | `questions.json` (generated), `tools/build-questions.mjs`, `tools/validate.mjs`, `tests/questions.test.mjs` | `node tools/build-questions.mjs` merges `work/tagged/chNN.json` (falling back to `work/checked/`) into `questions.json`. |
| Question sources | `chapters/chNN.md`, `README (3).md`, `practice-exam-1.md`, `work/` (all gitignored) | `work/WRITER-BRIEF.md` and `work/CHECKER-BRIEF.md` are the agent briefs. Each chapter has a writer and then an independent checker. |
| Accounts and data | `js/store.js`, `js/firebase-config.js`, `firestore.rules`, `firebase.json`, `.firebaserc` | Firebase project `mse606-quiz` (Spark plan). Anonymous auth with an optional link to Google. Data in `users/{uid}`, answer log in `users/{uid}/answers`. Mirrored to `localStorage`. Rules: `firebase deploy --only firestore:rules`. |
| Glossary | `glossary.json` (generated), `js/terms.js`, `js/terms-ui.js`, `terms.css`, `tools/build-glossary.mjs`, `tools/check-tagged.mjs`, `tests/terms.test.mjs`, `tests/glossary.test.mjs` | 503 checked terms; questions carry `terms` tags. The pipeline is `work/glossary/` → `work/glossary-checked/` → `node tools/build-glossary.mjs`; tags go `work/tagged/` → `node tools/build-questions.mjs`. Terms in more than one chapter are set by the `HOME` and `RENAME` maps in `build-glossary.mjs`. Loaded optionally by `app.js`, so the app works without it. Spec: `docs/superpowers/specs/2026-11-12-glossary-design.md`. |
| Domain | `CNAME` | Cloudflare DNS: `mse606` CNAME to `tismnd.github.io`, DNS only. |

## Analysing a student's traps
Every answer is logged with `qid`, `picked` (option indices in bank order), `correct` and `mode`.
Join `picked` against `questions.json` option `trap` tags to see which trap patterns catch them.

## Live users

Classmates use https://mse606.tozicabingames.com with saved progress. Everything below is read by
code already in their browsers or caches, and must keep working.

- **Saved per student:**
  - Firestore `users/{uid}`: `skipped` (array of question ids), `misses` (map from question id to
    a ms timestamp), `stats` (map from chapter to `{ right, total }`), `statsResetAt` (ms or null).
    The app writes changes only, never the whole document (`js/store.js`).
  - Firestore `users/{uid}/answers/{auto}`: `{ qid, chapter, picked, correct, mode, at }`.
  - localStorage:
    - `mse606.user.<uid>`: a copy of the user document;
    - `mse606.lastUid`;
    - `mse606.pending`: changes queued before sign-in;
    - `mse606.prefs`: `{ chapters, length }`.
- **Ids that saved data points at:** question ids (`chNN-NNN`) and term ids (kebab-case). Both are
  permanent.
- **Caching:** GitHub Pages serves files with about a 10-minute cache, so a student can get a new
  file alongside an old one. New code must tolerate:
  - a missing new file, by loading it optionally (as `app.js` does with `terms-ui.js` and
    `glossary.json`);
  - old data shapes, such as questions without `terms`.
- **Safe changes:** adding fields, adding files, adding questions or terms with new ids, and
  rewording a question or term in place.
- **Unsafe changes:** renaming or removing any of the above, changing what an id means, and
  overwriting a whole document.
