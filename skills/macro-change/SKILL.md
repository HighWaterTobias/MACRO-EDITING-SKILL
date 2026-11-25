---
name: macro-change
description: Step 4 of the macro edit workflow. Makes the approved edits to the macro one small change at a time, showing and explaining each and pausing between them, adds the planned test cases, does the rev as the last change (rev line, revisions log, Macro facts, flow chart), runs the macro check, and opens a VS Code compare of the proven macro against the edited one. Also runs in fix mode after macro-test finds surprises.
---

# Macro Change: Make the Edits

## Context (always applies)
- **Which macro:** search `OTHER RELEVANT ASSETS TO POST PROCESSORS/` for `## Macro facts` (in `<program> REVISIONS.md`). One: use it. Several: ask. **(WAIT)** `<macro file>`, `<folder>`, `<O>`, the test cases file and the flow chart come from Macro facts. `main` = the proven version.
- The user is a machinist, not a programmer. Plain shop terms, go slow, never do more than this step.
- At every **(WAIT)**, stop and wait for the user's answer.
- **Never commit, push, or merge without the user's explicit OK.**
- **The simulator:** `node "$HOME/.claude/skills/macro-test/macro-sim.js"` (quote every path).

## Hard rules
- Follow **only** the approved plan in `notes/<branch-name>.md`. One small change at a time.
- **Never touch anything outside the plan**: no fixing spelling in old comments, renumbering, tidying or "while I'm in here". If something else looks wrong, stop, explain, and ask. **(WAIT)** If the user agrees, add it to the plan first, then do it as its own change.
- **Keep the file's style:** plain capitals, the same line endings the file already has (check with `file "<folder>/<macro file>"`), no tabs, no characters beyond plain keyboard characters. Never add a file extension to the program file.
- Never edit the post file.

## Steps

### 0. Check where we are
On `main`: stop, edits only happen on a branch. No approved plan in the notes: stop, point to `/macro-plan`. If the notes status says `Desk check found surprises` and the latest round says **edit off**, go to **Fix mode** below. Otherwise read the numbered changes back in one short list.

### 1. For each change in the plan
1. "Change N of M: <what it makes the machine do>."
2. Make that one edit with the Edit tool.
3. Show it: `git diff -- "<folder>/<macro file>"` (lines removed `-`, added `+`).
4. Explain what the old lines did, what the new ones do, and what the machine will do differently.
5. "Good to move on to Change N+1?" **(WAIT)** Fix just that change if the user wants it different.

### 2. Add the test cases
Add the plan's **new** cases to the test cases file and change the Expect lines of the plan's **changed** cases, nothing else. Show the diff of that file and ask before going on. **(WAIT)**

### 3. The rev (always the last change)
Use the rev letter from the plan and **today's date** (update the notes file if the date moved).
1. Change the `(REV x YYYY-MM-DD)` line under the O line. Show it.
2. Revisions log: add `### Rev <x> — <date>` with plain lines on what changed, why (from the notes), and which test cases were added or changed. In Macro facts set **Current rev** to the new letter, and **Machine prove-out** to `Rev <x> not yet proven at the machine`.
3. Flow chart (`<flow chart file>`): change only the boxes, decisions, arrows and cards the plan affects, keep the layout and look, and update the rev in the header line and the footer. If the chart's logic needed a big rearrange, say so and ask before redrawing. **(WAIT)** Don't republish the artifact link here: that happens in `macro-finish`, after the merge, so the link always shows the proven rev. To let the user look at the new chart now, open the file in their browser (PowerShell: `Start-Process "<full path to the flow chart file>"`).
Show all three diffs together and ask: "Rev looks right?" **(WAIT)**

### 4. Macro check
```
node "$HOME/.claude/skills/macro-test/macro-sim.js" --check "<folder>/<macro file>"
```
- **PASSED:** say the file has no typos that would stop it at the control (comments closed, brackets match, every GOTO lands, ends with M99, rev line found). Say this doesn't prove the logic; that's the desk check next.
- **NOTE lines:** read them out plainly. A "can never run" note that was already there before this branch is fine; a new one means a change may have cut off a path. Ask. **(WAIT)**
- **FAILED:** show the line, explain it simply, propose the smallest fix, and ask before applying. **(WAIT)**
- Also check the rev line letter matches Macro facts and the flow chart footer. If not, fix it as part of the rev change.

### 5. Summarize and open the compare in VS Code
- `git diff --stat` and one plain line per change.
- Save main's copy and open the compare (make sure `.gitignore` has `test-output/` first):
  ```
  mkdir -p test-output/compare
  git show "main:<folder>/<macro file>" > "test-output/compare/<macro file>_main"
  ```
  ```powershell
  $code = (Get-Command code -ErrorAction SilentlyContinue).Source
  if (-not $code) { $code = @("$env:LOCALAPPDATA\Programs\Microsoft VS Code\bin\code.cmd", "$env:ProgramFiles\Microsoft VS Code\bin\code.cmd") | Where-Object { Test-Path $_ } | Select-Object -First 1 }
  & $code --diff "<full path>\test-output\compare\<macro file>_main" "<full path>\<folder>\<macro file>"
  ```
  "Proven macro (main) on the left, your edited macro on the right. Don't type in the right side; that's the real file." If VS Code isn't found, say so and carry on.
- Notes: `Status: Edits done, not tested`. Don't commit. "Edits are done. Next is the desk check (`/macro-test`)." Stop.

## Fix mode (after the desk check found surprises)
1. "We're in fix mode for desk check round <N>. Here's what it caught:" list the surprises with before / after / expected.
2. For each, find the line(s) causing it (use `--trace` on that case) and explain why in machine terms. Propose the smallest fix for each (Fix 1, Fix 2…) and ask. **(WAIT)**
3. Add them to the notes under `## Fix for round <N>`.
4. Make them one at a time with the diff and an OK after each. **(WAIT)**
5. If a fix changes what the flow chart shows, update the chart too. Keep the same rev letter; update the date if it's a later day.
6. Run the macro check. Notes: `Status: Fixes for round <N> done, not retested`. "Fixes are in. Ready to run the desk check again?" **(WAIT)** On yes, go into `macro-test`. Don't commit.
