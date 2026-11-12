# MSE 606 Study Quiz Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** a static quiz site at mse606.tozicabingames.com: chapter and length selection, check-all
feedback with effects, a miss pool and drill, exam mode, and per-student stats synced through
Firebase.

**Architecture:** plain ES modules with no build step, served by GitHub Pages.
- Pure logic (sessions, scoring, user-state updates) is in one module and tested with `node --test`.
- A store module wraps Firebase Auth and Firestore (CDN SDK), with a `localStorage` mirror.
- UI modules render the screens into one `index.html`.
- A Node script merges the checked per-chapter question files into `questions.json` and
  validates it.

**Tech Stack:** HTML/CSS/JS (ES modules), Firebase JS SDK 11.x from gstatic CDN, Node 20+ for
tests and tools (`node:test`, no npm dependencies), Firebase CLI for the rules, `gh` for the repo.

**Spec:** `docs/superpowers/specs/2026-11-12-mse606-study-quiz-design.md`

## Global Constraints

- No bundler and no framework. What's in the repo is what ships.
- Firebase project `mse606-quiz`, Spark plan only, Firestore and Auth only.
- Theme: bg `#0f1220`, card `#171b2e`, line `#2a3050`, ink `#e8ebff`, muted `#8a91b4`, accent
  `#7cf7c5`, good `#2fd98a`, bad `#ff4d6d`. Space Grotesk; JetBrains Mono for numbers. Section
  headers are centered, bold, `#f4f6ff`, letter-spacing .22em, with a mint glow and a mint
  gradient rule on each side (as in the mockup `night-shift-v3.html`).
- Lengths: Short 15, Moderate 35, Long 70, Comprehensive = all, each capped at all.
- Exam: 25 questions, 90 s per question.
- Copy: "You picked", "Correct answer", "Skip this question in future", "Next question →",
  "Drill My Wrong Answers", "Exam mode", "Modes", "Stats", "Reset stats", "✕ Quit".
- `noindex`. Never commit `chapters/`, `practice-exam-1.md`, `README (3).md` or `work/`.
- Effects respect `prefers-reduced-motion`.

## Review Focus

1. **Firestore unreachable** (offline, quota used up, rules error): the app still starts, quizzes
   and saves to `localStorage`, and the cloud state catches up later. Covered by Task 3 (a
   `loadUser` fallback test).
2. **Ids in `skipped` or `misses` that aren't in the bank:** they're ignored in counts and
   sessions. Covered by Task 1 (`buildSession`, `missCount` tests).
3. **Fewer questions in the chosen chapters than the length asks for, or no chapters chosen:**
   lengths cap at the available count, and Start is disabled at 0. Covered by Task 1
   (`lengthCounts` test) and Task 4.
4. **Google sign-in cancelled, popup blocked, or the Google account already exists:** no data is
   lost, and the merge combines both records. Covered by Task 1 (`mergeUsers` test) and Task 3.
5. **The exam timer runs out while a question is unanswered:** the exam finishes, and unanswered
   questions score as wrong and join the miss pool. Covered by Task 1 (`scoreExam` test).

---

### Task 1: Pure quiz logic

**Files:**
- Create: `js/logic.js`
- Test: `tests/logic.test.mjs`

