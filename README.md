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
