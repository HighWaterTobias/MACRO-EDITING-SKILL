---
name: new-macro-edit
description: Full step-by-step workflow for editing a FANUC control macro (like O9030) kept in a post repo, from pulling the latest version to putting the finished rev back into main. Runs the macro-sync, macro-branch, macro-plan, macro-change, macro-test, macro-recheck and macro-finish steps in order, pausing between each. Every rev updates the program, its revisions log, its test cases and its flow chart together.
---

# New Macro Edit: Full Workflow

## Context (always applies)
- **Which macro:** macros live in a post repo under `OTHER RELEVANT ASSETS TO POST PROCESSORS/<macro folder>/`. Each one has a `<program> REVISIONS.md` with a **Macro facts** block (program number, program file, rev line, current rev, test cases file, flow chart file and artifact link, what calls it). Find them by searching that folder for `## Macro facts`. One found: use it. Several: ask which one. **(WAIT)** None: stop and say no macro is set up in this repo; `/macro-new` sets one up. Below, `<macro file>` is the program file named there, `<folder>` its folder, `<O>` its program number. `main` = the proven version that runs on the machine.
- The user is a machinist, not a programmer. Explain everything in plain shop terms: what the macro makes the machine do, not programming words. Go slow, and never do more than the current step asked for.
- At every point marked **(WAIT)**, stop and wait for the user's answer.
- **Never commit, push, or merge without the user's explicit OK.**
- **Macro edits never touch the post.** If the change needs the post to send something different in the `G65` line, stop and say that's a separate post edit (`/new-post-processor-edit`), done on its own branch.
- **The simulator:** `node "$HOME/.claude/skills/macro-test/macro-sim.js"` (run it with Bash; folder names have spaces, so quote every path). If it's missing, stop and tell the user to run `install.ps1` in `C:\Repos\MACRO-EDITING-SKILL`.

- **Where these skills live:** their own repo, `HighWaterTobias/MACRO-EDITING-SKILL` (local copy `C:\Repos\MACRO-EDITING-SKILL`), separate from the post editing skills. To change how a macro skill or the simulator works, edit it there, on a branch, and run its `install.ps1`. Never add skill files to a post repo.

## The seven steps

| # | Step | Skill |
|---|------|-------|
| 1 | Get the latest from GitHub | `macro-sync` |
| 2 | Describe the change and create a branch | `macro-branch` |
| 3 | Plan the edit and its test cases (talk only, no editing) | `macro-plan` |
| 4 | Make the edits, add test cases, bump the rev, update the log and flow chart, macro check, compare in VS Code | `macro-change` |
| 5 | Desk check: run this edit's test cases on the old and new rev with the simulator | `macro-test` |
| 6 | Confirm old behavior is not affected: run every saved test case | `macro-recheck` |
| 7 | Put it back into main: one question, one yes saves it, puts it in main, sends it to GitHub, republishes the flow chart | `macro-finish` |

## How to run it

1. **Find the starting point.** By default start at Step 1. If the user says they're picking up partway (or there's already a `notes/<branch-name>.md` for the current branch), check `git status`, the current branch and the notes file, tell the user which step it looks like you're on, and ask where to start. **(WAIT)**

2. **For each step, in order:**
   - Announce it first, in this exact form: **"Step N of 7: <step name>"**, plus one plain sentence on what this step does.
   - Invoke the step's skill and follow it fully, including every (WAIT) inside it.
   - When the step is done, give a one- or two-line recap, then ask: **"Ready to move on to Step N+1: <name>?"** **(WAIT)**
   - **Exception, Step 5 → Step 6 → Step 7:** when the desk check passes, go straight into `macro-recheck` (quick and quiet). When the recheck passes, go straight into `macro-finish`. Its one question is the pause.

3. **The fix loop (going back).**

   ```
   Step 5 Desk check ──passed──► Step 6 Recheck ──passed──► Step 7 Finish
       │                             │
    surprise                 old behavior changed
       │                             └─ (user OKs a new way) ──► Step 4 (fix mode) ──► Step 5 ──► Step 6
       ├─ test case written wrong ──► fix the case (with OK), stay on Step 5
       ├─ edit is off ──► Step 4 (fix mode) ──► Step 5
       └─ plan wrong  ──► Step 3 (revise) ──► Step 4 ──► Step 5
   ```

   - Every time you go backward, say where and which round, e.g. **"Going back to Step 4 of 7: Make the edits (fix mode, round 1 surprises)"**.
   - Coming back into the test, say **"Step 5 of 7: Desk check (round N)"**.
   - `macro-test` stops the loop after 3 rounds without passing so the user can step back and decide.

4. **Stopping partway.** Tell the user which step is finished and which is next, which branch they're on and whether anything is unsaved (in plain words), and the command to pick back up, e.g. *"Next time, type `/macro-test` to pick up at Step 5."* Add a line to the bottom of the notes file: `Stopped after Step 4 (macro-change) on <date>. Next: /macro-test.`

5. **Finishing.** After Step 7, repeat macro-finish's reminders: which file and rev to load onto the control, and the machine prove-out list. Congratulate briefly.

## The desk check and the machine prove-out
- **Desk check (Steps 5 and 6):** the simulator steps through the macro on the PC for each saved test case and reports what it does: the blocks it sends (like the `M165` touch-off), an alarm, `M99`, or an endless loop. It checks the macro's **logic**. It stops with `SIM ERROR` on anything it wasn't built for instead of guessing.
- **Machine prove-out (after Step 7):** the desk check can't prove machine setup (which variable holds the tool in the spindle, where the offset table starts, what the touch-off macro does, control parameters). Every rev gets proven at the control before production. `macro-finish` gives the list, and the result goes in the revisions log the next time (`Machine prove-out` in Macro facts).

## Rev letters
Each branch is one rev: the next letter after **Current rev** in Macro facts (B → C). The rev line in the program, the revisions log, the flow chart header and footer, and Macro facts all get the same rev and date, in the same commit. The file name never changes.

## Rules for the whole run
- Never skip a step without asking. If the user wants to skip one (especially the desk check), say plainly what the risk is and let them decide. **(WAIT)**
- Never run two steps back to back without the pause, except the Step 5 → 6 → 7 run above.
