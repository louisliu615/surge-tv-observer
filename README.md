# Finite TV reconnect trial service

This build enables bounded connection-control capability for explicitly submitted
`execute` tasks. Publication alone does not deploy a configuration, schedule a
trial, or terminate any connection. A fresh private service installation is idle
until a separately authorized task is received.

## Execution and limits

Two configured JSC entries run every two minutes. The worker owns sampling,
decisions, fresh revalidation, single-connection termination and local records.
The peer only participates in a separate storage probe. A one-shot computer
helper transfers parameters and reads status/results; it has no traffic API or
sampling loop. It does not drive the TV worker.

Each execute task has a unique ID, a bounded first-start window, a finite target
wait, at most fifteen minutes from productive traffic, and an explicit cumulative
allowance of 1 to 30 attempts. The first and last minute (or longer, if specified)
are observation only. An absolute deadline also bounds waiting plus runtime.
Normal two-minute handoffs retain state and consumed allowances. Quota exhaustion
leaves observation running until the finite task ends. Idle or finished tasks
cannot restart themselves or replenish their allowance.

The existing decision rules remain unchanged: a 2,000,000 B/s threshold,
four-second natural download-startup protection, and fixed five-second protection
from our own disconnect dispatch. Zero/near-zero traffic is not terminated.
Actions require a unique, recently productive, eligible main connection and fresh
identity/rate evidence. Target and device constraints are supplied privately at
installation and cannot be overridden by a task. The service action endpoint
accepts only one numeric connection ID.

## Stop, failure and evidence

A stop flag is monotonic and is checked before action dispatch. Stop receipt and
verified worker closure are separate states. An unknown termination reply,
incomplete ownership state or inconsistent storage blocks automatic retries.
The computer control tool treats an empty or uncorrelated response as unknown;
it does not infer that a write succeeded or never happened.

Records distinguish low-speed candidates, blocked decisions, reserved attempts,
API invocations/replies, old-connection disappearance and successor growth.
Bounded pre/post samples remain in the local TV store. An API reply is not proof
of faster playback. Cross-session coordination assumes atomic, coherent individual
store reads and writes; a finite passing probe does not establish that assumption
for all possible executions. Long-term retention, CPU and power costs remain
unmeasured. This is a finite acceptance build, not an unattended permanent service.

## Distribution and validation

This release updates exactly `vidhub-autonomous.js`, `README.md`, and `SHA256SUMS`.
Other existing distribution files and earlier immutable commits remain available.
No private configuration, device binding, target domain, credentials, sample trace
or local source manifest is a publication input. No external telemetry destination
is included. Deploy using an immutable commit URL and a new installation identity;
first verify the previous task is closed. Deployment does not authorize a trial.

The local checks cover the actual compiled entry, bounded actions, cumulative
quotas across eight sessions, observation bookends, cancellation, lost replies,
store-only helpers, and unchanged historical decision output. Simulated calls do
not establish real TV termination behavior, benefit, or power consumption. The
`actionsQualified` field is a build capability gate, not a claim of those results.
