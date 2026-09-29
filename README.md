# opencode-serial-subagents

A plugin for **OpenCode v1** that forces subagents to run **serially** instead of in parallel.

## Why this is needed
This is useful when using local models with a small context window or a limited number of inference slots, for example:

```bash
llama-server --parallel 1
```
When multiple subagents run in parallel, they may interleave requests to the same local model. With only one slot or a constrained context, this can cause constant context switching, context eviction, slower responses, and unstable behavior.

```
Legend:
[+] - LOAD   load context into slot
[x] - FREE   unload context from slot
[r] - RECOMP recompute prompt history (wasted work)
██  - active generation
░░  - idle / waiting

══════════════════════════════════════════════════════════════════
 PARALLEL subagents + llama.cpp --parallel 1  (context thrashing)
══════════════════════════════════════════════════════════════════

Time ──────────────────────────────────────────────────────────►

Agent A: [+]███[x]░░░░░░░░░[+][r]███[x]░░░░░░░░░░░░░░░[+][r]███[x]
Agent B: ░░░░░░[+]███[x]░░░░░░░░░░░░[+][r]███[x]░░░░░░░░░░░░░░░░░░
Agent C: ░░░░░░░░░░░░[+]███[x]░░░░░░░░░░░░░░░[+][r]███[x]░░░░░░░░░

══════════════════════════════════════════════════════════════════
 SERIAL execution  (next agent starts after previous finishes)
══════════════════════════════════════════════════════════════════

Time ──────────────────────────────────────────────────────────►

Agent A: [+]██████████████[x]
Agent B: ░░░░░░░░░░░░░░░░░[+]██████████████[x]
Agent C: ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░[+]██████████████[x]
```

### Key differences from the serial/parallel mode:

1. **No `[r]` (RECOMP):** The context is loaded once, used until completion, and then unloaded. We don't waste time and compute resources reprocessing the same prompt history over and over.
2. **Stable KV-cache:** The model's slot is always "hot" (100% utilized by the current task's data).
3. **Performance:** For local models running with `--parallel 1`, a sequential queue is almost always **faster and more efficient** than trying to emulate parallelism through constant context switching. The token generation speed (tokens/sec) remains at its maximum, and prompt evaluation delays are minimized.

## How it works

The plugin intercepts tool execution using the `tool.execute.before` hook. When tool `task` is called, the plugin places the call into a promise queue. The queue is released when OpenCode emits a `session.idle` event.

## Installation
Place `serial-subagents.ts` file in the plugin directory.
- `.opencode/plugins/` - Project-level plugins
- `~/.config/opencode/plugins/` - Global plugins
Files in these directories are automatically loaded at startup.

## Check
Make prompt `Run 3 subagents to quickly count the number of files`. The agent will create 3 subagents, but work on the subsequent ones will not be carried out until the previous one has fully completed the loop.