**Interfaces:**
- Produces:
  - `LENGTHS = { short: 15, moderate: 35, long: 70, all: Infinity }`
  - `emptyUser() -> { skipped: [], misses: {}, stats: {}, statsResetAt: null }`
  - `available(bank, chapters:number[], user) -> Question[]`: questions in those chapters, not
    skipped.
  - `lengthCounts(bank, chapters, user) -> { short, moderate, long, all }`
  - `buildSession(bank, { mode: 'practice'|'drill'|'exam', chapters, length }, user, rng=Math.random) -> Question[]`
    - Practice: shuffled `available`, sliced to the length.
    - Drill: bank questions whose id is in `misses` and not skipped, shuffled.
    - Exam: 25 from `available`.
  - `shuffleOptions(q, rng) -> { q, order:number[] }`. `tf` keeps its order.
  - `isCorrect(q, pickedIdx:number[]) -> boolean`: exact set match, indices into the bank's
    option order.
  - `applyAnswer(user, q, correct, mode) -> user`: a new object.
    - Always: `stats[chapter].total++`, and `right++` when correct.
    - Wrong: `misses[id] = Date.now()`.
    - Correct in drill: delete `misses[id]`.
  - `toggleSkip(user, id, on) -> user`
  - `resetStats(user) -> user`: `stats = {}`, `statsResetAt = Date.now()`. Misses and skips are
    kept.
  - `average(user) -> number|null`: sum of right ÷ sum of total.
  - `chapterPct(user, ch) -> number|null`
  - `missCount(bank, user) -> number`: counts only ids that are in the bank and not skipped.
  - `scoreExam(questions, answers: Record<id, number[]>) -> { right, total, results: [{ q, picked, correct }] }`.
    A missing answer counts as wrong.
  - `mergeUsers(a, b) -> user`:
    - Stats added per chapter.
    - Skips: the union of both lists.
    - Misses: the union, keeping the larger timestamp.
    - `statsResetAt`: the larger of the two.

- [ ] **Step 1: Write the failing tests** in `tests/logic.test.mjs`, using a fixture bank of 6
  questions across chapters 1 and 7 (`cata`, `tf`, `not`):
  - `lengthCounts` with 6 available returns `{short:6, moderate:6, long:6, all:6}`. With no
    chapters chosen it returns all zeros.
  - `buildSession` practice leaves out skipped ids and respects the length.
  - `buildSession` drill returns only miss ids that exist in the bank. A miss id `'ch99-001'`
    that isn't in the bank is ignored.
  - `isCorrect` is true for an exact set match in any order, and false for a subset or a
    superset.
  - `applyAnswer`:
    - A wrong practice answer adds a miss, and `stats[7]` becomes `{right:0,total:1}`.
    - A correct drill answer removes the miss.
    - A correct practice answer keeps the miss.
  - `resetStats` keeps `misses` and `skipped`.
  - `scoreExam` with one unanswered question counts it wrong.
  - `mergeUsers` adds `{1:{right:2,total:3}}` and `{1:{right:1,total:1}}` to `{right:3,total:4}`,
    and combines the skips.
  - `shuffleOptions` on `tf` keeps the order `[0,1]`.

- [ ] **Step 2: Run them to verify they fail.** `node --test tests/` should FAIL with a module not
  found error.
- [ ] **Step 3: Implement `js/logic.js`.** No DOM and no Firebase imports. Fisher–Yates using the
  injected `rng`.
- [ ] **Step 4: Run them to verify they pass.** `node --test tests/` should PASS.
- [ ] **Step 5: Commit** with `feat: quiz logic`.

### Task 2: Question bank build and validation

**Files:**
- Create: `tools/build-questions.mjs`, `tests/questions.test.mjs`
- Output: `questions.json`, from `work/checked/chNN.json`. If a chapter has no checked file, the
  script falls back to `work/questions/chNN.json` and prints a warning.

**Interfaces:**
- Produces:
  - `validateQuestion(q) -> string[]`: a list of errors, empty if valid.
  - `questions.json` = `{ version: <ISO time>, chapters: { "1": "Intro to OM & Supply Chain", … }, questions: Question[] }`.

**What `validateQuestion` enforces:**
- The id matches `/^ch\d\d-\d{3}$/` and is unique.
- The chapter is one of 1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 14.
- The type is one of the five types.
- `cata` and `not` have 4–7 options and at least 1 correct; `cata` is not all correct.
- `tf` has exactly two options, True then False, with exactly one correct.
- `term` and `single` have exactly 1 correct.
- No empty text.

