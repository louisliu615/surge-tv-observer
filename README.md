# TEST VERSION: configurable isolated targets with bounded host globs

Independent test release, superseding the undeployed exact-host candidate 0f52dc34505244cf57fb0913c607ec4038f5a3b4. Stable main remains 62537e48c6f4b04c9f13bd221160bb765210fa53. Publication does not deploy a configuration or start a task. Select this version by its full fixed commit URL.

Build identity: ae56628510906021886abe3c583a61941eb197453c072594f1c3ad138c866886. Offline verification: 503 checks, 13,704 historical frames with exact default-policy parity, compiled entry-point simulations, and native profile syntax checks passed. Real TV deployment and effects of this release are not yet verified.

## Changes

- One configured worker and one active-connection API read per polling cycle. Each actual matched endpoint has its own detector, speed threshold, startup/wait state, revalidation and successor evidence. Speeds and recovery lineage are never merged across endpoints.
- Optional service.targets contains up to four non-overlapping id/host-or-hostPattern/port/slowBps rules. A bounded glob permits one star inside the first DNS label, with a literal prefix and fixed domain suffix; it cannot span dots. Runtime policies remain exact per actual host:port, with at most four retained instances. Only absent instances other than the most recent action target can be retired; cumulative traffic remains recorded. The first rule preserves the original installation host on port 443. Tasks cannot override targets. Without targets, the old single-target path remains available.
- The shared rolling allowance, unknown-action fault lock and global minimum five-second action spacing remain. Adding targets never refills allowance or doubles it. Natural four-second startup, fixed five-second own-action protection and ordinary near-zero waiting protection remain.
- Polling adopts the fastest requirement among endpoints: 100 ms for download/recovery/uncertainty, 250 ms only for strict stable waits, 1000 ms when all targets are absent. Two active endpoints share one approximately 10 Hz loop, rather than independent loops. A newly monitored endpoint can increase time spent in fast polling.
- Explicit scopes replace build-time source-string substitutions. Public JavaScript contains no installed target names, device names or credentials. Each action records targetId; excerpts stay scoped to their target. Aggregate bytes and selected-target rates are labeled separately.
- Snapshots persist all target policies and the last action state. Closed-installation upgrades preserve the budget scope, existing consumption and action clocks. Threshold changes rebuild measurement evidence. Removing the most recently acted-on endpoint currently requires explicit protection-state migration and is refused automatically.

## Offline load evidence

Synthetic counter streams and virtual clocks, with an in-memory store, were used for comparison. In a 24-hour intermittent-download model, single and dual targets each made 362,881 connection reads and 6,482 root writes. Maximum stored root sizes were 121,943 and 139,625 bytes respectively, below the unchanged 524,288-byte bound. A separate two-target one-hour action model exercised the 200-slot allowance and retained at most 100 recent actions.

Host Node.js timing and storage API payload sizes are not Apple TV JavaScriptCore CPU, JS heap, physical disk I/O, energy or playback measurements. There is no test-file download for speed measurement. A public Apple playback manifest provides evidence for several VOD pathway hostnames. Live content needs and causal benefit from retrying still require separate evidence. This release changes host matching, without adding a segmented-playback interruption policy.

## Upgrade boundaries

Use a new fixed installation only after the previous task is confirmed terminal. Preserve its budgetScope and existing baseLimit, consumption and last action time. Existing frozen control bundles remain usable for their own deployments. Never replace an immutable released bundle with a candidate.

Accept installation declarations, resource readiness, task admission, autonomous runtime, actual action effects and playback benefit as separate evidence. No route/proxy change, engine restart or blanket connection kill is part of this release.
