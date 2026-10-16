# TEST VERSION: independent productive-download eligibility

Fixes an existing ordinary slow-download veto when a connection already present before a retry later becomes the main download. Independent test release after 443dcd23accbf00bc8903bbb508c228ea52445be. Stable main remains 62537e48c6f4b04c9f13bd221160bb765210fa53. Use the full fixed commit URL. Publication does not deploy or start a task.

Build identity: 07286577a4f65d04778e634987b14c6f4e27d7bb81ea578fd16019cb13f7cb88. Offline verification: 515 checks, including 12 new regression cases, compiled package tests, native profile syntax, and 13,704 historical frames / 402 snapshot restores with exact old-profile parity. The historical traces lack this concurrent-peer case; the new regression explicitly reproduces the old veto and requires the fixed behavior. TV application and real playback effects of this release remain unverified.

## Fix and preserved protections

Ordinary productive slow downloads qualify using their own fresh evidence, without requiring attribution as a newly created successor of the previous action. Pre-existing same-endpoint peers can become eligible after the original protections expire. Successor attribution remains for outcome evidence; the narrowly bounded stalled-own-successor rescue keeps its existing independent lineage requirements and one-rescue limit. Evidence labels explicitly say replacement.requiredForProductiveDownload=false.

Speed thresholds, real-growth and unique-main requirements, reliable-read limits, natural four-second startup, fixed five-second own-action protection, ordinary WAIT protection, recovery observations, final same-identity/new-growth revalidation, global spacing, rolling quota, charged reservations/cancellations and unknown-action fault locks remain. No quota reset, supplemental allowance, new speed-test downloads, host expansion or Apple segmented-playback policy is introduced.

The same veto is present in verified frozen pre-Apple versions a46ef915 and stable 62537e48, as well as 0c96849a and the earlier read-only f111e3bd. This fixes a pre-existing pipeline defect; it was not introduced by bounded Apple host globs.

## Changes

- One configured worker and one active-connection API read per polling cycle. Each actual matched endpoint has its own detector, speed threshold, startup/wait state, revalidation and successor evidence. Speeds and recovery lineage are never merged across endpoints.
- Optional service.targets contains up to four non-overlapping id/host-or-hostPattern/port/slowBps rules. A bounded glob permits one star inside the first DNS label, with a literal prefix and fixed domain suffix; it cannot span dots. Runtime policies remain exact per actual host:port, with at most four retained instances. Only absent instances other than the most recent action target can be retired; cumulative traffic remains recorded. The first rule preserves the original installation host on port 443. Tasks cannot override targets. Without targets, the old single-target path remains available.
- The shared rolling allowance, unknown-action fault lock and global minimum five-second action spacing remain. Adding targets never refills allowance or doubles it. Natural four-second startup, fixed five-second own-action protection and ordinary near-zero waiting protection remain.
- Polling adopts the fastest requirement among endpoints: 100 ms for download/recovery/uncertainty, 250 ms only for strict stable waits, 1000 ms when all targets are absent. Two active endpoints share one approximately 10 Hz loop, rather than independent loops. A newly monitored endpoint can increase time spent in fast polling.
- Explicit scopes replace build-time source-string substitutions. Public JavaScript contains no installed target names, device names or credentials. Each action records targetId; excerpts stay scoped to their target. Aggregate bytes and selected-target rates are labeled separately.
- Snapshots persist all target policies and the last action state. Closed-installation upgrades preserve the budget scope, existing consumption and action clocks. Threshold changes rebuild measurement evidence. Removing the most recently acted-on endpoint currently requires explicit protection-state migration and is refused automatically.

## Upgrade boundaries

Use a new fixed installation after the old task is independently confirmed closed and terminal. Preserve the stable budget scope, base limit, consumption, grants and action clocks. Snapshots and quota formats remain compatible; original released bundles are immutable. Accept source staging, TV declarations, resource readiness, task admission, autonomous runtime, actual interruption and playback benefit as separate evidence.

One worker still reads existing connection byte counters once per cycle. There is no separate speed-test script or test-file traffic. No proxy/route changes, engine restart or blanket connection kill is part of this release. This eligibility correction may allow ordinary slow connections that the old defect skipped; the original action interval and quota still limit retries. CPU, power and causal throughput benefits require real-device evidence.
