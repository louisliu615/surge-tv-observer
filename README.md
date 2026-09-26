# Surge tvOS read-only download observer

Publication candidate, not deployed or enabled. This observer reads local request
byte counters. It has no connection-control API and sends no telemetry.

Private target hostname, device name, build constraint, and checkpoint scope are
provided through Surge's `argument` setting as percent-encoded JSON. No argument,
invalid arguments, or either enable gate set to false results in immediate exit.
The only accepted port is 443, and hostname/device matching is exact.

It reads only the internal GET /v1/requests/active API. Runtime byte history and
connection IDs stay in local memory/persistent storage; operational summaries stay
in local Surge logs. This file contains neither an API password nor subscription
URLs, LAN/tailnet addresses, device identifiers, or a configured video hostname.

The observation algorithm and short runtime have been tested separately. This
parameterized publication wrapper has local tests; its private argument delivery
and long-running scheduler still need device validation. No performance or
reconnection benefit is promised. Do not enable it merely because it is hosted.

Publish only this directory's three files into a separate repository, never the
parent workspace. Pin the downloaded script to a reviewed commit and compare the
downloaded content with SHA256SUMS. Do not upload private configuration or samples.
