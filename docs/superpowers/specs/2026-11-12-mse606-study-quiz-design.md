# MSE 606 Study Quiz: design

*2026-11-12. Status: draft for Tim's approval.*

## Why

Tim is preparing for the MSE 606 (Operations Management, Stevenson) final and wants an online quiz
he can send to his classmates. It drills the **qualitative** part of the exam in the style of the
practice midterm (`practice-exam-1.md`, Part 1): mostly check-all-that-apply questions, where a
true textbook sentence is made false by changing one word. Success means classmates open a link on
a phone or laptop, pick chapters and a length, and come away knowing which chapters they're weak
on, with their misses saved for later drilling.

## Goals

- Practice sessions built from chapters and a length the student chooses.
- Clear feedback right after Submit, with good effects.
- A pool of misses that persists across sessions and devices, plus a drill mode for that pool.
- An exam mode with a timer and no feedback until the end.
- Per-student stats: average score and score by chapter.
- Looks good on phone and desktop. Long questions are fine to scroll.

## Non-goals

- Quantitative questions (worked numerical problems). They are covered elsewhere.
- Chapters 4 and 13. The course didn't cover them.
- Class-wide stats, leaderboards, or any view of other students' results.
- Showing trap types to students. Questions are still **tagged** with trap types so Tim can ask
  Claude later to analyze his own record ("which traps are getting me").
- An in-session "Attempt: N" retry loop. A miss goes into the drill pool instead.

## Anti-goals

- Wrong answer keys. The app must never mark a wrong answer correct or a correct one wrong. Every
  question is traceable to a chapter file statement.
- Friction before the first question: no sign-up form, no password.
- Any chance of a bill. The Firebase project stays on the free Spark plan.

## Content

- **Source:** `chapters/chNN.md` (ch01–03, 05–12, 14). Format and trap patterns are described in
  `README (3).md`. Question writing waits until Tim has supplied every chapter, and its exact
  approach is still open (Tim: "hold off on too much design thought until I get you the chapters").
- **Question types** (several per topic, as Tim asked): check-all-that-apply (the main type);
  single-answer multiple choice; true/false; "which is NOT/incorrect" (check-all over false
  statements); name-the-term from a description (shown as multiple choice).
- **File:** `questions.json` in the repo, one entry per question:

  ```json
  {
    "id": "ch07-014",
    "chapter": 7,
    "section": "7.2 Job design",
    "type": "cata | single | tf | not | term",
    "stem": "Which of the following is correct in regard to work design?",
    "options": [
      { "text": "Job enrichment involves giving workers a greater share of the total task.",
        "correct": false, "trap": "swapped-twin" }
    ],
    "source": "ch07.md: Commonly confused pairs, enlargement vs enrichment"
  }
  ```

  - `id` is permanent. Regenerating or editing a question keeps its id, because skips, misses and
    the answer log refer to it. A question removed from the bank is ignored wherever its id appears.
  - `trap` is set on false options only: `direction-flip`, `swapped-twin`, `inverted-ratio`,
    `absolute`, `qualifier`, `wrong-count`, `scope-shrink`, or `other`.
  - `tf` questions have two options, "True" and "False".
