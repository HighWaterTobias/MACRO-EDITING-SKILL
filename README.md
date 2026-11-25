# Macro Editing Skill

Claude Code skills that walk through editing a FANUC control macro (an O-number program like `O9030`, the tool
length check the Doosan post calls with `G65 P9030` after every tool change) one step at a time, written for a
machinist, not a programmer. They work the same way as the post editing skills (`HighWaterTobias/POST-EDITING-SKILL`,
local copy `C:\Repos\POST-EDITING-SKILL`), but they're kept in their own repo so each can be changed on its own.

## Where macros live
A macro lives in the post repo for the machine it runs on, under
`OTHER RELEVANT ASSETS TO POST PROCESSORS/<O number> <NAME> MACRO/`:

```
O9030                    the program, always the current rev (no extension: post repos ignore *.nc)
O9030 REVISIONS.md       rev log + Macro facts block (the skills read it)
O9030 TEST CASES.md      saved situations for the simulator, one per path through the macro
O9030 FLOW CHART.html    flow chart of the logic, also published as a Claude artifact
```

The skills find a macro by its **Macro facts** block (program number, program file, rev line, current rev, test
cases, flow chart and its artifact link, what calls it, machine prove-out status). A post repo can hold several
macros, so each one keeps its own Macro facts next to its program, instead of in the repo's `CLAUDE.md`.

Every rev changes all four files together in one commit, so each rev in git history has its matching log, test
cases and chart.

| Macro (in which post repo) | What it does |
|---|---|
| `O9030 TOOL LENGTH MACRO` (`Doosan-Mill-Post-Processor`) | Touches off a new tool (offset 99), then alarms if the H offset is more than .060" off the Fusion tool length |

## The skills

| Skill | What it does |
|---|---|
| `/new-macro-edit` | Runs all 7 steps below in order, pausing between each. |
| `/macro-sync` | Step 1: deal with unsaved changes, pull the latest `main`, show the macro's current rev. |
| `/macro-branch` | Step 2: describe the issue and why, then make a branch (reason saved to `notes/<branch>.md`). |
| `/macro-plan` | Step 3: plan the change (no editing): machine behavior before/after, numbered changes, new and changed test cases, and the rev (rev line, log, flow chart) as the last change. |
| `/macro-change` | Step 4: make the edits one at a time, add the test cases, do the rev, run the macro check, open a VS Code compare. |
| `/macro-test` | Step 5: desk check. Runs this edit's test cases on the proven and edited macro with the simulator, marks every difference EXPECTED or SURPRISE, fix loop on surprises. |
| `/macro-recheck` | Step 6: runs every saved test case. Only the cases the plan listed may act differently. |
| `/macro-finish` | Step 7: one question, one yes saves it, puts it in main, sends it to GitHub, deletes the branch, republishes the flow chart link. Then the load-and-prove-out list for the control. |
| `/macro-new` | Sets up a macro for editing: Rev A byte for byte, revisions log with Macro facts, test cases, flow chart, CLAUDE.md pointer. |

## The macro simulator (`skills/macro-test/macro-sim.js`)
Steps through a macro on the PC the way the control would, for each saved test case (tool in spindle, offsets,
the `G65` arguments, what the touch-off writes), and reports what it does: blocks it sends, `M99`, an alarm, or an
endless loop. It knows the macro features O9030 uses (variables, math, `IF`/`GOTO`, `#3000` alarms, `M99`, block
delete) and stops with `SIM ERROR` on anything else instead of guessing. Comparisons where two numbers are equal to
6 decimals are flagged as close calls. It checks logic only. Machine setup (which variable is the tool in the
spindle, the offset table, what the touch-off does) is proven at the control after every rev.

```
node macro-sim.js --check <macro>                                   typo check: %, O number, comments, brackets, GOTOs, M99, rev line
node macro-sim.js <macro> <test cases.md> [--case TC3] [--trace]    run test cases
node macro-sim.js <macro> <test cases.md> --before <older macro>    old vs new, SAME / CHANGED per case
```
It runs on Node, which is already on this computer. If the machine ever disagrees with the simulator, the machine
wins: fix the simulator here on its own branch and add that machine result as a test case.

## Folders in this repo
- `skills/`: the skills themselves. Edit them here. `skills/macro-test/` also holds `macro-sim.js`, so it installs
  with the skill.
- `install.ps1`: copies the skills into your personal Claude folder.

## Install or update
After changing any skill in this repo, run this from the repo folder:

```
powershell -ExecutionPolicy Bypass -File install.ps1
```

That copies everything in `skills/` to `%USERPROFILE%\.claude\skills`, replacing the old copies of these skills
only (the post editing skills are left alone). Start a new Claude session afterward. If you delete or rename a skill
here, also delete its old folder from `%USERPROFILE%\.claude\skills`.
