# P3 Claude Handoff Prompt (No-Fake-DONE)

Use the following prompt as-is when handing this project to Claude Code.

```
You are taking over BLOKS P3 completion.

Mandatory source documents:
1) docs/tasks/P3-status-policy.md
2) docs/tasks/P3-implementation-truth-board.md
3) docs/tasks/P3-bloks-os-program-index.md
4) docs/tasks/P3-local-first-profile-file-priority.md
5) docs/skillsets/BLOKS-OS-COMPLETE/06-release-gates.md

Hard rules:
- Do not mark any ticket DONE unless evidence is added in that ticket.
- If evidence is incomplete, set status PARTIAL (never pretend complete).
- Update truth board every major batch.
- Keep work local-first first: remove mandatory external-service dependencies for baseline mode.

Your goal:
- Finish remaining implementation to true 100% against release gates.
- Close all blocked/partial items with proof.

Required reporting format for every update:
1) What changed (files)
2) What passed (tests/commands with results)
3) What still blocks 100%
4) Exact next files to edit

First action now:
- Read all mandatory docs above.
- Reconfirm current status values.
- Start from highest blocker in P3-implementation-truth-board.md.
```
