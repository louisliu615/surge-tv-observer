# Finite long-run TV trial service

Build identity: `ffde49017a1b44d1d2a8370e702c9cc55488ad8b6b4ae710404bed3cd25c8fb0`.

This trial build adds the explicit `long-v1` task profile. Publishing the files
does not update a TV configuration or start a task. Deploy an immutable commit
URL with a fresh private service installation, verify the previous task is
closed, and separately authorize each active trial. The service is idle until a
task is submitted. Target and device constraints are private installation
parameters; a task cannot change them.

## Task lifetime and decision changes

Legacy short tasks retain their existing fifteen-minute limits and rules. The
new profile supports up to 24 hours of wall-clock time from actual worker start.
Pausing playback, switching videos or having no target traffic does not restart
the clock. A two-minute configured timer hands state to successive finite JSC
sessions. The final session may finish up to approximately 300 ms early to close
cleanly at a timer boundary. A terminated task cannot restart itself.

An active task requires an explicit cumulative allowance of 1 to 30 attempts.
The first and last minute, or longer if specified, are observation only. Quota
exhaustion leaves observation running until the deadline. Sessions, connection
IDs and videos never replenish the allowance. Read-only tasks cannot terminate
connections. `actionsQualified` is a build capability flag, not evidence of
playback benefit or permission to start a task.

The baseline speed threshold remains 2,000,000 B/s, natural download startup
protection remains four seconds, and protection following our own termination
remains five seconds from dispatch. `long-v1` adds:

- A separate recovery-failure candidate for our own unique successor. After the
  five-second observation, at least three seconds of reliable zero or near-zero
  progress may permit one additional attempt if effective download never began.
  Ordinary buffer waiting and unrelated new connections do not receive this
  exception. Ambiguous or changing successors are excluded; tracking expires
  after thirty seconds. Identity, fresh measurements, stop flags and budgets
  are checked again before dispatch.
- At most one extra rescue in the same unresolved recovery chain. The allowance
  survives session handoffs and connection replacement. At least one accumulated
  second of substantive growth and 64 KiB of observed growth reset that chain's
  restriction; reaching the speed threshold is not required. A first observation
  already showing 64 KiB, or an observed transition into ordinary download,
  excludes the connection from the never-started-download rescue.
- A 1.5-second low-speed confirmation for the same connection after a recent
  fast window, remembered for up to ten seconds. Ordinary sustained slow traffic
  keeps its existing confirmation. Confirmed waiting clears the fast-window
  memory. Returning from no-target polling still receives four seconds from first
  appearance; our own successor does not receive an additional four seconds.

These are trial parameters, not established optimal thresholds. Connection
counters cannot reveal player demand or buffer level, and cannot completely
distinguish a stalled download from a user pausing playback.

## Storage and collection

The TV worker performs sampling, decisions, revalidation, individual connection
termination and recording. Sampling is approximately 10 Hz with a target present
(including buffered waiting) and 1 Hz with no target. The computer helper submits
parameters, reads status and exports records; it does not drive the sampling or
termination loop. A computer need not remain online for the finite task to run.

Structured records are persisted in the TV's Surge store, normally every thirty
seconds and around actions, handoffs and closure. Status and exports reflect the
last saved checkpoint. Abrupt process loss can leave the most recent samples
unsaved. Unknown action replies or inconsistent ownership prevent automatic
retry or recovery of an interrupted worker.

Long-run evidence is bounded:

- Five-minute whole-run summaries, at most 291 bins. This is aggregation, not the
  sampling interval. The latest 24 noteworthy decision excerpts are retained,
  with an explicit count of omitted earlier excerpts.
- Every action decision and consumed attempt is retained. Pre/post sample detail
  is bounded to 8 KiB per action; excess detail is decimated with an omission
  count and endpoints preserved. Post-action excerpts cover up to thirty seconds.
  These records are not a full raw 10 Hz trace.
- During a run, the current and previous large batch payloads are retained; at
  completion the final payload is retained. Older closed batch payloads are
  replaced by small markers only after their cumulative state is saved and
  verified in the successor. A saved runtime payload remains limited to 512 KiB.
- The four newest completed long-run task payloads are retained per installation.
  Older results retain summaries and explicitly report `evidenceRetired=true`.
  Export results before this retention limit if detailed history is needed.
  Existing computer exports, legacy task payloads and other installations are
  not removed by this policy.
- One-shot ownership registers, non-reusable task IDs and stop flags remain.
  Small safety metadata therefore still accumulates; total storage is not claimed
  to be constant. Capacity limits fail closed rather than erasing accounting.

No external telemetry destination is included. An API reply, successor growth,
or later speed increase does not establish that a termination improved playback.
Cross-session coordination still assumes individually atomic, coherent store
reads and writes. Long-duration TV behavior, CPU and power costs require hardware
validation.

## Distribution and offline validation

This update contains exactly `vidhub-autonomous.js`, `README.md` and `SHA256SUMS`.
Other distribution files and earlier immutable commits remain available. No
private configuration, device binding, target domain, credentials, raw sample
trace or local source manifest is included.

The matching local build passed 266 offline checks, including the compiled
configured entry, stopped/unknown actions, cumulative allowances, retention,
and a virtual 24-hour mixed-playback run over 720 sessions. Legacy-profile
decisions remain unchanged over 13,704 historical frames. Saved action excerpts
exercise the new recovery and brief-dip decisions; they do not establish their
counterfactual playback effects. Simulation is not a real one-day TV trial.
