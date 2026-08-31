# Assumptions and Findings

The brief requires that any assumptions made while solving this challenge are
documented and communicated. This file records three things:

1. **Interpretations** — where the brief left room for judgement, and what was chosen.
2. **API findings** — behaviour verified against the live Trello API, including
   several places where it contradicts Atlassian's published documentation.
3. **Design constraints** — decisions forced by the API's real limits.

---

## 1. Interpretations of the brief

### 1.1 The suite tests the API, not the web application

The brief says "Trello API Challenge" and "each API endpoint works as expected".
The suite therefore drives the Trello REST API through Playwright's
`APIRequestContext` and never launches a browser. No UI automation is included.

A practical consequence: `npx playwright install` is deliberately absent from the
CI pipeline. Browser binaries are never needed, which removes roughly two minutes
of setup from every run.

### 1.2 Implemented in TypeScript rather than plain JavaScript

**The brief specifies JavaScript.** This solution is written in TypeScript, which
compiles to JavaScript and requires no build step under Playwright's native
transpilation.

Rationale: an API contract-testing suite benefits materially from typed response
shapes, and a `tsc --noEmit` gate in CI makes those types enforced rather than
decorative. Playwright strips types without checking them, so without that gate
TypeScript would be cosmetic — the pipeline runs the type check as a separate,
failing step before any test executes.

If plain JavaScript is a hard requirement, the suite converts by removing type
annotations. No structural change is needed.

### 1.3 "Performance testing" means response-time SLA validation

Playwright is not a load-generation tool, and Trello permits only 100 requests per
10 seconds per token. A genuine load test would measure Atlassian's rate limiter
rather than their endpoints, and would be a worse answer, not a better one.

What the suite does instead is rigorous within its scope:

- Repeated measurement per endpoint (20 samples, configurable via `PERF_ITERATIONS`)
- Warm-up iterations discarded, so DNS and TLS handshake costs are excluded
- Rate-limited samples discarded, since their duration reflects throttling
- Percentile analysis (p50/p90/p95) rather than averages
- Assertions against declared budgets, with a minimum-sample guard so a heavily
  throttled run fails rather than reporting a confident number from three points

**Percentiles, not averages, because the data demanded it.** `GET /boards/{id}/lists`
measured p50 = 252ms against p90 = 452ms. The mean would land near 350ms and hide
that the slowest tenth of requests take nearly double the median.

### 1.4 Cleanup is part of the workflow under test

The brief lists "cleaning up the entire setup" as a stage of the workflow, not as
housekeeping. The end-to-end test therefore deletes its own resources and asserts
that the deletions succeeded, rather than delegating cleanup to a fixture where it
would happen invisibly and never be verified.

Fixtures still guarantee cleanup for the functional tests, where teardown is
incidental rather than the thing being tested.

---

## 2. API findings verified against the live Trello API

Each finding below was confirmed by executing the suite. Where it contradicts
Atlassian's published documentation, that is noted.

| # | Behaviour | Documentation status |
|---|---|---|
| 1 | Creates return `200`, not `201`. Deletes return `200`, not `204`. | Documented, but contrary to REST convention |
| 2 | An invalid API key and an invalid token both return `401`, with a `text/plain` body rather than the JSON error schema the OpenAPI spec declares | Undocumented |
| 3 | `GET` on a deleted card or a deleted board returns `404` | Undocumented |
| 4 | `GET /lists/{id}` returns `color`, `datasource` and `type` in addition to the documented `name,closed,idBoard,pos` defaults | Documentation incomplete |
| 5 | `DELETE /lists/{id}` returns `400` and leaves the list intact. Lists cannot be deleted at all — archiving via `PUT /lists/{id}/closed` is the only removal mechanism | Deletion absent from the API; the status code is undocumented, and is not the `404` the status-code guide implies for an unregistered route |
| 6 | An unknown board ID returns `404` from `GET /boards/{id}` but `401` from `POST /lists`. Trello's `401` explicitly covers "the user doesn't have permissions", so an absent resource is indistinguishable from a forbidden one — but the two endpoints answer differently | Inconsistent between endpoints |
| 7 | `POST /cards` requires only `idList`. `name` is optional and defaults to an empty string | Documented, but easily missed |
| 8 | A board created without `defaultLists: false` arrives with three lists already present, named `To Do`, `Doing`, `Done` | Documented default; asserted explicitly so a change would be caught |

Findings 5 and 6 are the ones with real consequences for test design, and both are
marked with `FINDING:` comments at their assertion sites.

### Consequence of finding 5 on test structure

Because lists cannot be deleted, cleanup can only ever happen by deleting the
parent board. That makes the board the natural unit of test isolation: the `list`
fixture has no teardown of its own, and says so in a comment so a future reader
does not "fix" the apparent omission.

### Assertion strength

Finding 4 arose from an assertion that was initially too strict — it required an
exact field set and broke when Trello returned three undocumented extras that
harmed nothing. It now asserts the documented fields as a *subset*, which tests
the real contract while tolerating additions. Over-specified assertions are the
main cause of brittle suites, and this one is left as an example.

