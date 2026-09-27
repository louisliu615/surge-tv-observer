# Read-only TV job service v2

Publishing these files does not deploy a configuration or start a task.
The compiled `actionsQualified` gate remains false. The v2 task protocol accepts
only observation and store-probe tasks; it cannot enable connection termination.

## Stable deployment, separate tasks

Deploy a private service binding once, using a fixed commit URL. Two configured
JSC cron entries run every two minutes: a worker and a probe peer, each with a
120-second timeout. The binding contains the installation identity, target and
TV environment constraints, but no trial ID or trial dates.

A local, one-shot maintenance helper submits task parameters to the TV store.
It performs no traffic reads, network requests or sampling loop. The TV's own
configured timer admits and executes the task. Submission acknowledgment,
actual startup and terminal completion are separate states.

Tasks have unique IDs, a delay relative to TV receipt, a bounded first-start
grace period, a target-wait budget and a sampling duration. Sampling lasts at
most fifteen minutes after productive target traffic is observed; an absolute
deadline also bounds waiting and execution. Identical resubmission returns the
original task without extending its clock. Pending or unstarted expired tasks
can be replaced with a new ID. Running tasks must stop and close first.

## Probe and observation

The store probe is a separate task requiring no playback. Two finite configured
sessions perform twelve rounds with independent keys and export up to twenty-four
reports. Missing or late actors leave incomplete evidence; old rounds are never
filled retrospectively. Finite probe success does not prove every possible store
execution and never unlocks actions.

Observation retains the existing download decision pipeline and startup/retry
protection. It samples target connections nominally every 100 ms, or every second
when no target exists. State and budgets survive normal two-minute handoffs.
Unexpected ownership or incomplete runtime state blocks automatic takeover.

When idle, delayed or finished, the service exits without traffic reads or idle
logs. The two cron declarations still represent a nominal sixty short invocations
per hour. CPU and power cost remain unmeasured. Removing all periodic invocations
requires removing the declarations from the configuration.

## Distribution and remaining acceptance

This update changes only `vidhub-autonomous.js`, this README and `SHA256SUMS`.
The previous standalone `vidhub-ownership-probe.js` is retained unchanged for
older fixed-version configurations; v2 runs its probe inside the main bundle.
Other pre-existing distribution files are retained.

No private configurations, bindings, device identifiers, target domain,
credentials, sample traces or local source manifests are publication inputs.
There is no external telemetry destination. Records remain in the TV store;
long-term retention and cleanup require separate review.

Local checks cover built-script execution, store-only control, concurrency,
idempotency, rescheduling, cancellation, bounded runtime, multi-session handoff,
probe completeness, native profile syntax and historical rule parity. They do
not substitute for TV acceptance of this version or measurements of its overhead.
Cross-session coordination still assumes coherent atomic individual store reads
and writes. The action release gate remains closed pending further acceptance.

References: [Surge scripting](https://manual.nssurge.com/scripting/overview.html),
[persistent storage](https://manual.nssurge.com/scripting/api.html),
[configured cron](https://manual.nssurge.com/scripting/cron.html).
