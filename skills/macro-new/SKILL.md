---
name: macro-new
description: Sets up a FANUC control macro (an O-number program like O9030) in a post repo so the macro editing skills can work on it. Copies the program byte for byte as Rev A, writes its revisions log with a Macro facts block, starts its test cases (checked with the simulator), draws its flow chart and publishes it as an artifact, and points the repo's CLAUDE.md at it, pausing for an OK at every step.
---

# Macro New: Set Up a Macro for Editing

## Context (always applies)
- Run this in the post repo for the machine the macro runs on (e.g. `C:\Repos\Doosan-Mill-Post-Processor`). Its `CLAUDE.md` has a **Post facts** block. If not, stop and ask which repo. **(WAIT)**
- The user is a machinist, not a programmer. Plain shop terms, go slow.
- At every **(WAIT)**, stop and wait for the user's answer.
- **Never commit, push, or merge without the user's explicit OK.**
- **The simulator:** `node "$HOME/.claude/skills/macro-test/macro-sim.js"` (quote every path).

## Steps

### 1. Get the program
Ask for the program file as it runs on the control today (a file path, or pasted text). **(WAIT)** Read it all. Say what it does, line by line in shop terms, and list anything that looks risky, as notes only (no changes). Find what calls it: search the post for `P<number>` / `G65` and show that line.

### 2. Make a branch
`git status` must be clean and on an up-to-date main (else point to `/macro-sync`-style cleanup first). Suggest `<o-number>-setup` (e.g. `o9857-setup`). **(WAIT)** `git switch -c <name>`.

### 3. Save Rev A exactly as it is
- Folder: `OTHER RELEVANT ASSETS TO POST PROCESSORS/<O number> <SHORT NAME> MACRO/` (capitals, like `O9030 TOOL LENGTH MACRO`). Ask the user to OK the name. **(WAIT)**
- Program file: named just the O number, **no extension** (this repo ignores `*.nc`). Copy it byte for byte (`cp`, then `cmp` to prove it's identical). Check git will track it: `git check-ignore -v` must print nothing.
- Run `--check` on it and read out the result. Failures here are notes for a later rev, not something to fix now.

### 4. Revisions log with Macro facts
Write `<O number> REVISIONS.md`: a one-paragraph description, the calling line from the post, a table of its G65 arguments (letter, macro variable, where the value comes from, what it's used for), then:
```
## Macro facts
The macro editing skills (`/new-macro-edit` and its steps) read this block. Keep it current.
- Program: O<n>
- Program file: O<n>
- Name: <name>
- Machine / control: <from Post facts>
- Called by: <post file>, <when>: `<G65 line>`
- Rev line: `(REV x YYYY-MM-DD)` on the line right under the `O<n>(...)` line
- Current rev: A
- Test cases: O<n> TEST CASES.md
- Flow chart: O<n> FLOW CHART.html
- Flow chart artifact: <filled in at step 6>
- Calls on the machine: <M-code / G65 calls it makes, or none>
- Machine prove-out: Rev A is what runs on the machine today

## Revisions

### Rev A — <date>
The program exactly as it runs on the machine today, copied byte for byte from <source>. No changes.
```
Rev A has no rev line inside the program (so it stays byte for byte). The first edit adds one, as its own rev.

### 5. Test cases
Write `<O number> TEST CASES.md` in the same format as `O9030 TEST CASES.md` in the Doosan repo: a short header, a `Touch-off code:` line if the macro triggers a touch-off (or leave it out), how a case is written, then `## Cases` with one case per path through the macro (every alarm, every jump, the normal return, and any known problem, recorded as it behaves today). Use real-looking numbers. Run them:
```
node "$HOME/.claude/skills/macro-test/macro-sim.js" "<folder>/<program>" "<folder>/<test cases>"
```
All must pass, and every case's result must match your line-by-line reading in step 1. If the simulator stops with `SIM ERROR` because the macro uses something it wasn't built for, say so plainly: that part is proven at the machine only, unless the simulator is extended (on its own branch in `C:\Repos\MACRO-EDITING-SKILL`). Show the user the results. **(WAIT)**

### 6. Flow chart
Load the `artifact-design` skill (or run the Artifact tool's quickstart) and the brand skill if one applies (MTS: `mts-brand`). Draw `<O number> FLOW CHART.html` like `O9030 FLOW CHART.html`: a top-to-bottom chart of the macro's real paths (start = the G65 line, boxes for steps, diamonds for IFs, alarm boxes, loops back as dashed lines, end = M99), then cards for a worked example, the arguments, and "watch for" items, with the rev in the header line and footer. Publish it as a private artifact and put its link in Macro facts. Show the user. **(WAIT)**

### 7. Point CLAUDE.md at it
Add (or extend) a section in the repo's `CLAUDE.md` listing the macro folder and its files, and the rule: every new rev updates the program's rev line, the revisions log, the test cases and the flow chart in one commit, through `/new-macro-edit`. Show the diff. **(WAIT)**

### 8. Save it
Ask once: save Rev A (program, revisions log, test cases, flow chart, CLAUDE.md) in one commit with a note like `O<n> <name>: Rev A as it runs on the machine today`, put it into main, send to GitHub, delete the branch? **(WAIT)** On yes, do it the same way as `macro-finish` steps 3–4 (no republish needed; the chart was just published).
