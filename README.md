# TEST VERSION: adaptive-wait-4hz-dispatch-fix

This is an independent test release. The stable `main` branch remains at `62537e48c6f4b04c9f13bd221160bb765210fa53`. The prior test `22074736` remains immutable. Publication does not deploy a configuration or start a task. Use the full fixed commit URL.

Build identity: `910a0ca5b273d16d9377b7b25eedb7fd031bbc205149d37b8536139971926de1`. Offline verification: 467 checks passed, including real fault-state replay, 200-slot migration, clock advancement within synchronous callbacks, unknown-result guards, bounded storage, and 13,704 historical frames. TV deployment and this version's runtime behavior are not yet verified.

## Changes

- A durable action reservation can make its measurement stale. The worker now takes at most one fresh read and revalidates the same eligible connection before dispatch. The 250 ms freshness rule is unchanged. If no longer eligible, it records a proven non-dispatch cancellation and continues observing. Failed/unknown persistence, lost ownership, interrupted pending actions and unknown action replies still stop safely.
- Reserved attempts remain charged even when a known non-dispatch is cancelled. Actual invocations have separate sequential records. The most recent 16 cancellations are retained; no refunds, task resets or implicit unlocks.
- Removed duplicate serialization of the fully expanded action history from the persistence path. `maxRootBytes` explicitly measures the stored root at a preceding checkpoint; historical `maxSavedBytes` is not a heap or database measurement.
- Strict, stable WAIT uses 250 ms (4 Hz), compared with the prior test's 200 ms (5 Hz). Download, startup, uncertainty, post-action recovery and final validation remain fast (100 ms). No target remains 1000 ms. WAIT is a counter-derived traffic state, not proof of a full player buffer.
- Added bounded sampling evidence: target presence by cadence totals, 288 five-minute bins and 32 growth-resumption excerpts. Existing checkpoint timing and local-only storage are retained. No external telemetry, extra scheduler or always-on computer collector.
- Continuous installations may explicitly select `baseLimit: 100` or `baseLimit: 200`. The default stays 100. A closed-service upgrade preserves the budget scope, all unexpired consumption, lifetime sequence, grants and last action time; only the limit rises. Slots release individually after 24 hours, not at midnight. Raising quota never unlocks an unknown action or overrides protection.

## Unchanged limits

The low-rate threshold, natural startup protection, fixed post-action protection, ordinary near-zero protection and bounded own-successor rescue policy are unchanged. Single-worker, two-minute cron lifecycle and forward Surge-build handling are retained. Invalid/changed APIs still block actions. Finite profiles retain their existing per-task caps.

The root remains bounded to 512 KiB. Action excerpts use immutable pages, keeping at most 100 recent action records; old evidence is reclaimed. This is not full continuous raw capture. Increasing rolling quota does not increase the action-page retention limit.

## Upgrade and evidence boundaries

Fixed-version deployments must be checked in layers: source staging, TV declaration, resource readiness, actual autonomous execution and measured action behavior. Existing fault locks require a separately reviewed, exact-state maintenance step where the old code proves non-dispatch; this public worker is not a general unlock tool. No private helper or fault snapshot is included here.

Historical replay cannot establish future performance or causality. Poll-count savings are not CPU, power, memory or viewing-quality savings. More quota provides capacity, not a guarantee that repeated reconnects improve a slow source or route.

This bundle contains no private endpoint, device binding, credentials, video addresses or configuration. It has no remote control endpoint or external log upload. Runtime parameters and task authorization are supplied separately through the existing local Surge service.
