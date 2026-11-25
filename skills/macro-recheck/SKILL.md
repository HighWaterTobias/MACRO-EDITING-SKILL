---
name: macro-recheck
description: Step 6 of the macro edit workflow, "Confirm old behavior is not affected". After macro-test passes, quietly runs every saved test case on the proven macro and the edited macro with the simulator, and says in one or two lines whether everything old still works. If an old case broke, says which and proposes another way to make the edit, and asks before changing anything.
---

# Macro Recheck: Confirm Old Behavior Is Not Affected

## Context (always applies)
- **Which macro:** search `OTHER RELEVANT ASSETS TO POST PROCESSORS/` for `## Macro facts` (in `<program> REVISIONS.md`). One: use it. Several: ask. **(WAIT)** `<macro file>`, `<folder>`, `<O>` and the test cases file come from Macro facts. `main` = the proven version.
- The user is a machinist, not a programmer. Plain shop terms, go slow, never do more than this step.
- At every **(WAIT)**, stop and wait for the user's answer.
- **Never commit, push, or merge without the user's explicit OK.**
- **The simulator:** `node "$HOME/.claude/skills/macro-test/macro-sim.js"` (quote every path).

## The idea, in shop terms
Every past rev left test cases behind: situations the macro must keep handling the same way. This step runs all of them on the proven and the edited macro. The only cases allowed to change are the ones this edit's plan listed. It's quick, and stays quiet unless something old broke.

## Steps

### 0. Check where we are
On `main`: stop. Notes status should be `Desk check passed`. If not, say the desk check comes first (`/macro-test`). **(WAIT)**

### 1. Run everything, quietly
```
mkdir -p test-output/compare
git show "main:<folder>/<macro file>" > "test-output/compare/<macro file>_main"
node "$HOME/.claude/skills/macro-test/macro-sim.js" --check "<folder>/<macro file>"
node "$HOME/.claude/skills/macro-test/macro-sim.js" "<folder>/<macro file>" "<folder>/<test cases>" --before "test-output/compare/<macro file>_main"
```
Read the output without dumping it on the user.

### 2. Sort it
- Every case must **PASS**.
- Every case must be **SAME**, except the new and changed cases in this edit's plan.
- The macro check must pass, with no new NOTE lines since main (compare with `--check` on the main copy).
- No new close-call WARN lines that main didn't have.

### 3. Tell the user, briefly
- **All good:** one or two lines, e.g. *"All 11 saved cases checked. The only ones that act differently are TC9 and TC11, which this edit meant to change. Everything else is the same as Rev B."* Set `Status: Recheck passed (<date>)` in the notes, then go into `macro-finish` (inside `/new-macro-edit`, straight on).
- **Something old broke:** say which case, in machine terms (what it did before, what it does now, what it should do), and which past rev it came from (the `(Rev x)` in its Why line). Use `--trace` on that case to find the line responsible. Propose a different way to make the current edit that keeps the old behavior, and ask before changing anything. **(WAIT)** On an OK, add it to the plan as `## Fix for recheck round <N>` and go into `macro-change` fix mode, then back through `macro-test` and this step.
- **The old case itself is out of date** (the user says the old behavior should change too): that's a plan change. Add it to the plan's changed cases with the user's OK **(WAIT)**, update that case's Expect line, and rerun this step.

### 4. Record the round
Add to the notes:
```
### Recheck round <N> (<date>)
<n> cases, macro check passed. Changed as planned: TCx, TCy. Result: passed | <what broke>
```
