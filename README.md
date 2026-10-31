# Continuous mode without a daily action quota

Independent fixed-version update after 45f94019. Stable main and earlier fixed releases are unchanged. Publication alone neither deploys nor starts a task.

An explicit service `baseLimit: null` removes the rolling 24-hour admission quota for continuous tasks. Missing configuration keeps the previous default, and explicit 100/200 limits remain supported. Unlimited status reports `unlimited: true` and `remaining: null`; this is not zero or an invented balance. Finite task attempt limits remain enforced.

## Preserved behavior

The fixed five-second post-action protection, natural startup protection, target matching, speed thresholds, productive main-connection requirements, wait handling, bounded own-successor rescue, recovery confirmation, fresh revalidation and unknown-action fault locks are unchanged. There is no new burst limiter, cooldown or backoff. Runtime admission still durably records each reservation before a single-connection action.

Unlimited mode retains lifetime counters and at most 200 recent reservation entries, with entries older than 24 hours removed. These retained entries are not a complete rolling daily count. Action evidence remains bounded to the existing most recent 100 actions. Other retention and scheduling limits are unchanged.

## Upgrade and rollback

Close and independently verify the prior task before moving to a new installation and task. Preserve the ledger scope, lifetime sequence, existing records, fault state and previous action time. A locked unknown action cannot be unlocked by this change. Direct downgrade from unlimited to a capped or old-code installation is refused; the bounded retained history cannot reconstruct a complete daily allowance. Such rollback requires a separate conservative migration.

Use authoritative source files for deployment, not redacted runtime exports. The public bundle contains no installed target names, device bindings, private proxy configuration or credentials.

## Validation

Build identity: c2beafac7f9d929aadb7ff08265bdab564722052cd42ada6430c6a6215948ee6.
551 offline checks passed, including 13,704 historical frames and 402 restores. Checks cover actions beyond 200, five-second spacing, cross-batch continuation, engine recovery, unknown-action lock, stop, finite/observe modes, bounded storage and migration from an exhausted ledger. The real exported old ledger was replayed locally with 1,000 additional simulated reservations; history and action time were retained. Eleven detector/policy/pipeline files match the previous fixed release byte for byte. Real TV activation and playback effects remain to be verified.
