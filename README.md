# crowsnest-gate-action

A GitHub Action that blocks a deploy unless your **CrowsNest** pipeline gate decides the release is safe to ship. Drop this step into your existing workflow right before deploy.

## Usage

```yaml
- name: CrowsNest Release Gate
  uses: russell-del/crowsnest-gate-action@v1
  with:
    api-url: https://crowsnest.your-company.internal:8000
    app-id: app-9MZI
    pipeline-name: payments-api-release
    token: ${{ secrets.CROWSNEST_TOKEN }}
```

If the gate decision is `no-go` the step fails, blocking subsequent steps (such as `kubectl apply`). On `go` the step succeeds. On `warn` the step succeeds with a GitHub annotation by default — pass `warn-as-failure: 'true'` to treat warn as a blocker too.

## Full workflow example

```yaml
name: Release
on:
  push:
    tags: ['v*']

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: ./gradlew clean bootJar test
      - run: docker buildx build -t registry.internal/payments-api:${{ github.ref_name }} --push .

      - name: CrowsNest Release Gate
        id: gate
        uses: russell-del/crowsnest-gate-action@v1
        with:
          api-url: ${{ vars.CROWSNEST_API_URL }}
          app-id: app-9MZI
          pipeline-name: payments-api-release
          token: ${{ secrets.CROWSNEST_TOKEN }}
          console-base-url: ${{ vars.CROWSNEST_CONSOLE_URL }}

      - name: Deploy
        run: kubectl apply -f deploy.yaml
        # Only runs if the gate step above passed.

      - name: Comment on release
        if: always()
        run: echo "Run detail ${{ steps.gate.outputs.run-url }}"
```

## Inputs

| Name | Required | Default | Description |
|---|---|---|---|
| `api-url` | yes | — | Base URL of your CrowsNest api-server. No trailing slash. |
| `app-id` | yes | — | CrowsNest application id (e.g. `app-9MZI`). |
| `pipeline-name` | yes | — | Name of the pipeline to run (e.g. `payments-api-release`). |
| `token` | yes | — | JWT for a CrowsNest client (service account). Store in `secrets.CROWSNEST_TOKEN`. |
| `console-base-url` | no | derived from api-url | URL for the human-readable run-detail link in step summaries. |
| `warn-as-failure` | no | `false` | Treat a `warn` decision as a failure. |
| `timeout-seconds` | no | `60` | HTTP timeout for the gate request. |

## Outputs

| Name | Example | Description |
|---|---|---|
| `decision` | `go` / `warn` / `no-go` | Pipeline-level decision. |
| `run-id` | `6a08f77e9080ab5ee1091823` | CrowsNest pipelinerun id. |
| `run-url` | `https://console.../pipelines/runs/<id>` | Browser link to the run detail. |
| `duration-ms` | `97` | Gate evaluation time. |

## What the action does

1. POSTs to `<api-url>/api/pipeline/run/<app-id>/<pipeline-name>` with `Authorization: Bearer <token>`.
2. Receives the gate decision (`go` / `warn` / `no-go`), per-stage breakdown, and per-check evidence.
3. Logs the breakdown to the GitHub Actions log (collapsed group).
4. Writes a markdown summary to `$GITHUB_STEP_SUMMARY` so the run page shows the gate result.
5. Exits with success or failure to gate downstream steps.

## Network model

GitHub-hosted runners reach `api-url` over the internet — your CrowsNest api-server must be reachable from `github.com`'s runner IP ranges, behind a tunnel, or via a **self-hosted runner** inside your network (recommended for production).

## Auth model

`token` should be a JWT minted for a CrowsNest **Client** (service account). It is registered with permissions to run the named pipeline. The action redacts the token in the GitHub Actions log via `setSecret`.

## License

MIT
