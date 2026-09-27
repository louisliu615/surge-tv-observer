# Configured autonomous TV candidate

Publication does not deploy or enable these scripts. The
compiled candidate has `actionsQualified: false`: active and diagnostic modes
cannot be enabled by changing its arguments. It supports finite configured
observation and an isolated store qualification probe.

The public distribution allowlist is exactly:

- `vidhub-autonomous.js`
- `vidhub-ownership-probe.js`
- `README.md`
- `SHA256SUMS`

The generated configuration templates, device binding, local results and source
manifest are not publication inputs. These scripts contain no target domain,
device binding, credentials or external report destination. They keep diagnostic
records in the local Surge store. Bindings must be supplied privately.

## Runtime

The worker is launched by a named configured cron, every two minutes, using JSC
with a 120-second timeout. It ends before the next cron boundary and passes its
saved state to the next worker. The finite acceptance limit is 15 minutes after
productive target traffic begins; waiting for that traffic is limited to two
minutes and the binding imposes an absolute expiry. This is not unlimited
background operation.

The worker samples every 100 ms while target connections exist and every second
when none exist. It retains the existing decision pipeline, including the
2,000,000 B/s threshold, four-second natural startup protection and five-second
post-action protection. A handoff preserves these deadlines and cumulative
budgets. An observation gap invalidates rate evidence without resetting action
protection. The Mac does not drive the loop or renew a health token.

Read, stop and observation-only controls are separate named generic scripts.
Their actual invocation and result-export path still require TV qualification.
A stop flag does not change the VPN or its configuration. After finite acceptance,
remove the cron declarations with the prepared closing configuration to avoid
expired empty wakeups. Disabling a declaration alone does not terminate an
already running session.

## Ownership and action release gate

Each worker generation uses a one-shot read/write splitter. It does not reuse or
reopen a lease. At most one participant can win **if individual store reads and
writes are atomic and coherent and session identifiers are distinct**. The Surge
store documentation does not promise these cross-session properties. Therefore
the public active release gate stays closed.

`vidhub-ownership-probe.js` runs twelve pairs of short configured sessions. It
uses separate diagnostic keys, performs no traffic reads, and has no disconnect
API. Exported histories can reveal inconsistencies, missing sessions or duplicate
winners. A passing finite probe does not prove all possible storage executions
and does not unlock actions automatically.

An unclosed worker, unknown action outcome, storage failure or inconsistent state
prevents automatic takeover/retry. This favors stopping over duplicate actions;
crash recovery is an explicit remaining operational task.

## Records and limits

Records distinguish candidates, blocked candidates, reserved attempts, replies,
old-connection disappearance and successor growth. Each action keeps bounded
before/after samples; receipt of an API reply is not treated as proof of effect.
State is capped at 512 KiB per generation and sixteen generations per finite run.
Old generations are retained for inspection, so repeated runs need a separate
reviewed cleanup procedure before long-term use. CPU and power costs are unmeasured.

## Local validation and deployment boundary

The repository's offline verifier is `python3 tv-autonomous/verify.py`. It covers
the configured entry, simulated concurrency, cross-session protection, bounded
actions, failures, history replay and configuration generation. Simulated calls
are not TV disconnections. A local native profile syntax check is not deployment
or script download verification.

The disabled templates intentionally have commented declarations and an
unpublished-commit placeholder. A future enabled configuration requires a fixed
published commit, fresh private device binding, unique run IDs, explicit finite
times and deployment approval. Store probe and worker windows must be sequential:
do not run the two-session probe alongside the worker.

References: [Surge scripting](https://manual.nssurge.com/scripting/overview.html),
[persistent store API](https://manual.nssurge.com/scripting/api.html),
[cron](https://manual.nssurge.com/scripting/cron.html),
[read/write splitter, Figure 2](https://www.cs.unc.edu/~anderson/papers/dc01.pdf).

## Previous finite observer

The existing `vidhub-observer.readonly.js` is retained unchanged. Its previous documentation follows.

# Finite read-only trial with bounded candidate evidence

Publishing does not deploy or enable this trial. Internal GET /v1/requests/active only; no connection
control, external requests, notifications or telemetry. Detector, adapter, runner
and binding guard remain byte-identical to the tested scheduler version.

At most ten batches / five minutes, fixed nominal 100 ms sampling, 300 ms finish
reserve before each 30-second cron boundary. Real scheduling can still leave gaps.
Existing rate thresholds and reliability guards are unchanged.

Adds private, local evidence around candidate observations: up to 3 seconds before
and 2 seconds after, at most 64 samples per event, 12 events, and 32 KiB of persisted
evidence. Each sample contains relative midpoint, read duration, filtered numeric
connection IDs / cumulative byte counters, and detector decision fields. No URLs,
device names, credentials or complete HTTP responses are copied into the evidence.
The whole trial state is capped at 64 KiB. Old contexts are evicted as whole events
when necessary; counts, gaps and incomplete windows remain explicit. Raw counters
and timing must be treated as private diagnostic data and never published.

Evidence uses memory during a batch and the existing two state writes per batch;
there is no new per-sample storage write or per-sample log. Five-minute CPU, memory
and power effects of this addition have NOT been measured on a real device.
State schema is version 2; use a fresh trial binding after explicit publication and
deployment approval. Expiry stops sampling but does not remove the cron declaration.
Disable the observer and verify readback after the finite trial.
