# TEST VERSION: configurable isolated target policies

Independent test release, based on a46ef9156f5164b67ec00917e2d9be4b70b2f626. Stable main remains 62537e48c6f4b04c9f13bd221160bb765210fa53. Publication does not deploy a configuration or start a task. Select this version by its full fixed commit URL.

Build identity: 09f12ff12f32166f2112372d740fb9a541b91cdac6fe39cbb616f034f32bdf5e. Offline verification: 488 checks, 13,704 historical frames with exact default-policy parity, compiled entry-point simulations, and native profile syntax checks passed. Real TV deployment and effects of this release are not yet verified.

## Changes

- One configured worker and one active-connection API read per polling cycle. Each installed exact endpoint has its own detector, speed threshold, startup/wait state, revalidation and successor evidence. Speeds and recovery lineage are never merged across endpoints.
- Optional service.targets contains up to four unique id/host/port/slowBps rules. The first rule preserves the original installation host on port 443. Tasks cannot override targets. Without targets, the old single-target path remains available.
- The shared rolling allowance, unknown-action fault lock and global minimum five-second action spacing remain. Adding targets never refills allowance or doubles it. Natural four-second startup, fixed five-second own-action protection and ordinary near-zero waiting protection remain.
- Polling adopts the fastest requirement among endpoints: 100 ms for download/recovery/uncertainty, 250 ms only for strict stable waits, 1000 ms when all targets are absent. Two active endpoints share one approximately 10 Hz loop, rather than independent loops. A newly monitored endpoint can increase time spent in fast polling.
- Explicit scopes replace build-time source-string substitutions. Public JavaScript contains no installed target names, device names or credentials. Each action records targetId; excerpts stay scoped to their target. Aggregate bytes and selected-target rates are labeled separately.
- Snapshots persist all target policies and the last action state. Closed-installation upgrades preserve the budget scope, existing consumption and action clocks. Threshold changes rebuild measurement evidence. Removing the most recently acted-on endpoint currently requires explicit protection-state migration and is refused automatically.

## Offline load evidence

Synthetic counter streams and virtual clocks, with an in-memory store, were used for comparison. In a 24-hour intermittent-download model, single and dual targets each made 362,881 connection reads and 6,482 root writes. Maximum stored root sizes were 121,943 and 139,247 bytes respectively, below the unchanged 524,288-byte bound. A separate two-target one-hour action model exercised the 200-slot allowance and retained at most 100 recent actions.

Host Node.js timing and storage API payload sizes are not Apple TV JavaScriptCore CPU, JS heap, physical disk I/O, energy or playback measurements. There is no test-file download for speed measurement. The actual content type of any newly configured endpoint and causal benefit from retrying still require live evidence.

## Upgrade boundaries

Use a new fixed installation only after the previous task is confirmed terminal. Preserve its budgetScope and existing baseLimit, consumption and last action time. Existing frozen control bundles remain usable for their own deployments. Never replace an immutable released bundle with a candidate.

Accept installation declarations, resource readiness, task admission, autonomous runtime, actual action effects and playback benefit as separate evidence. No route/proxy change, engine restart or blanket connection kill is part of this release.
