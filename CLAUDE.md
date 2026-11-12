# MSE 606 Study Quiz

A study quiz site for Tim's MSE 606 final, shared with classmates. The map of every system is in
`docs/MAP.md`.

- **Pushing to `main` puts it live** (GitHub Pages, no build step). Run `npm test` first.
- **Never commit the textbook-derived sources.** `chapters/`, `practice-exam-1.md`,
  `README (3).md` and `work/` stay gitignored. The repo is public.
- **Question ids are permanent.** Students' misses, skips and answer logs refer to them. Edit a
  question in place; never renumber.
- **Questions only change through the bank build:** edit `work/checked/chNN.json`, then run
  `node tools/build-questions.mjs`. Never hand-edit `questions.json`.
- **A changed or new question gets the independent key check** (`work/CHECKER-BRIEF.md`) before
  it ships.
- **Firebase stays on the free Spark plan.** Never add billing or Blaze-only products.
