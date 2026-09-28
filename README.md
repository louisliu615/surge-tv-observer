# Finite TV trial service: lifecycle update

Build identity: `a2997f4c253f3b4b37f590cd5f7efb223c35acf7f6e2e23d3ea88bb1297f18e5`.

This release combines decision explanations, a single-worker normal layout,
bounded fault recovery, and separate action evidence storage. Publishing these
files does not change a TV configuration, submit a task, or terminate a connection.
Use an immutable commit URL and a fresh private installation identity; verify the
previous task is closed before upgrading. The service is idle until a separately
authorized finite task is submitted. Target and device constraints remain private
installation parameters and cannot be overridden by a task.

## Execution and unchanged policy

The normal `single-worker-v1` layout uses one configured worker every two minutes
with a 120-second session timeout. The peer belongs to the separate
`diagnostic-pair-v1` maintenance layout, which only accepts bounded storage probes.
The layouts are alternatives with distinct installation identities, not two
services to run together. Legacy bindings without a layout retain their paired
configuration semantics. Removing the peer does not remove ownership protection.

The TV owns connection reads, detection, decisions, fresh revalidation, individual
termination and recording. A computer helper transfers task parameters, reads
status, exports evidence and requests a stop; it does not drive a sampling or
termination loop. Finite tasks continue without the computer remaining online.

Sampling remains approximately 10 Hz with a target present (including waiting)
and 1 Hz without a target. The speed threshold remains 2,000,000 B/s, natural
startup protection four seconds, and protection after our own termination five
seconds from dispatch, including replacement wait. The existing long-v1 limited
stalled-successor rescue and recent-fast-dip rules remain unchanged. API read
failure retries described below do not extend slow-download protection.

Legacy short tasks retain their fifteen-minute limits. Explicit `long-v1` tasks
allow up to 24 hours of wall-clock time from worker admission, with an absolute
expiry. Pauses, video changes, session handoffs and faults do not restart that
clock. Active tasks need an explicit cumulative allowance of 1 to 30 attempts;
the first and last minute or longer are observation only. Exhausting the allowance
leaves observation until expiry. A completed task does not restart automatically.
Read-only tasks cannot terminate connections. `actionsQualified` is a build
capability flag, not permission to start a trial or evidence of playback benefit.

## Health and bounded recovery

Status exposes the last saved successful read, checkpoint and session deadline,
read failures, recovery count and last fault. It distinguishes waiting, retrying
reads, unresponsive/interrupted execution, expired state awaiting closure, and
finished tasks. Values reflect the last persisted checkpoint, not a new traffic
sample performed by the status helper.

A failed connection read receives at most three retries with 1/2/4-second delays.
Late callbacks are discarded and measurement gaps rebuild the speed baseline.
Cumulative attempts, the original action clock and stalled-chain rescue allowance
survive recovery. Exhausted read retries finish the task.

Each worker persists an absolute dispatch deadline. An interrupted worker may be
replaced only after that deadline, using a new one-shot ownership generation and
an unchanged-parent check. A stale heartbeat alone does not clear ownership.
The prior worker must still hold the current generation and be within its own
deadline before dispatch. Late callbacks cannot write the successor generation.
A clean confirmed checkpoint may resume; a reserved action with an unknown reply
closes the task without replaying the action or restoring its allowance. A later
cron can finalize an expired interrupted or yielded task without traffic calls.

Stop flags remain monotonic. Engine identity changes, inconsistent storage,
partially committed ownership claims, or legacy interrupted state without the new
deadline are not blindly repaired. Such conditions stop or block further actions
and require maintenance. Cross-JSC coordination still assumes individually atomic,
coherent store operations; local simulations do not prove this for every TV run.

## Evidence and retention

The TV's local Surge store keeps accounting, pipeline continuation, health,
bounded summaries and action records. Checkpoints are normally saved every thirty
seconds and around actions, handoffs and closure. Action allowance reservation
is saved and read back before dispatch. Recent ordinary samples can be lost on an
abrupt process exit; this does not refund action reservations.

After an action excerpt is complete, it is written once as an immutable page.
The page is written and verified before its reference is committed to the runtime
ledger. Small outcome metrics can still evolve. Status skips these pages while
full export reconstructs the existing action record shape. Status still reads
the task and continuation ledger; it is not claimed to require only a tiny scalar
record. Missing evidence causes an explicit export failure rather than invented
samples. Interrupted page reclamation can be resumed after its summary commit.

Long-v1 keeps bounded five-minute summaries (at most 291), the latest 24 relevant
decision excerpts, all consumed attempts, and bounded pre/post action samples.
Decision explanations distinguish core and executor recovery holds, recent fast
measurements, final eligibility and fresh revalidation. These are not complete
raw 10 Hz traces. Completed action detail is no longer repeatedly rewritten.

Current/previous generation payload retention and the newest four completed
long-run payloads remain bounded; older completed results retain summaries with
`evidenceRetired=true`. Task IDs, stop flags and one-shot safety registers remain,
so total metadata is not constant over indefinite operation. Permanent enablement,
rolling action allowances and multi-month metadata rotation are not part of this
finite-trial release. Export detail before its retention window expires.

No external telemetry destination is included. Counters cannot reveal player
buffer level or demand; a reply, successor growth or later speed increase does
not establish that a termination improved playback.

## Distribution and validation

This update changes exactly `vidhub-autonomous.js`, `README.md` and `SHA256SUMS`.
Other distribution files and previous immutable commits remain available. Private
configuration, device bindings, target domains, credentials, raw traces and local
source manifests are excluded. Configuration cleanup and deployment preparation
remain local tooling operations, not effects of publishing or running this file.

The matching build passed 315 local checks: compiled entry and store-only helpers,
13,704 historical frames, unchanged healthy-path sampling/action timings,
late callbacks, hard-deadline takeover, uncertain actions, expiry, read failures,
engine changes, evidence commits/reclamation and old release compatibility. A
virtual 24-hour run covered 720 sessions and the full 30-attempt allowance.

A synthetic ten-minute 30-action workload reduced storage API write payload bytes
by about 61%; the number of writes increased due to separate immutable pages.
No-action workloads wrote about 1.5%-2.7% more bytes for health fields. These are
application payload measurements, not disk writes, CPU or power measurements.
Actual TV lifecycle, concurrency, longer sessions and power costs still require
hardware acceptance. This release does not claim permanent unattended readiness.
