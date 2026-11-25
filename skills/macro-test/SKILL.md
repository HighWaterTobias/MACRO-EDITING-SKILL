---
name: macro-test
description: Step 5 of the macro edit workflow. Desk check with the macro simulator (macro-sim.js, in this skill's folder) - runs this edit's new and changed test cases on the proven macro (main) and the edited macro, shows what each one does before and after, marks every difference EXPECTED or SURPRISE, and steers around the fix loop on surprises, counting rounds.
---

# Macro Test: Desk Check

## Context (always applies)
- **Which macro:** search `OTHER RELEVANT ASSETS TO POST PROCESSORS/` for `## Macro facts` (in `<program> REVISIONS.md`). One: use it. Several: ask. **(WAIT)** `<macro file>`, `<folder>`, `<O>` and the test cases file come from Macro facts. `main` = the proven version.
- The user is a machinist, not a programmer. Plain shop terms, go slow, never do more than this step.
- At every **(WAIT)**, stop and wait for the user's answer.
- **Never commit, push, or merge without the user's explicit OK.**
- **The simulator:** `node "$HOME/.claude/skills/macro-test/macro-sim.js"` (this skill's folder; quote every path). If it's missing, stop and tell the user to run `install.ps1` in `C:\Repos\MACRO-EDITING-SKILL`.

## The idea, in shop terms
The simulator steps through the macro on the PC, the way the control would, for each saved test case: what tool is in the spindle, what the offset says, what the post sent in the `G65` line, and what the touch-off writes. It reports what the macro does: the blocks it sends, `M99`, an alarm, or an endless loop. We run the same cases on the proven macro and the edited one and compare. It checks **logic only**. It stops with `SIM ERROR` on anything it wasn't built for, and never guesses. Machine setup is proven at the control after the merge.

What the simulator shows:
- `PASS` / `FAIL`: did the edited macro do what the case's `Expect` line says.
- `SAME` / `CHANGED`: did it act differently from the proven macro.
- `WARN ... close call`: a comparison where the two numbers are equal to 6 decimals (e.g. an offset exactly on the limit). The real control could go either way there.
- `SIM ERROR`: the simulator stopped on a line. Read the message: usually a case is missing a `Machine:` value, or the macro uses something the simulator wasn't built for.

## Steps

### 0. Check where we are
On `main`: stop. Read the notes: the plan's **Test cases** list (new and changed) and the round count under `## Desk check rounds`. Status should be `Edits done, not tested` or `Fixes for round <N> done, not retested`. If the macro or test cases changed after the last check, that's fine; this run replaces it.

### 1. Keep test files out of GitHub
`.gitignore` must have `test-output/`. Add it and say so if not.

### 2. Get the proven copy
```
mkdir -p test-output/compare
git show "main:<folder>/<macro file>" > "test-output/compare/<macro file>_main"
```

### 3. Run this edit's cases, before and after
For each new and changed case from the plan:
```
node "$HOME/.claude/skills/macro-test/macro-sim.js" "<folder>/<macro file>" "<folder>/<test cases>" --before "test-output/compare/<macro file>_main" --case TCn
```
(A brand-new case may hit something the old macro can't do. That shows as `CHANGED` with the old behavior on the before line, which is what we want to see.)

### 4. Sort every result
For each case, show the call, what the macro did before and after, and mark it:
- **EXPECTED:** after matches the plan's before/after, and the case PASSES.
- **SURPRISE:** anything else: a FAIL, a CHANGED the plan didn't list, a SIM ERROR, or a new close-call WARN.

Present it as a short table in plain words, e.g.
```
TC11 touch-off leaves offset at 99
  before:  touch-off, touch-off, ... forever        (ENDLESS LOOP)
  after:   touch-off once, then alarm TOUCH OFF FAILED
  EXPECTED
```
Offer the step-by-step trace (`--trace`) for any case the user wants to see.

### 5. Record the round
Add to the notes under `## Desk check rounds`:
```
### Round <N> (<date>)
Cases: TC11, TC9
Result: passed | surprises
- TC9: SURPRISE ... (cause: test case written wrong | edit off | plan wrong)
```

### 6. Results
**No surprises (passed):** set `Status: Desk check passed (round <N>)`. Say: "The new behavior works on every case for this edit. Next I check every saved case to make sure nothing old changed." Go into `macro-recheck` (inside `/new-macro-edit`, straight on).

**Surprises:** for each, work out the cause and say it plainly:
- **Test case written wrong** (e.g. a wrong value on the Machine line, a typo in Expect): show the fix to the case and ask. **(WAIT)** Then rerun this step. A case's Expect line is only changed when the plan or the user says the macro is right and the case is wrong.
- **Edit off** (the plan was right, the edit missed): set `Status: Desk check found surprises`, say "Going back to Step 4: Make the edits (fix mode, round <N>)", and go into `macro-change` fix mode after an OK. **(WAIT)**
- **Plan wrong** (the plan didn't think of this situation): same status, say "Going back to Step 3: Plan the edit (revising after round <N>)", and go into `macro-plan` after an OK. **(WAIT)**

**Safety valve:** after 3 rounds without passing, stop the loop. Sum up what keeps failing and ask whether to keep going, rethink the plan, or set the branch aside. **(WAIT)**

## When the simulator itself seems wrong
If the user (or a machine prove-out) shows the control does something different from what the simulator says, believe the machine. Stop, say so plainly, and don't change a test case to match the simulator. The fix goes into `macro-sim.js` in `C:\Repos\MACRO-EDITING-SKILL\skills\macro-test\` on its own branch in that repo, with the machine result added as a test case.
