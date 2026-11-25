---
name: macro-branch
description: Step 2 of the macro edit workflow. Asks what the issue with the macro is and why the change is needed, writes that down as the reason for the branch, suggests a short branch name for approval, then creates the branch from main and saves the description to a notes file.
---

# Macro Branch: Describe the Change and Create a Branch

## Context (always applies)
- **Which macro:** search `OTHER RELEVANT ASSETS TO POST PROCESSORS/` for `## Macro facts` (in `<program> REVISIONS.md`). One: use it. Several: ask. **(WAIT)** None: stop; `/macro-new` sets one up. `<macro file>`, `<folder>`, `<O>` come from Macro facts. `main` = the proven version.
- The user is a machinist, not a programmer. Plain shop terms, go slow, never do more than this step.
- At every **(WAIT)**, stop and wait for the user's answer.
- **Never commit, push, or merge without the user's explicit OK.**

## Steps

### 1. Ask what the issue is
Ask all at once, and say a sentence or two each is fine: **(WAIT)**
1. **What's the issue?** What happens at the machine today: an alarm that shouldn't come up, one that should and doesn't, a touch-off that misbehaves, a hang, something you want it to do.
2. **When does it happen?** Which tools or situations (new tool, big drills, a certain offset). A real `G65 P<O> ...` line and the offset on the control help a lot.
3. **What do you want instead?** What the machine should do after the change.
4. **Why does it matter?** Safety, scrap, cycle time, operator trust, a specific job.

If an answer is missing or vague, ask one short follow-up for just that part. **(WAIT)** Don't read into the macro or plan here.

### 2. Read the description back
Write it as a short **change description**, e.g.:

> **Issue:** If the tool setter doesn't change the offset, O9030 repeats the touch-off forever.
> **When:** New tool (offset 99) and the touch-off fails without alarming.
> **Want instead:** Alarm "TOUCH OFF FAILED" after one try.
> **Why:** The machine can't sit in a loop unattended.

Ask: "Is this the right reason for this branch, or what would you change?" Revise until approved. **(WAIT)**

### 3. Suggest a branch name
One short, lowercase, dash-separated name starting with the program, e.g. `o9030-touchoff-loop-alarm`, `o9030-metric-window`. Check it's free: `git branch -a --list "*<name>*"`. Ask the user to approve or rename. **(WAIT)**

### 4. Create the branch from main
Check `git status` and `git branch --show-current`. Not on main, or main may be behind GitHub: suggest `/macro-sync` first. **(WAIT)** Uncommitted changes: stop and point to `/macro-sync`.
```
git switch main
git switch -c <branch-name>
```

### 5. Save the description
Create `notes/<branch-name>.md`:
```
# <branch-name>
Macro: <O> (<folder>)
Created: <today>
Status: Branch created, not planned yet

## Why this branch exists
**Issue:** ...
**When:** ...
**Want instead:** ...
**Why:** ...
```
Say where it is, and that the plan, the test results and the save note build on it. Don't commit it.

### 6. Done
"You're on branch `<branch-name>`. Main stays the proven macro until you decide to merge. Next is planning the change (`/macro-plan`)." Stop.
