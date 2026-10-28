# TEST VERSION: continuous worker admission recovery

Independent repair candidate after d30b72e5. Use a fixed commit URL. Publication does not deploy or start a task; stable main is not updated.

Build identity: 1e3c4bfd37490e75698507bb6f3e7a9e8a3b0c47000a75a74104bad0f6c877c3. Offline validation: 539 checks, including 12 admission failure/concurrency cases and 13,704 historical frames / 402 restores. Real TV application and long-running recovery remain to be verified.

## Repair

Same-run continuous worker admissions use cron-aligned slots with fresh one-shot generations. Interrupted claims cannot permanently occupy all later slots. Every admission write checks its deadline, clock and parent HEAD. Same-slot contenders still use the existing splitter. Old doors are never reopened. The runtime records skipped admission slots and bounds generation cleanup to 64 per batch.

Closed nonterminal batches that do not hand off within the expected period and health allowance report handoff_stalled instead of indefinite normal waiting. This is queryable health, not push notification or external polling.

## Unchanged behavior

Target policies, independent productive-download eligibility, polling rates, thresholds, natural startup and own-action protection, rolling budgets, supplemental allowances, action records and unknown-action fault locks are unchanged. No target names, installed bindings or credentials are included. Existing consumption and action clocks must be preserved on upgrade.

## Qualification limits

Slot recovery applies only to same-run continuous runtime admissions. First initialization, finite tasks and control transactions retain the existing admission behavior. Write checks are not storage compare-and-swap; concurrency depends on the documented coherent atomic individual reads/writes and actual runtime scheduling. Offline interleaving tests do not prove all cross-JSC suspension behavior. The original interruption trigger remains unknown.

## Upgrade boundaries

Use a new fixed installation after the old task is independently confirmed closed and terminal. Preserve the stable budget scope, base limit, consumption, grants and action clocks. Snapshots and quota formats remain compatible; original released bundles are immutable. Accept source staging, TV declarations, resource readiness, task admission, autonomous runtime, actual interruption and playback benefit as separate evidence.

One worker still reads existing connection byte counters once per cycle. There is no separate speed-test script or test-file traffic. No proxy/route changes, engine restart or blanket connection kill is part of this release. This eligibility correction may allow ordinary slow connections that the old defect skipped; the original action interval and quota still limit retries. CPU, power and causal throughput benefits require real-device evidence.
