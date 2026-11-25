---
name: macro-sync
description: Step 1 of the macro edit workflow. Finds the macro (Macro facts block), checks for unsaved local changes, switches to main, pulls the latest from GitHub, and shows the macro's current rev and the last 3 commits in plain words.
---

# Macro Sync: Get the Latest From GitHub

## Context (always applies)
- **Which macro:** macros live in a post repo under `OTHER RELEVANT ASSETS TO POST PROCESSORS/<macro folder>/`, each with a `<program> REVISIONS.md` holding a **Macro facts** block. Search that folder for `## Macro facts`. One found: use it. Several: ask which. **(WAIT)** None: stop; `/macro-new` sets one up. `<macro file>`, `<folder>`, `<O>` below come from Macro facts. `main` = the proven version.
- The user is a machinist, not a programmer. Plain shop terms, go slow, never do more than this step.
- At every **(WAIT)**, stop and wait for the user's answer.
- **Never commit, push, or merge without the user's explicit OK.**

## Steps

### 1. Check for unsaved changes
Run `git status` and note the current branch.
- **Nothing changed:** say "Your folder is clean, nothing unsaved." and go to step 2.
- **Something changed:** show what changed (`git status`, `git diff --stat`, and the real diff for small changes) and explain each in shop terms (e.g. "you changed the .06 tolerance to .05 in O9030"). Ask which to do: **(WAIT)**
  - **Keep:** leave them. If they'd block switching to main, offer `git stash` (and explain `git stash pop` gets them back).
  - **Commit:** show the commit message and get an OK first. If on `main`, warn that main is the proven version and suggest a branch instead. **(WAIT)**
  - **Throw away:** say plainly it permanently deletes those edits, list the files, and get a clear yes. **(WAIT)** Only then `git restore` those files.

### 2. Switch to main and pull
```
git switch main
git pull origin main
```
"This grabs the newest proven version from GitHub." If the pull fails, stop, show the message, explain it plainly and ask. **(WAIT)** Never force anything.

### 3. Show where the macro stands
- The macro's **Current rev** (from Macro facts) and the rev line in `<macro file>`. If they don't match, say so.
- `git log -3 --format="%h | %ad | %an | %s" --date=short -- "<folder>"`: the last 3 changes to this macro, one plain line each.
- **Machine prove-out** from Macro facts. If the current rev isn't proven at the machine yet, mention it in one line.

### 4. Done
Say: "You're on main and up to date with GitHub. <O> is at Rev <x>." Stop. The branch is the next step (`macro-branch`).
