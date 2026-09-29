# Continuous TV worker: allowance clock ordering fix

Build identity: `da4dcbcd663da1872fbf07c5824a8f1aa0347a73c88061390d06dcfcd6ce25b4`. Local verification: 377 checks passed.

This release adds `continuous-v1` to the existing finite task service. Installing
or publishing it does not submit a task or terminate a connection. Use immutable
commit URLs, verify the previous task has ended, and retain the private budget
scope across upgrades. TV acceptance of these new lifecycle paths is pending.

## Fix in this release

Action admission now reads wall time after refreshing control signals and the
allowance ledger. Previously, normal processing time could make an earlier
measurement timestamp look like a clock rollback and terminally lock a continuous
task. Real backward-clock protection, stale-sample rejection, rolling consumption,
sampling frequency, and all connection decision rules remain unchanged.

Four new regression checks run the compiled bundle with time advancing within
callbacks: the frozen previous release reproduces the defect; the fixed bundle
continues through actions and handoff; genuine rollback still locks; and delayed
reservation persistence still prevents dispatch from stale evidence.

This release does not clear existing fault locks or resume a stopped task.
Recovery requires a separately reviewed maintenance operation preserving prior
consumption and fault evidence. Unknown actions must remain locked. No external
notification destination is added. Hardware acceptance of this fix is pending.

## Running and stopping

One configured worker uses a two-minute cron and a 120-second lifetime with a
300 ms handoff reserve. No peer runs in the normal layout. With no task, the cron
reads control storage and exits without traffic API calls. An active worker reads
at 10 Hz while a matching connection exists and at 1 Hz when none exists. Buffered
waiting with a target retains 10 Hz. Health checkpoints remain every 30 seconds,
plus action and handoff commits. A task is independently stored; changing its
window does not require another deployment or script download.

Continuous tasks may have no expiry, or may use a finite acceptance duration and
cumulative action cap through the same runtime. Stop disables subsequent sampling
and actions without changing the VPN. A new task is an explicit operation, not an
automatic daily restart. Finite deadlines and caps are not extended by a topup.

## Allowances

The continuous base allowance is 100 reserved attempts in a rolling 24-hour
window. Each reservation releases its slot exactly 24 hours later. Stop, engine
restart, a new run ID, and a supported closed-state upgrade retain consumption.
Exhaustion leaves observation active. A separate initialization marker prevents a
missing runtime ledger from silently recreating a full allowance.

An explicitly authorized manual topup has a unique ID, monotonic sequence, count
of 1–100, and expiry within 24 hours. At most eight unexpired grants are retained.
Repeated delivery is idempotent. Base capacity is used first, then the bonus with
the nearest expiry. Expired unused capacity disappears. The worker checks for
committed grant changes about once per second; this is local storage, not a
network request. No always-on computer or Python exporter is needed.

Quota consumption and its action reservation share a durable, read-back-verified
runtime checkpoint before dispatch. Uncertain replies do not refund capacity.
A topup cannot enable a stopped service, change detection thresholds, or unlock
uncertain actions. Separate finite cumulative caps still apply. Backward clock
movement blocks actions; automatic rolling release assumes a correct device wall
clock. Large forward corrections cannot be distinguished reliably from offline time.

## Detection and restart handling

The existing low-speed threshold, download eligibility, four-second natural
startup protection, five-second own-disconnect protection, and bounded near-zero
successor rescue remain unchanged. Only a freshly revalidated exact matching
connection can be terminated. There is no engine restart or VPN-control API here.

When explicitly configured for automatic engine recovery, a changed target stream
engine identity rebuilds measurement state while retaining consumed allowance and
the original last-action time. It does not stack or reset the five-second guard.
Unknown actions and corrupt or unconfirmed durable state remain locked.

## Bounded records

The current continuous task retains the latest 288 five-minute summary bins,
100 action records and bounded excerpts, 32 independent fault summaries, cumulative
and dropped counts, and the largest saved-read gap. It does not save every sample.
Old absent connection identities are reclaimed above 1,024. Current ownership
indices commit before old generations and action pages are reclaimed; generation
numbers never repeat. Delayed claim writes are fenced against their original HEAD.
The newest four completed results retain full bounded evidence, and up to sixteen
completed task summaries remain. Monotonic task sequences prevent replay after
retired request keys are removed. This bounds live application records, not the
physical database file or all Surge storage.

## Validation and limits

Offline coverage includes the compiled configured entry and generated store-only
control helpers, exhaustion and expiring topup idempotence, stop/export, upgrades,
unknown actions, failed persistence, engine rebaselining, rolling 24-hour release,
repeated jobs, and a 180-day/129,600-generation ownership-key simulation. The latter
is a metadata simulation, not 180 days of full worker or hardware operation. The
existing 13,704-frame policy replay remains part of verification.

Individual persistent-store reads/writes are assumed atomic and coherent across
Surge JavaScript contexts. New hardware lifecycle, quota visibility, reclamation,
resource readiness, CPU, memory, and energy costs still require TV acceptance.
Publishing does not claim those measurements are complete. The public repository
contains generic JavaScript and documentation; private configuration, target and
device bindings, credentials, raw traces, and source manifests are excluded.
