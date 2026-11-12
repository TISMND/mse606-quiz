# MSE 606 Study Quiz: map

Live at https://mse606.tozicabingames.com (GitHub Pages, repo `TISMND/mse606-quiz`, branch `main`).
It's a static site with no build step; pushing to `main` puts it live. Design:
`docs/superpowers/specs/2026-11-12-mse606-study-quiz-design.md`.

| System | Files | Notes |
|---|---|---|
| Quiz logic | `js/logic.js`, `tests/logic.test.mjs` | Pure functions for sessions, scoring, misses, stats and account merging. `npm test`. |
| Screens | `index.html`, `styles.css`, `js/app.js`, `js/menu.js`, `js/quiz.js`, `js/exam.js`, `js/ui.js`, `js/effects.js` | Night Shift theme. The menu covers chapters, length, Modes and Stats; then practice/drill, the timed exam and the summary. |
| Question bank | `questions.json` (generated), `tools/build-questions.mjs`, `tools/validate.mjs`, `tests/questions.test.mjs` | `node tools/build-questions.mjs` merges `work/tagged/chNN.json` (falling back to `work/checked/`) into `questions.json`. |
| Question sources | `chapters/chNN.md`, `README (3).md`, `practice-exam-1.md`, `work/` (all gitignored, so they exist only on Tim's machine) | Agent briefs in `work/`: `WRITER-BRIEF.md` and `CHECKER-BRIEF.md` (questions), `GLOSSARY-WRITER-BRIEF.md` and `GLOSSARY-CHECKER-BRIEF.md` (terms), `TAGGER-BRIEF.md` (term tags on questions). Each chapter has a writer and then an independent checker. Tags were checked by each tagger's second pass plus `tools/check-tagged.mjs`, which confirms no question text or answer changed. |
| Accounts and data | `js/store.js`, `js/firebase-config.js`, `firestore.rules`, `firebase.json`, `.firebaserc` | Firebase project `mse606-quiz` (Spark plan). Anonymous auth with an optional link to Google. Data in `users/{uid}`, answer log in `users/{uid}/answers`. Mirrored to `localStorage`. Rules: `firebase deploy --only firestore:rules` (a user can read and write only `users/{uid}` and below). Console settings: Anonymous and Google sign-in on; Anonymous **"Auto clean-up" deliberately off** (turning it on would delete anonymous students' progress after 30 days); authorized domain `mse606.tozicabingames.com`; public-facing name "MSE 606 Study Quiz". The web config in `firebase-config.js` is public by design. |
| Glossary | `glossary.json` (generated), `js/terms.js`, `js/terms-ui.js`, `terms.css`, `tools/build-glossary.mjs`, `tools/check-tagged.mjs`, `tests/terms.test.mjs`, `tests/glossary.test.mjs` | 503 checked terms; questions carry `terms` tags. The pipeline is `work/glossary/` → `work/glossary-checked/` → `node tools/build-glossary.mjs`; tags go `work/tagged/` → `node tools/build-questions.mjs`. Terms in more than one chapter are set by the `HOME` and `RENAME` maps in `build-glossary.mjs`. Loaded optionally by `app.js`, so the app works without it. Spec: `docs/superpowers/specs/2026-11-12-glossary-design.md`. |
| Domain | `CNAME` | Cloudflare DNS: `mse606` CNAME to `tismnd.github.io`, DNS only. HTTPS enforced in GitHub Pages; the certificate only issued after removing and re-adding the custom domain. |
| Unlisted | `index.html` (`noindex` meta), `robots.txt` (`Disallow: /`) | The site is shared by link only, not meant for search engines. Keep both. |

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

## Known minor issues (not fixed)

Found in reviews and left for Tim to decide on:

- The exam timer pauses while a phone is locked.
- In the exam, Enter can re-toggle the focused option.
- Enter doesn't advance after ticking the skip checkbox.
- The `window.__examSeconds` test hook ships in `js/exam.js`.
- The answer log's `picked` is sorted as text, not numbers.
- The spark burst can drift during smooth scroll.
- A drill started from a term card mid-quiz skips that session's results screen (answers are saved).
- A term card's "Drill N questions" count is fixed when the card is drawn, so skipping a question
  first can overstate it.
- A live-sync redraw closes open cards in the glossary; tapping inside an open card closes it.
- Dead code in `tools/check-tagged.mjs`; an unused `unlinked` flag in `glossary.json`.