- [ ] **Step 1: Write the failing tests:**
  - `validateQuestion` flags a duplicate option text, a `tf` with two correct, and a `cata` where
    every option is correct.
  - A valid fixture returns `[]`.
  - When `questions.json` exists, every question in it validates and ids are unique.
- [ ] **Step 2: Run them.** They should FAIL.
- [ ] **Step 3: Implement the script.** `node tools/build-questions.mjs` merges, validates, drops
  invalid questions with a printed reason, and writes `questions.json`. Short chapter names are as
  in the spec's mockup list.
- [ ] **Step 4: Run them.** `node tools/build-questions.mjs && node --test tests/` should PASS and
  print a per-chapter count.
- [ ] **Step 5: Commit** with `feat: question bank build`.

### Task 3: Store (Firebase and local)

**Files:**
- Create: `js/firebase-config.js` (the web config from `firebase apps:sdkconfig`), `js/store.js`,
  `firestore.rules`, `firebase.json`, `.firebaserc` (default `mse606-quiz`).

**Interfaces:**
- Consumes: `emptyUser`, `mergeUsers`, `applyAnswer` (Task 1).
- Produces:
  - `initStore(onUser:(user, authInfo)=>void) -> Promise<void>`: signs in anonymously, loads
    `users/{uid}`, and falls back to `localStorage['mse606.user']` when Firestore fails. `authInfo`
    is `{ isAnonymous, displayName }`.
  - `saveUser(user) -> void`: writes `localStorage` immediately and Firestore `setDoc` with merge,
    without awaiting it in the UI.
  - `logAnswer({ qid, chapter, picked, correct, mode }) -> void`: adds a document to
    `users/{uid}/answers`.
  - `signInGoogle() -> Promise<void>`:
    - Tries `linkWithPopup`.
    - On `auth/credential-already-in-use`, it reads the anonymous data and the anonymous answer
      log first, signs in with the credential from the error, then merges with `mergeUsers` and
      copies the answers in a `writeBatch` (chunks of 400).
    - A cancelled popup is a no-op.
  - `signOutUser() -> Promise<void>`
- Stats are stored whole (`setDoc` merge) rather than with `increment()`, since the client holds
  the authoritative copy. One write per answer is the same cost. *(This deviates from the spec's
  increment wording. The behavior is the same.)*
