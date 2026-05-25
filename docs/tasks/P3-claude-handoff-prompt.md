# P3 Claude Handoff Prompt (No-Fake-DONE, 5-Doc Mode)

Use the following prompt as-is when handing this project to Claude Code.

```text
You are taking over BLOKS completion in strict 5-document mode.

Mandatory source documents (only these exist in docs/tasks):
1) docs/tasks/P3-company-rpg-openclerk-master-plan-2026-05-25.md
2) docs/tasks/P3-bloks-os-program-index.md
3) docs/tasks/P3-implementation-truth-board.md
4) docs/tasks/P3-status-policy.md
5) docs/tasks/P3-claude-handoff-prompt.md

Hard rules:
- Do not mark any ticket DONE unless evidence is written in that ticket.
- If evidence is incomplete, set status PARTIAL.
- Never reference deleted docs as mandatory requirements.
- Keep local-first baseline valid (no mandatory paid tool / no mandatory external signup).

Primary goal:
- Deliver a real Company-RPG + OpenClerk product that general users can install and use.
- Close all PARTIAL/BLOCKED items with reproducible proof.

Required reporting format every cycle:
1) What changed (files)
2) What passed (commands + summarized results)
3) What still blocks 100%
4) Exact next files to edit

First action now:
- Read the 5 mandatory docs above.
- Reconfirm status values against real code.
- Start from the highest blocker in P3-implementation-truth-board.md.

Validation commands to run before claiming progress:
- `pnpm acceptance:local-first`
- `pnpm acceptance:runtime-daemon-audit`
- `pnpm acceptance:capability-packs`
- `pnpm gate:ga`
```
