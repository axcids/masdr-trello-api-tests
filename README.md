# Trello API Test Automation

[![Trello API Tests](https://github.com/axcids/Masdr_Technical_Challenge/actions/workflows/api-tests.yml/badge.svg)](https://github.com/axcids/Masdr_Technical_Challenge/actions/workflows/api-tests.yml)

Automated functional and performance testing of the Trello REST API, built with
Playwright and TypeScript. Covers a realistic end-to-end workflow — create a
board, add a list, add a card, update it, tear the whole setup down — plus
endpoint-level coverage of boards, lists and cards, and response-time SLA
validation.

**Live Allure report:** https://axcids.github.io/Masdr_Technical_Challenge/

Design decisions, API findings and known limitations are documented in
[ASSUMPTIONS.md](./ASSUMPTIONS.md).

---

## Quick start

### Prerequisites

- Node.js 20 or later
- A Trello account and API credentials

### Credentials

Trello now issues API keys through a Power-Up rather than the legacy
`trello.com/app-key` page:

1. Visit [trello.com/apps/admin](https://trello.com/apps/admin) and create a Power-Up
2. Open it, go to the **API Key** tab, and generate a key
3. Click the hyperlinked **Token** beside the key and authorise it

Choose `expiration=never` so the token does not expire mid-review.

### Setup

```bash
git clone https://github.com/axcids/Masdr_Technical_Challenge.git
cd Masdr_Technical_Challenge
npm ci
cp .env.example .env      # then fill in your key and token
```

The suite fails immediately with an actionable message if either credential is
missing, rather than surfacing it later as an unexplained `401`.

### Running

```bash
npm test                  # type-check, then the full suite
npm run test:e2e          # the end-to-end workflow only
npm run test:functional   # endpoint coverage only
npm run test:performance  # response-time SLAs (pinned to one worker)
```

### Viewing the report

```bash
npm run report
npm run report:open
```

`report:open` starts a local web server. Opening `allure-report/index.html`
directly from the filesystem renders a blank page — Allure loads its data over
`fetch`, which browsers block on `file://`.

---

## Scripts

| Script | Purpose |
|---|---|
| `npm test` | Clean, type-check, then run every project |
| `npm run typecheck` | `tsc --noEmit` — types are enforced, not decorative |
| `npm run verify` | What CI runs: clean, type-check, full suite |
| `npm run clean` | Remove previous results and reports |
| `npm run report` | Generate the Allure HTML report |
| `npm run report:open` | Serve the report locally |

---

## Configuration

All settings are environment variables, with defaults suitable for local use.

| Variable | Default | Purpose |
|---|---|---|
| `TRELLO_API_KEY` | *(required)* | Trello API key |
| `TRELLO_TOKEN` | *(required)* | Trello API token |
| `TRELLO_BASE_URL` | `https://api.trello.com/1` | API base URL |
| `TRELLO_RESOURCE_PREFIX` | `masdr-e2e` | Prefix for all test-created resources |
| `SLA_READ_MS` | `1000` | Response-time budget for reads |
| `SLA_WRITE_MS` | `1500` | Response-time budget for writes |
| `PERF_ITERATIONS` | `20` | Samples per performance measurement |
| `MIN_REQUEST_INTERVAL_MS` | `120` | Client-side pacing, to stay under the rate limit |

---

## Project structure

```
src/
  clients/     Trello API client: auth injection, timing, 429 backoff
  config/      Environment loading and validation
  fixtures/    Playwright fixtures with guaranteed teardown
  types/       Partial response models for the endpoints under test
  utils/       Naming, HTTP helpers, statistics, orphan cleanup
  global-setup.ts     Assigns a run ID, sweeps ancient orphaned boards
  global-teardown.ts  Sweeps this run's leftovers

tests/
  e2e/          The end-to-end workflow the brief describes
  functional/   Endpoint coverage: positive, negative and boundary cases
  performance/  Response-time SLA validation
```

Nothing under `tests/` does anything but assert; everything supporting those
assertions lives in `src/`.

---

## Test strategy

**52 tests across three projects.**

### End-to-end (1 test)

One journey through the workflow, expressed as nine `test.step()` calls rather
than nine interdependent tests. Steps give the same granularity in the report
without creating order-dependent tests.

Each stage asserts from two directions: the write response reports success, and a
follow-up read proves it persisted. An API that echoes a request back without
committing it is a real failure mode, and one extra round trip catches it.

### Functional (46 tests)

Every endpoint is approached from three angles:

| Angle | Question | Example |
|---|---|---|
| Positive | Does it work with valid input? | Create a board → `200`, name matches |
| Negative | Does it fail *correctly*? | Create without `name` → `400`, not `500` |
| Boundary | What happens at the edges? | Non-Latin characters in names |

Negative cases carry most of the signal. Asserting that a missing required field
yields `400` rather than `500` tests the API's error contract; a `500` there would
be a genuine defect.

### Performance (5 tests)

Response-time SLA validation with percentile analysis. Warm-up and rate-limited
samples are discarded, and a minimum-sample guard fails the test rather than
reporting a percentile computed from too few points. Runs pinned to one worker —
concurrent requests would measure contention rather than latency.

See [ASSUMPTIONS.md](./ASSUMPTIONS.md) for measured baselines and how the budgets
were derived.

### Test isolation

Every test creates its own board and tears it down through a fixture, so teardown
runs on pass, fail, timeout or throw. Resources are named with a run-scoped prefix,
and an orphan sweep runs before and after every execution. Free Trello permits
only 10 open boards, so a suite that leaked them would disable the account within
a few failed runs.

---

## Continuous integration

`.github/workflows/api-tests.yml` runs on every push and pull request to `main`,
and on demand via `workflow_dispatch`.

1. Install dependencies with `npm ci`
2. Type-check — a type error fails the build before any test runs
3. Run end-to-end and functional projects
4. Run performance tests separately, pinned to one worker
5. Publish the Allure report

**Browser binaries are never installed.** The suite drives the REST API through
Playwright's request context and launches no browser, saving roughly two minutes
per run.

**Runs are serialised** via a fixed `concurrency` group with
`cancel-in-progress: false`. One token means one shared rate-limit budget, and
cancelling mid-run would skip fixture teardown and orphan real boards.

**Failing tests still publish their report.** The test steps record their outcome
instead of aborting, the report publishes, and a final step re-fails the job — so
the build status is truthful *and* the failure is diagnosable.

### Report publishing

| Destination | Availability | Notes |
|---|---|---|
| GitHub Pages | Pushes to `main` | Trend history across the last 20 runs |
| Workflow artifact | Every run, including PRs | Single-file HTML, opens by double-click |

Pull requests get the artifact but do not publish to Pages — that would overwrite
the public report with unmerged results.

### Secrets

`TRELLO_API_KEY` and `TRELLO_TOKEN` are repository secrets. Names match `.env`
exactly, since the configuration layer reads `process.env` and does not care
whether a value came from a file or the runner.

---

## Git workflow

Initial project scaffolding was committed directly to `main`. All subsequent work
was developed on short-lived feature branches and merged via pull request.

Trunk-based development with short-lived branches was chosen over GitFlow
deliberately. GitFlow exists to manage versioned software with parallel releases;
a test suite has no releases, so `develop` and `release/*` branches would be
ceremony without purpose. The work here is small, sequential and single-author,
branches live hours rather than weeks, and CI runs on every pull request to keep
`main` green.

Branches are named by type — `feat/`, `test/`, `ci/`, `fix/`, `chore/` — and
commit messages follow [Conventional Commits](https://www.conventionalcommits.org/),
so `git log --oneline` reads as a narrative of how the solution was built.

`.gitattributes` normalises line endings to LF, so editing on Windows does not
produce diffs containing no actual change.
