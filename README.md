# Surge tvOS finite read-only observer trial

Reads only internal GET /v1/requests/active. No connection-control API, external
network calls, notifications, or telemetry. No private device or target values
are embedded. All bindings are percent-encoded JSON in the private argument.

This trial accepts the original binding fields plus trialId, latestStartMs and
hardStopMs. Both enable gates must be true, and platform/build must match. It runs
at most ten batches over five minutes from its first start, subject to a fixed
absolute expiry. Each batch ends within 29.7 seconds. Counter history and bounded
reports are persisted locally; malformed storage or unfinished batches stop work.
The lease guard is not a proven atomic lock, so it cannot authorize actions.

After expiry, future cron launches return without sampling. Disable the cron
declaration after the trial to remove even those empty launches. This is not an
automatically self-removing scheduled task. Power consumption is not measured.

The detector and adapter are unchanged from the prior tested observer; this
wrapper adds duration limits, durable batch reports and handoff timing. Pin the
script to a reviewed commit and verify SHA256SUMS. Never upload private arguments,
configuration, samples or state. Publishing does not enable any device.