- `firestore.rules`:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    match /users/{uid}/{rest=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

- [ ] **Step 1:** Write the files and enable Firestore offline persistence
  (`persistentLocalCache`).
- [ ] **Step 2:** Deploy the rules: `firebase deploy --only firestore:rules --project
  mse606-quiz`. Expected: `Deploy complete!` (this needs Tim's console step 1).
- [ ] **Step 3:** Verify in the browser at `localhost` (Task 4 page): the console shows a uid,
  answering a question creates `users/{uid}` (checked with `firebase firestore:get`, or in the
  console), and blocking the network still lets the app run.
- [ ] **Step 4: Commit** with `feat: firebase store`.

### Task 4: App shell, main menu, practice and drill

**Files:**
- Create: `index.html`, `styles.css`, `js/app.js` (the screen router and state), `js/menu.js`,
  `js/quiz.js`, `js/effects.js`, `robots.txt` (`Disallow: /`), `CNAME`
  (`mse606.tozicabingames.com`), `docs/MAP.md`, `CLAUDE.md`.

**Interfaces:**
- Consumes: everything from Tasks 1 and 3, and `questions.json` (loaded with `fetch`).
- Produces:
  - `effects.pulse('good'|'bad')`, `effects.shake(el)`, `effects.sparks(x, y)`. These are no-ops
    under reduced motion, except the pulse, which becomes a static flash.
  - `renderMenu(root, ctx)` and `runQuiz(root, ctx, questions, mode) -> Promise<sessionResult>`,
    shared with Task 5.

**Behavior** (layout as in the mockup `night-shift-v3.html`):
- **Menu:**
  - Only chapters that have questions are shown.
  - Selected chapters and the length are remembered in `localStorage`.
  - The length segments show `lengthCounts`.
  - Start is disabled at 0 questions; Drill is disabled when `missCount` is 0.
  - The Stats section has the average, a bar per chapter (≥80 good, 70–79 `#ffd166`, <70 bad,
    and "—" for a chapter with no answers) and Reset stats (opens a confirm).
  - Below it: a sign-in line and "Skipped questions (N)", which opens a list, each with an
    Un-skip button.
- **Question screen:**
  - Options are toggles (radio for `tf`, `term` and `single`). Submit is disabled with nothing
    selected.
  - After Submit: option states and labels as in the spec, then `applyAnswer` → `saveUser` →
    `logAnswer`, then the effects.
  - The footer holds the skip checkbox (16 px gap) and "Next question →".
  - `*incorrect*` in a stem renders as `<em>`.
  - Keys 1–9 toggle options; Enter submits, then goes to Next.
- **Summary:** the score, a per-chapter breakdown for the session, the missed questions in an
  expandable list showing the post-submit view, and "Back to menu".
- **Layout:** phone first, with a max width of 680 px centered on desktop.

- [ ] **Step 1:** Build it, and serve it locally with `npx --yes http-server -p 8080 -c-1`.
- [ ] **Step 2:** Verify in Chrome at 390×844 and at 1280×800:
  - Pick chapters 1 and 7 at Short: the count matches.
  - Answer one question right and one wrong: green with sparks, then red with a shake.
  - Skip one question: it disappears from the counts.
  - Quit: the menu stats have updated.
  - Drill shows the missed question; answering it right removes it.
  - Reset stats: the scores clear and the drill count stays.
- [ ] **Step 3: Commit** with `feat: menu, practice, drill`.

### Task 5: Exam mode

**Files:**
- Create: `js/exam.js`
- Modify: `js/menu.js` (wire the button)

**Interfaces:**
- Consumes: `buildSession` exam mode, `scoreExam`, `applyAnswer`, and the summary view from
  Task 4.

**Behavior:**
- A countdown starts at 25 × 90 s (fewer questions if fewer are available).
- Prev and Next buttons, plus a question-number strip showing which questions are answered.
- Answers can be changed until the student taps "Finish exam" (which asks for confirmation if any
  are unanswered) or the time runs out.
- When it ends: `scoreExam`, then `applyAnswer` for each question, then the summary with every
  question in the post-submit view.
- No effects during the exam. One pulse on the result.

- [ ] **Step 1:** Build it.
- [ ] **Step 2:** Verify: start an exam, answer 2 questions, set the timer to 5 s from the dev
  console (`window.__examSeconds = 5`, read at start), and confirm that time-up finishes the exam,
  the unanswered questions score wrong, and they appear in the Drill count.
- [ ] **Step 3: Commit** with `feat: exam mode`.

### Task 6: Questions in, publish

- [ ] **Step 1:** Run a checker agent per chapter (`work/CHECKER-BRIEF.md`). Each one writes
  `work/checked/chNN.json` plus a short log of the fixes and drops it made.
- [ ] **Step 2:** `node tools/build-questions.mjs && node --test tests/` should PASS, and the
  total should be about 400.
- [ ] **Step 3:** Create the repo: `gh repo create TISMND/mse606-quiz --public --source . --push`.
- [ ] **Step 4:** Turn on Pages: `gh api -X POST repos/TISMND/mse606-quiz/pages -f
  "source[branch]=main" -f "source[path]=/"`.
- [ ] **Step 5:** Set the custom domain through the `CNAME` file (Tim's Cloudflare record needs to
  exist by now), wait for the certificate, then
  `gh api -X PUT repos/TISMND/mse606-quiz/pages -F https_enforced=true`.
- [ ] **Step 6:** Verify live on https://mse606.tozicabingames.com: the page loads, anonymous auth
  works, an answer is saved, Google sign-in works (this needs Tim's console steps 2 and 3), and it
  looks right on a phone-sized window.
