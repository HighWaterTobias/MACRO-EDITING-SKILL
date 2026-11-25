---
name: macro-plan
description: Step 3 of the macro edit workflow. Planning only, no editing. Walks through the part of the macro the change touches in shop terms, lays out what the machine does before and after, numbers the small changes, plans the new and changed test cases, adds the rev bump (program, log, flow chart) as the last change, and writes the approved plan to the notes file.
---

# Macro Plan: Talk About the Edits (NO EDITING)

## Context (always applies)
- **Which macro:** search `OTHER RELEVANT ASSETS TO POST PROCESSORS/` for `## Macro facts` (in `<program> REVISIONS.md`). One: use it. Several: ask. **(WAIT)** None: stop; `/macro-new` sets one up. `<macro file>`, `<folder>`, `<O>`, the test cases file and the flow chart come from Macro facts. `main` = the proven version.
- The user is a machinist, not a programmer. Plain shop terms, go slow, never do more than this step.
- At every **(WAIT)**, stop and wait for the user's answer.
- **Never commit, push, or merge without the user's explicit OK.**
- **Macro edits never touch the post.** If the fix needs a different `G65` line from the post, say it's a separate post edit (`/new-post-processor-edit`) and plan only the macro side here.
- **The simulator:** `node "$HOME/.claude/skills/macro-test/macro-sim.js"` (quote every path).

## Hard rule
**Do not edit the macro, the log, the test cases or the flow chart in this step.** The only file this step writes is the notes file.

## Steps

### 0. Check where we are
`git branch --show-current`: on `main`, stop and point to `/macro-branch`. **(WAIT)** Read `notes/<branch-name>.md` and read the **Why this branch exists** back in one or two lines. No description: ask the four questions from `macro-branch` step 1 and add it first. **(WAIT)**

### Coming back from a failed desk check (revising the plan)
If the notes status says `Desk check found surprises` and the latest round says the cause is **plan wrong**: say which surprises showed the plan missed something, keep what worked, change only what the test showed, check the edits already made (`git diff main -- "<folder>"`), keep the rev letter, save the old plan under `## Earlier plan (before round <N>)`, set `Status: Plan revised after round <N>`, and go through steps 2–5 for just the revised part.

### 1. Walk through the part of the macro this touches
Read `<macro file>` and the flow chart. Explain the part involved in machine terms, quoting the real lines with their line numbers: which variables it reads (and what they are on the machine, e.g. `#1035` tool in spindle, `#11000+T` H geometry offset), what it compares, where it jumps, what it sends or alarms. Run the trace for one relevant saved case to show the path today:
```
node "$HOME/.claude/skills/macro-test/macro-sim.js" "<folder>/<macro file>" "<folder>/<test cases>" --case TC4 --trace
```

### 2. Lay out the plan
- **What will change:** one or two sentences in machine terms.
- **Where:** which lines / sections.
- **Small changes, numbered:** Change 1, Change 2, … each one small enough to show and check on its own. Write the exact new lines for each.
- **Machine behavior before/after:** for the situations that change, e.g.
  ```
  Offset still 99 after touch-off
  BEFORE: M165 P9857 T6 | M165 P9857 T6 | ... forever
  AFTER:  M165 P9857 T6 | ALARM #3000=2 TOUCH OFF FAILED
  ```
- **What should NOT change:** which situations must act exactly the same.
- **Macro rules to respect:**
  - N numbers stay unique, and every `GOTO` lands on an N.
  - Alarm numbers: say which `#3000=n` this uses and that it's not already used for a different message.
  - Variables: list every variable the change uses. Prefer locals (`#1`–`#33`) for scratch values. Flag any common (`#100`–`#199`, `#500`–`#999`) or system variable, and say why it's needed.
  - Inch values: say so if the change adds a number that only makes sense in inches.
  - Keep comments on their own lines in the same style as the program, plain capitals.

### 3. Plan the test cases
- **New case(s):** for each new behavior, write the full case in the test case file's format (`### TCn title`, `Why:`, `- Call:`, `- Machine:`, `- Touch-off sets:` if a touch-off runs, `- Expect:`), with `(Rev <next>)` at the end of `Why:`.
- **Changed cases:** any saved case whose Expect line changes because of this edit. List each with the old and new Expect and why. Every other saved case must stay exactly the same.
- If the change uses a machine variable the simulator doesn't know about, the new case must give its value on the `Machine:` line.
- If the change uses something the simulator wasn't built for (e.g. `WHILE` loops, a `G65` call to another macro, `M99 P`), say so plainly: the desk check can't cover it, and that part is proven at the machine only. Ask whether to go on. **(WAIT)**

### 4. Add the rev as the last change
The last numbered change is always **the rev**: next letter after **Current rev** in Macro facts, today's date. It does all of these:
1. Change the `(REV x YYYY-MM-DD)` line under the O line.
2. Add `### Rev <x> — <date>` to the revisions log with plain lines on what changed and why, update **Current rev** in Macro facts, and set **Machine prove-out** to say this rev isn't proven yet.
3. Update the flow chart HTML: the boxes, decisions and arrows that changed, the example and "watch for" cards if they're affected, and the rev in the header line and footer.

### 5. Save the plan
Show the full plan and ask: "Is this the plan?" **(WAIT)** Revise until approved. Then add to the notes file:
```
## Plan (approved <date>)
Rev: <x> <date>
### Changes
1. ...
N. Rev <x>: rev line, revisions log + Macro facts, flow chart
### Machine behavior before/after
...
### Should NOT change
...
### Test cases
New: TCn ... (full text)
Changed: TCm Expect old → new, why
```
Set `Status: Planned, not edited`. Say: "Plan is saved. Next is making the edits (`/macro-change`)." Stop.