- **Option order** is shuffled at display time, except true/false (always True then False).
  *(Claude's call.)*
- **Key check:** every generated question is checked by a second, independent agent. It confirms
  that each option's `correct` flag matches the chapter text cited in `source`. Questions that
  fail are fixed or dropped before they reach `questions.json`. This is how the "no wrong answer
  keys" anti-goal is enforced. *(Claude's call.)*
- **Chapters with no questions yet** are hidden from the menu, so the app can go live before every
  chapter is written. *(Claude's call.)*
- **Public repo, private sources:** GitHub Pages needs a public repo. `chapters/`,
  `practice-exam-1.md` and the README notes stay gitignored. Only `questions.json` (answer keys
  included, which can't be avoided) is published. *(Claude's call.)*

## Screens and behavior

Look and feel: **Night Shift**, approved from the mockups (copies are in
`.superpowers/brainstorm/*/content/night-shift-v3.html`, which is gitignored and local only). Dark
navy background (`#0f1220`), cards in `#171b2e`, mint accent `#7cf7c5`, green `#2fd98a`, red
`#ff4d6d`, Space Grotesk with JetBrains Mono for numbers. Section headers are centered, bold,
near-white and spaced out, with a mint glow and a mint rule on each side (Tim: "I love the
headers").

### Main menu (one scrolling page)

1. Small "MSE 606 · Final prep" and the title "What are we studying?", both centered.
2. **Chapters**: a two-column grid of toggles, number and short name. "All" and "None" shortcuts
   are Claude's call.
3. **Length**: Short / Moderate / Long / Comprehensive, each showing how many questions it would
   give for the chapters selected. Counts update as chapters are toggled. Comprehensive = every
   unskipped question in the chosen chapters. Short / Moderate / Long = 15 / 35 / 70, capped at
   the Comprehensive count. Lengths whose count equals Comprehensive's show the same number.
   *(Numbers are Claude's call, from the mockup.)*
4. **Start practice** (primary button).
5. **Modes**
   - **Drill My Wrong Answers**, with "N misses waiting". Disabled when the pool is empty.
   - **Exam mode**: "Timed · feedback at the end".
6. **Stats**
   - Average score: a large number.
   - One bar per chapter with its percentage. Green at 80% or above, amber at 70–79%, red below
     70%, and a dash if the chapter has no answers yet.
   - **Reset stats** button with a confirm step. Reset clears **scores only**; the miss pool and
     the skip list stay (Tim).
7. A small sign-in line: "Sync across devices: sign in with Google" or "Signed in as …".
8. A way to see and un-skip skipped questions, for example "Skipped questions (N)" opening a
   list. *(Placement is Claude's call.)*

### Question screen (practice and drill)

- **Top bar:** "✕ Quit" on the left, "Question i of N" on the right, and a mint progress bar below.
  Quit returns to the main menu. Answers already submitted stay recorded.
- Chapter and section tag, the question, and a hint ("Check all that apply" / "Pick one" /
  "True or false").
- Options are full-width cards that are tapped to toggle. Single and true/false questions behave
  like radio buttons. **Submit** is disabled until something is selected.
- **After Submit:**
  - A verdict ("Nailed it" / "Not quite").
  - Each option shows its state:
    - Picked and correct: solid green, with "You picked" and "Correct answer" labels.
    - Picked and wrong: red, with a "You picked" label.
    - Correct but not picked: dashed green border, with a "Correct answer" label.
    - Neither: unchanged.
  - The fixed footer swaps Submit for **"Skip this question in future"** (checkbox) and **Next
    question →**, with clear space between them (Tim).
- **Effects:**
  - Correct: a green vignette pulse and a burst of colored sparks.
  - Wrong: a red vignette pulse and a short shake.
  - Effects respect `prefers-reduced-motion`.
- **Scoring:** a question is right only if the selected set exactly matches the correct set.
  There is no partial credit. *(Claude's call. The real exam's partial credit rule is unknown.)*
- **End of session:** a summary showing score, score by chapter for this session, a list of
  missed questions that can be reviewed, and "Back to menu".
- **Desktop shortcuts:** keys 1–9 toggle options, Enter submits and then advances.
  *(Claude's call.)*

### Drill My Wrong Answers

- Same screen as practice. The session holds the whole miss pool, shuffled.
- The pool is a set of question ids. A wrong answer in any mode adds the id. A correct answer
  **in drill** removes it.
- A correct answer in practice does not remove an id. *(Claude's call: the drill is the place to
  prove it.)*

### Exam mode

- Uses the chapters selected on the menu. *(Claude's call.)*
- Length: 25 questions, matching the size of the practice midterm's qualitative part.
- Timer: 1.5 minutes per question, shown as a countdown. The test is submitted when time runs out.
- The student can move back and forth between questions and change answers before finishing.
- At the end: score, score by chapter, and every question shown with the post-submit feedback.
- Wrong answers go into the miss pool.
- *(Length, timer and navigation are Claude's call. The real exam's format is unknown.)*

### Skipping

- Skipping is per question.
- A skipped question is left out of practice, exam and drill. It stays in the skip list until the
  student un-skips it.

## Data and accounts

- **Hosting:** new public GitHub repo (TISMND), served by GitHub Pages at
  `mse606.tozicabingames.com` through a `CNAME` file. Static HTML/CSS/JS with **no build step**,
  like tozicabingames-website. Firebase JS SDK loaded from the CDN as modules.
- **DNS:** tozicabingames.com is on Cloudflare. Add a CNAME `mse606 → tismnd.github.io` set to
  **DNS only** (grey cloud), so GitHub can issue the HTTPS certificate.
- **Unlisted:** `<meta name="robots" content="noindex">` and a `robots.txt` that disallows all.
  The questions paraphrase a copyrighted textbook. Shared by link only. No password or class code.
- **Firebase:**
  - A new project (for example `mse606-quiz`) on the Spark plan with no billing account. Firestore
    and Auth only.
  - If the free daily quota runs out, cloud saves fail until the reset, the app keeps working from
    local storage, and it syncs again later.
  - Claude creates the project, deploys the rules and writes the config from the Firebase CLI,
    which is already logged in.
  - Tim, in the Firebase console: create the Firestore database, enable the Anonymous and Google
    sign-in providers, and add `mse606.tozicabingames.com` to the authorized domains.
  - Tim, in Cloudflare: add the DNS record.
- **Auth:**
  - Anonymous sign-in happens silently on first visit.
  - "Sign in with Google" links the anonymous account to Google (`linkWithPopup`), so progress
    follows the student to other devices.
  - If that Google account already has data, the app signs into it and the anonymous progress
    from this device is merged into it.
  - Popup flow, not redirect (redirect is unreliable in Safari on a custom domain).
- **Firestore layout:**
  - `users/{uid}` holds:
    - `skipped`: a list of question ids.
    - `misses`: a map from question id to the time it was last missed.
    - `stats`: a map from chapter to `{ right, total }`.
    - `statsResetAt`.
  - Stats are counters updated with `increment()` on each answer. Reading the menu costs one
    document read, not one per answer.
  - `users/{uid}/answers/{auto}` holds the answer log: `{ qid, chapter, picked: [option index in
    the bank's order], correct, mode, at }`. It's written once per answer and never read by the
    app. It exists so Claude can analyze one student's traps when asked.
  - Rules: a signed-in user can read and write only `users/{their uid}` and below. Nothing else is
    readable.
- **Local copy:** the app mirrors `users/{uid}` in `localStorage` and queues answer writes while
  offline (the Firestore offline cache does this).
- **Answers that count toward stats:** every graded answer in practice, drill and exam. In exam
  mode, the answer that counts is the one in place when the exam is finished. There is no
  "first-ever answer only" rule, so the average follows recent performance. *(Claude's call.)*
- **Signing in to a Google account that already has data** (for example on a second device):
  before switching accounts, the app reads the anonymous account's document and answer log. It
  then signs in to the Google account and merges:
  - **Stats:** added together.
  - **Misses and skips:** combined. Where both have a miss for the same question, the later time
    is kept.
  - **Answer log:** copied across. A few hundred writes fits easily in the free daily quota.

  *(Claude's call.)*
- **Reset stats:** zeroes `stats` and sets `statsResetAt`. It doesn't touch `misses`, `skipped` or
  the answer log.

## Left to the builder

File structure, module split, the exact layout of the end-of-session summary, spark and pulse
tuning, empty and error states, and the copy for small labels. Keep it plain JS with no framework
or bundler unless there's a concrete reason.
