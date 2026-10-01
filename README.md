# TEST VERSION: adaptive-wait-5hz-test-v1

Experimental adaptive sampling build. Published separately for testing; **not deployed and not accepted on a TV**.

The stable `main` branch remains at [62537e48](https://github.com/louisliu615/surge-tv-observer/commit/62537e48c6f4b04c9f13bd221160bb765210fa53). This test is isolated on `codex/adaptive-wait-5hz-test-v1`. Use an immutable commit URL when selecting a script version; publication does not change an installed configuration or running task.

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

- 410 local checks passed, including 22 targeted adaptive-sampling checks and the compiled service entry point.
- Independent Astra review identified two startup-boundary defects; both were fixed and regression tested.
- Replay covered 13,704 original frames in three traces, at four sampling phases each. No effective startup deadline advanced; four reviewable nighttime events still matched.
- Request count fell about 21.35–21.66% in the daytime intermittent-download trace and 2.62–2.68% in the nighttime trace. This is not a CPU, energy or playback-benefit measurement.
- TV scheduling, viewing behavior and resource cost of this test build remain unverified. Deployment delivery and initial script-download issues are outside this change.

This is an action-capable bundle, subject to the existing task, binding and budget controls. Publishing it alone neither enables actions nor changes a device. No private configuration, binding, device identity, target address or credential is included in these three release files.

## Build identity

- Code ID: `03fe900b48ad3d0d8a61c3432483ce87ef985ed7cc92984dd92a5653d50babf1`
- Script SHA-256: `58e56d3f52a50c84689bcf632c84e71e0e3647449117972d1b369a346f69b8a5`
- Script size: 150,218 bytes
- `SHA256SUMS` covers this README and `vidhub-autonomous.js`.
