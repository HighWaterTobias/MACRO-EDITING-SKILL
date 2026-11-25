---
name: macro-finish
description: Step 7 (last step) of the macro edit workflow. After the desk check and recheck passed, asks one plain question, "put it back into main?", and on a yes saves the macro, revisions log, test cases, flow chart and notes in one commit, merges into main, sends main to GitHub, deletes the branch, republishes the flow chart to its artifact link, checks it's correct in the cloud and here, and gives the load-and-prove-out list for the control.
---

# Macro Finish: Put It Back Into Main

## Context (always applies)
- **Which macro:** search `OTHER RELEVANT ASSETS TO POST PROCESSORS/` for `## Macro facts` (in `<program> REVISIONS.md`). One: use it. Several: ask. **(WAIT)** `<macro file>`, `<folder>`, `<O>`, the test cases file, the flow chart and its artifact link come from Macro facts. `main` = the proven version.
- The user is a machinist, not a programmer. Plain shop terms, go slow.
- At every **(WAIT)**, stop and wait for the user's answer.
- **Never commit, push, or merge without the user's explicit OK.** In this step, the yes to the one question in step 2 is that OK, for everything listed in it.

## Steps

### 1. Check everything first (quietly; only talk if one fails)
- **On a branch**, not `main`.
- **Desk check passed** and **Recheck passed** in the notes, after the last change. If not, warn plainly (*"Nobody has checked this rev's logic"* / *"Nobody has checked that old behavior still works"*) and ask. **(WAIT)**
- **Macro check passes:** `node "$HOME/.claude/skills/macro-test/macro-sim.js" --check "<folder>/<macro file>"`.
- **Everything shows the same rev:** the rev line in the program, **Current rev** in Macro facts, the newest `### Rev` entry in the log, and the flow chart's header line and footer all show the plan's rev letter and date. If any is off, say which. **(WAIT)**
- **The whole rev travels together:** `git diff --stat main` should show the program, the revisions log, the test cases file and the flow chart (plus the notes). If the program changed but the chart didn't, stop: every rev updates the chart in the same commit. **(WAIT)**
- **Nothing that shouldn't go to GitHub:** `git status` shows nothing from `test-output/` or `TEST PARTS/`, and no `.nc` / `.cnc` file. The post file isn't changed on this branch.
- **Main on GitHub hasn't moved:** `git fetch origin`, `git rev-parse main origin/main` match, and `git merge-base --is-ancestor main HEAD`. If not, stop and explain. **(WAIT)**

### 2. Ask the one question
Write the save note first: a short first line naming the program and rev (e.g. `O9030 Rev C: alarm when touch-off fails`), a blank line, 2–4 plain lines on what the machine does differently and why (from the notes), and which test cases were added or changed. End with the co-author line the session's attribution rules give, if any.

Then ask, filled in:

> **We're ready to put <O> Rev <x> back into main.**
> We made a branch off main called `<branch-name>`, changed the macro (<one plain line>), desk checked it (<n> cases for this edit, round <N>), checked that every saved case still acts the same except the ones meant to change (<n> cases), and updated the revisions log and flow chart. This is **Rev <x> <date>**.
>
> **Do you want to put it back into main?** One yes does all of this:
> 1. **Save** the macro, revisions log, test cases, flow chart and notes together, with this note:
>    ```
>    <save note>
>    ```
> 2. **Put it into main**, so it becomes the proven macro.
> 3. **Send main to GitHub.**
> 4. **Delete the branch** here (and on GitHub if it's there).
> 5. **Update the flow chart link** (<artifact link>) to Rev <x>.
>
> **Yes or no?**

**(WAIT)** No, or wants the note changed: change just that and ask again. Not finishing now: say nothing changed and `/macro-finish` picks it up.

### 3. Do it all (only after the yes)
Set `Status: Finished, put into main on <today> (Rev <x>)` in the notes, then:
```
git add "<folder>" "notes/<branch-name>.md"
git commit -F test-output/commit-note.txt      # the approved note, written to this file first
git switch main
git merge --no-ff <branch-name> -m "Merge branch '<branch-name>': <first line of the note>"
git push origin main
git branch -d <branch-name>
```
If `git ls-remote --heads origin <branch-name>` shows it on GitHub: `git push origin --delete <branch-name>`.
On trouble: merge clash → `git merge --abort`, back to the branch, explain; push fails → say it's in main here but not on GitHub, keep the branch, never force-push; `git branch -d` refuses → don't force it.

**Republish the flow chart:** use the Artifact tool. First `read` the artifact link from Macro facts (a publish to a link this conversation hasn't read is refused), then `publish` with `file_path` = the flow chart file in the repo and `url` = that link. Don't pass `icon`. If it fails, say the chart in the repo is right but the link still shows the old rev, and how to retry.

### 4. Check it and say so: correct in the cloud, correct here
```
git fetch origin --prune
git rev-parse main origin/main
git status -sb
git branch -a --list "*<branch-name>*"
```
All match, nothing unsaved, branch gone, program shows the new rev line, and the chart link republished:

> ✅ **It's correct in the cloud and correct here.** Main on GitHub and here are the same (**<O> Rev <x> <date>**, save <short hash>), nothing is left unsaved, the branch is cleaned up, and the flow chart link shows Rev <x>.

If anything doesn't match, don't say ✅. Say which part isn't right and what to do. **(WAIT)**

### 5. Load it onto the control and prove it out
- **The file to load:** `<folder>\<macro file>` (full path), Rev <x>. It replaces the old <O> on the control. The rev line shows right under the program name, so the operator can check which rev is loaded. Many controls protect the O9000 range: the operator may need to unlock program editing (a parameter or key switch) to replace it. Lock it again after.
- **Prove it out before production.** The desk check proved the logic, not the machine setup. Build a short list from this rev's new and changed test cases, plus one plain "in the window" case, each as: what to set on the control, the `G65` line to run in MDI, and what should happen. For example:
  1. Note the real H offset for the tool first, so it can be put back.
  2. Set H<n> to <value>, run `G65 P<O> D.. H..` in MDI, single block on: expect <alarm / M99>.
  3. For any case that runs a touch-off, the machine will move to the tool setter: clear the work area, feed and rapid override low, hand on feed hold.
  4. **Put the real offset back** after each case.
- Say: "When it's proven at the machine, tell me and I'll record it." Recording it later is a small change on its own branch: update **Machine prove-out** in Macro facts and add a line under that rev in the log, following the same save / merge / send steps with the user's OK.

Stop here.
