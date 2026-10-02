# TEST VERSION: adaptive-wait-5hz-test-v2

Experimental adaptive sampling and automatic Surge build compatibility build. Published separately for testing; **not deployed and not accepted on a TV**.

The stable `main` branch remains at [62537e48](https://github.com/louisliu615/surge-tv-observer/commit/62537e48c6f4b04c9f13bd221160bb765210fa53). This test is isolated on `codex/adaptive-wait-5hz-test-v2`. Use an immutable commit URL when selecting a script version; publication does not change an installed configuration or running task.

## Scope

Only the `continuous-v1` runtime adopts adaptive sampling:

| Observed state | Nominal polling rate |
| --- | --- |
| Active download, startup, own-action recovery, uncertain measurement | 10 Hz |
| One unchanged target with reliable WAIT, strictly zero byte growth, all relevant guards cleared, then one additional stable second | 5 Hz |
| No target | 1 Hz, unchanged |

Any observed byte growth, identity/count change or uncertainty restores fast polling. WAIT is a traffic classification, not a measurement of player buffer occupancy. Sampling requests remain serial; actual rates depend on response time and scheduling.

Coarse-sampling resume evidence preserves the existing four-second natural startup protection conservatively. Identity changes cannot reuse another connection's first-seen time. Recovery evidence survives handoff and uncertain reads. The existing five-second protection after an own action, speed threshold, rescue rules and rolling budget semantics are unchanged. Finite tasks, `long-v1` and the default standalone Pipeline retain their previous behavior.

## Validation and limits

- 429 local checks passed, including 22 targeted adaptive-sampling checks, 9 build-transition/migration checks and 4 maintenance-tool checks and the compiled service entry point.
- Independent Astra review identified two startup-boundary defects; both were fixed and regression tested.
- Replay covered 13,704 original frames in three traces, at four sampling phases each. No effective startup deadline advanced; four reviewable nighttime events still matched.
- Request count fell about 21.35–21.66% in the daytime intermittent-download trace and 2.62–2.68% in the nighttime trace. This is not a CPU, energy or playback-benefit measurement.
- TV scheduling, viewing behavior and resource cost of this test build remain unverified. Deployment delivery and initial script-download issues are outside this change.

This is an action-capable bundle, subject to the existing task, binding and budget controls. Publishing it alone neither enables actions nor changes a device. No private configuration, binding, device identity, target address or credential is included in these three release files.

## Automatic Surge build upgrades

The configured build remains an immutable minimum baseline. New service workers and store-only control helpers accept numeric builds at or above that baseline while retaining tvOS, device-model, target, binding and declaration checks. No configuration rewrite or new task is needed for a routine forward build update after this version is installed and running.

The continuous worker records up to eight recent build transitions and a cumulative transition count. A changed build rebuilds the measurement baseline while retaining quota, grants and the last own-action timestamp. It refuses rollback below the last observed build. Unknown actions and fault locks remain protected. Invalid traffic API responses still stop actions through existing validation and bounded read retries; accepting a build number is not a promise to support arbitrary future API changes.

Upgrading an already interrupted legacy exact-build installation requires a one-time, separately checked metadata migration and a new task under the same budget scope. That migration is a local maintenance tool, not an automatic action of this public script. It preserves historical evidence and consumption; publication does not run it.

## Build identity

- Code ID: `e764cc94d23bd5febb9abdb2c6bb45de0789dc12a78370535cefd3e11f814d7e`
- Script SHA-256: `3e13c7a6afebddac6609c67f08a55d973843ad6f758f5fadf62cc1c0387eb3df`
- Script size: 152,136 bytes
- `SHA256SUMS` covers this README and `vidhub-autonomous.js`.
