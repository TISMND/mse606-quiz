# MSE 606 Study Quiz: Glossary and "Terms You Struggle With"

*2026-11-12. Status: draft for Tim's approval. Extends `2026-11-12-mse606-study-quiz-design.md`.*

## Why

Missing a question often means a student doesn't really know a term: enrichment versus enlargement,
random versus assignable variation. Tim wants students to see which terms they struggle with and
to look up any term quickly, in the app's existing Night Shift style. Mockups approved:
`.superpowers/brainstorm/*/content/glossary-v1.html` (option 3, open in place) and `glossary-v2.html`.

## Goals

- A glossary of the course's key terms, each with a short definition, a fuller explanation, and
  where present the terms it's confused with and the exam trap.
- A "Terms You Struggle With" view: the terms behind the student's current wrong-answer pool,
  most-missed first.
- On a wrong answer, a "View key terms" button that reveals the terms that question tests.

## Non-goals

- No new saved data per student. "Struggling" is worked out from the existing miss pool.
- No editing, notes or favourites on terms.
- No terms for chapters 4 or 13.

## Anti-goals

- **Wrong definitions.** Every definition must come from the chapter files and be checked by an
  independent agent, like the answer keys.
- **Breaking students who already use the app.** See Constraints.

## Constraints: live users (Tim)

Classmates are already using the live site. This change must:

- **Leave saved data alone.** Don't rename or remove anything in `users/{uid}` in Firestore, the
  `mse606.*` localStorage keys, or question ids. Additions only.
- **Work with a mix of old and new cached files** (GitHub Pages caches for about 10 minutes):
  - new code goes in new files;
  - new code copes when `glossary.json` is missing or `questions.json` has no `terms`. The
    feature hides itself rather than erroring;
  - nothing that exists today breaks if the new files fail to load.
- **Show the new feature immediately.** A student's existing misses drive "Struggling" on their
  first load after the update.

## Content

### `glossary.json`

Generated, committed and served:

```json
{ "terms": [ {
  "id": "job-enrichment",
  "term": "Job enrichment",
  "chapter": 7,
  "section": "7.2 Job Design",
  "short": "Giving workers more responsibility for planning and coordinating their work; vertical loading.",
  "more": "Example: supermarket stock clerks handling reordering. Focuses on the motivating potential of jobs; used in lean operations.",
  "confusedWith": [ { "id": "job-enlargement", "note": "a larger share of the same-level task (horizontal loading)" } ],
  "trap": "\"Job enrichment involves giving workers a greater share of the total task\" is FALSE: that's enlargement."
} ] }
```

**Fields:**
- `id`: the term as a kebab-case slug. It is permanent; never renamed once shipped.
- `short`: one sentence of at most about 25 words, shown in the list.
- `more`: optional, 1–3 sentences.
- `confusedWith`: optional. Its ids must exist in the glossary.
- `trap`: optional, taken from the chapter's "Trap:" notes.

**Which terms:** each chapter's end-of-chapter key-terms list, plus any bolded term in the chapter
that a question depends on. That comes to roughly 300 terms. If the same term appears in two
chapters, it gets one entry, homed in the chapter that defines it.

### Question tags

Each question in `work/checked/chNN.json` gains `"terms": ["job-enrichment", …]`, listing the
0–4 glossary terms whose meaning the question tests. This is an addition: nothing else changes,
and ids are unchanged. The bank build validates that every tag exists in the glossary.

### How the content is made

The same pattern as the questions, in two passes so a question can be tagged with a term from
another chapter *(Claude's call)*:

1. **Glossary.** One writer per chapter, then an independent checker per chapter that checks each
   definition and trap against the chapter text. `tools/build-glossary.mjs` merges and validates.
   An id used by two chapters with genuinely different meanings is flagged, and the two get
   qualified ids. Ids are permanent, so collisions are settled before shipping.
2. **Tags.** One agent per chapter tags its questions against the full merged id list. Checkers
   then verify each tag against the question.

The bank build fails on any tag that isn't in the glossary.

**Loading** *(Claude's call)*: the existing files get only thin hooks, which load the new modules
with dynamic `import()` inside `try`. If the new files or `glossary.json` fail to load, the hooks
render nothing and the rest of the app is untouched.

## Screens

### Menu

- A third button under **Modes**: **"Terms You Struggle With"**, with a caption:
  - "N terms from your misses · full glossary inside" when N > 0;
  - "Glossary · M terms" when there are no misses.
- Never disabled. Hidden if `glossary.json` didn't load.

### Glossary screen

- Top bar: "← Menu" on the left, "Glossary" on the right.
- Two tabs:
  - **Struggling (N)**: terms tagged on questions currently in the miss pool, ignoring skipped
    and unknown ids. Each shows "Missed K×", where K is the number of missed questions tagged with
    it. Sorted by K, then by chapter. Empty state: "No struggling terms. Nice."
  - **All terms (M)**: every term, sorted by chapter then alphabetically. A search box matches
    the term and the short definition, case-insensitive.
- Opens on Struggling if N > 0, otherwise on All terms.
- **Term card:**
  - the term in bold green (`--good`), the chapter on the right, and `short` below;
  - in Struggling, "Missed K×".
- **Tapping a card opens it in place** (and tapping again closes it). It shows:
  - `more`;
  - **"Don't confuse with"**, listing each confused term in amber with its note;
  - **"Exam trap"** with a red left rule;
  - if K > 0, a **"Drill the K questions you missed →"** button, which starts a drill of just
    those questions.

### Question screen (practice and drill)

- After a **wrong** answer, if the question has terms: a mint outline button, **"View key terms · N ▾"**,
  goes below the last option with about 30px of space above it.
- Tapping it replaces the button with a "Key terms" section header and that question's term
  cards, which open in place the same way.
- Not shown after correct answers.

### Results review (session summary and exam results)

The expandable missed-question entries show the same "View key terms" button inside the expanded
view. *(Claude's call.)*

## Data

- "Struggling" is a pure function of the bank, the user's misses and skips, and the glossary.
- Nothing new is written to Firestore or localStorage. The glossary screen's tab and search state
  are not saved.

## Left to the builder

File split (likely `js/glossary.js` plus `js/terms-ui.js`), copy for small labels, the search
debounce, and how the "Drill the K questions" session reuses `runQuiz`.