---

## 3. Design constraints and decisions

### 3.1 Rate limiting drives concurrency

Trello permits **300 requests per 10 seconds per API key** but only **100 per 10
seconds per token**. The suite has one token, so the token ceiling governs:

- The client paces requests with a minimum interval (`MIN_REQUEST_INTERVAL_MS`, default 120ms)
- Playwright is capped at 2 workers in CI, 4 locally
- The CI workflow uses a fixed `concurrency` group so two runs never overlap and
  compete for the same budget

Pacing happens *before* the response timer starts, so throttling never inflates a
measured latency. Across 110 performance requests, zero samples were rate-limited.

**Known limitation:** pacing state is per-worker-process, since Playwright workers
are separate processes. Two workers at 120ms intervals could in principle exceed
10 requests/second. The `429` retry is the backstop for that case.

### 3.2 Retries are narrow and deliberate

The client retries **only on `429`**, with exponential backoff, up to three times.
Any other status — including `5xx` — is returned to the test and reported.

Blanket retries make suites useless by letting genuinely broken endpoints pass on
the third attempt. `429` is the one status that is definitionally transient and
definitionally not a defect in the system under test.

Playwright-level retries are set to 2 in CI and 0 locally: transient network
failures against a third-party service over the public internet are real, but
locally flakiness should be visible while tests are being written.

Retried requests are excluded from performance measurements, and the returned
`durationMs` covers only the final attempt, so backoff delays never enter the data.

### 3.3 Test data is run-scoped and prefixed

Every resource is named `masdr-e2e-<runId>-<kind>-<uuid>`.

The prefix is a **safety mechanism**, not a convention. The orphan sweep deletes
Trello boards automatically, and the prefix filter is a required parameter — it
cannot be omitted — so the sweep can never touch a real board on the account.

The run ID exists because a naive "delete everything with my prefix" sweep would
destroy a concurrent run's live boards. Two sweeps with different rules:

- **Global setup** clears prefixed boards untouched for over two hours — ancient
  orphans from runs that died before teardown. Age-gated so live work is safe.
- **Global teardown** clears this run's prefix with no age gate, because anything
  still standing from this run is by definition a leak.

Free Trello allows **10 open boards**. A suite that leaks boards on failure would
render the account unusable within a few red runs, which is why cleanup was built
before any test was written.

### 3.4 Latency measurement methodology

`durationMs` brackets Playwright's `fetch` call: from request dispatch to the
response being available. Body parsing happens afterwards and is excluded.

**These numbers include network distance.** Measurements were taken from Saudi
Arabia against Atlassian's infrastructure, so a substantial share of the 250–450ms
baseline is round-trip network time rather than Trello's processing. The suite
measures *observed client-side latency*, which is the correct thing for an SLA;
claiming it measures Trello's server performance would overreach.

Budgets are set at roughly **2× the observed p95**, not tightened to the measured
values, because an SLA must hold across environments. GitHub Actions runners sit in
a different region with different network characteristics, and a threshold tuned to
one developer's ISP measures that ISP.

| Endpoint | p50 | p95 | Budget |
|---|---|---|---|
| `GET /members/me` | 431ms | 445ms | 1000ms |
| `GET /boards/{id}` | 450ms | 542ms | 1000ms |
| `GET /boards/{id}/lists` | 252ms | 453ms | 1000ms |
| `POST /cards` | 471ms | 649ms | 1500ms |
| `PUT /cards/{id}` | 344ms | 432ms | 1500ms |

Read and write budgets are separate because the data justifies it: writes measured
measurably slower than reads.

### 3.5 Reporting toolchain

`allure-playwright` produces results consumed by two different generators:

- **Locally**, the Allure 3 CLI (`allure`), which is pure Node and needs no JDK
- **In CI**, the `simple-elf` action, which bundles Allure 2 and provides trend
  history across runs via the `gh-pages` branch

The results format is compatible with both. The split exists because Allure 2
requires Java, which is not assumed on a developer machine, while the Allure 2
Pages action is the well-tested route to working trend history.

The report is published two ways: a **single-file HTML artifact** on every run,
which opens by double-click, and a **GitHub Pages site** with trend history. Pages
publishes only from `main` — publishing from a pull request would overwrite the
public report with unmerged results.

### 3.6 Known limitations

- **Percentiles from 20 samples** are indicative, not statistically robust.
  Sample size is capped by the rate limit; `PERF_ITERATIONS` raises it where the
  budget allows.
- **Single-region measurement.** Latency figures are not portable between
  geographies, as noted above.
- **One Trello account.** Multi-user permission scenarios — board sharing,
  organisation membership, read-only tokens — are untested. They would need a
  second account and are out of scope for this challenge.
- **No schema-level contract validation.** Response shapes are asserted field by
  field rather than against a JSON Schema. A schema validator would be the natural
  next step for a production suite.
