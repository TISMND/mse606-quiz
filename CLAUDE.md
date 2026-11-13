# MSE 606 Study Quiz

A study quiz site for Tim's MSE 606 final, shared with classmates. The map of every system is in
`docs/MAP.md`.

- **Pushing to `main` puts it live** (GitHub Pages, no build step). Run `npm test` first.
- **Students use the live site: every change must keep working with their saved progress and with
  a mix of old and new cached files.**
  - Never rename or remove saved fields, `mse606.*` localStorage keys, question ids or term ids.
    Add; don't change.
  - New features go in new files, loaded so a failure hides them.
  - Details are in `docs/MAP.md` → "Live users".
- **Never commit the textbook-derived sources.** `chapters/`, `practice-exam-1.md`,
  `README (3).md` and `work/` stay gitignored. The repo is public.
- **Question ids are permanent.** Students' misses, skips and answer logs refer to them. Edit a
  question in place; never renumber.
- **Questions and terms only change through the builds.**
  - Questions: edit `work/tagged/chNN.json`, then run `node tools/build-questions.mjs`.
  - Terms: edit `work/glossary-checked/chNN.json`, then run `node tools/build-glossary.mjs`.
  - Never hand-edit `questions.json` or `glossary.json`.
- **A changed or new question or term gets the independent check before it ships:**
  `work/CHECKER-BRIEF.md` for questions, `work/GLOSSARY-CHECKER-BRIEF.md` for terms.
- **Firebase stays on the free Spark plan.** Never add billing or Blaze-only products.
- **Anonymous "Auto clean-up" stays off** (Firebase console → Authentication → Settings). Turning
  it on deletes anonymous students' progress after 30 days.
- **The site stays unlisted.** Keep the `noindex` meta in `index.html` and `Disallow: /` in
  `robots.txt`; it's shared by link only.
