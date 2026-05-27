# payments-api — sample app for the CrowsNest real-pipeline demo

A minimal Node.js HTTP service with one external dependency tree, real tests,
and a real Dockerfile. Used by [`release-payments-api.yml`][wf] to demonstrate
end-to-end CrowsNest release-gating against actual build artifacts (not
synthetic demo data).

[wf]: ../../.github/workflows/release-payments-api.yml

## What this is

This is not a real production payments API — it's a **scaffolded** sample whose
purpose is to be small enough to read in 30 seconds and real enough that:

- `npm ci` resolves ~81 transitive dependencies (so the SBOM has substance)
- `npm test` exercises the running HTTP server (real assertions)
- `docker build` produces a real OCI image with real layers
- `trivy image` finds real CVEs in the base image + node_modules
- The CrowsNest gate evaluates real evidence and either lets the (fake) deploy
  step run or blocks it

## Layout

```
examples/payments-api/
├── package.json          — 2 deps (express, pino)
├── package-lock.json     — pinned dependency tree
├── server.js             — 2 endpoints (/, /health)
├── server.test.js        — 2 tests using node:test
├── Dockerfile            — pinned base, non-root user, healthcheck
├── .dockerignore         — keeps node_modules + git out of the build context
└── README.md             — this file
```

In a real customer codebase this would live at the repo root, not under
`examples/`. The workflow's `working-directory: examples/payments-api` setting
is the only thing that changes between this sample and a customer's own
service.

## Run locally

```bash
cd examples/payments-api
npm ci
npm test              # runs the test suite
npm start             # starts the server on :3000

curl http://localhost:3000/health
curl http://localhost:3000/
```

## Build the container locally

```bash
docker build -t payments-api:dev .
docker run --rm -p 3000:3000 payments-api:dev
```

The image is ~200 MB (node:20-alpine base + npm-installed deps).

## Trigger the real release workflow

From your laptop, in this repo:

```bash
gh workflow run release-payments-api.yml \
  --repo crowsnest/release-gate-action
```

What happens:

1. GitHub-hosted runner picks up the job (`ubuntu-latest`)
2. `npm ci` + `npm test` — real install and real test execution
3. `docker buildx build --push` — real image built and pushed to
   `ghcr.io/<owner>/release-gate-action/payments-api:<sha>` with SBOM
   attestation + SLSA provenance
4. Trivy scans the pushed image for CVEs (real findings against real layers)
5. The [`push-cve-evidence`](../../actions/push-cve-evidence) action posts the
   Trivy result to the public CrowsNest install at 152.228.243.192
6. The gate action evaluates the `acme-build-evidence` pipeline against that
   fresh evidence
7. If no Critical CVEs → deploy step runs. Any Critical CVE → workflow halts
   at the gate.

After the run, inspect the evidence in CrowsNest:

```bash
# The most recent CVE evidence pushed for app-ACME
TOKEN=$(curl -sS -i -X POST http://152.228.243.192:18000/api/users/auth \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@crowsnest-pipeline.local","password":"PipelineAdmin1!"}' \
  | grep -i 'set-cookie: jwt=' | sed -E 's/.*jwt=([^;]+);.*/\1/' | tr -d '\r')

curl -sS -H "Authorization: Bearer $TOKEN" \
  "http://152.228.243.192:18000/api/crowdata?appId=app-ACME&crowId=6a1b000000000000000000c0&orgId=69e292d39fcbcce79bd877ad" \
  | jq '.data.applications."app-ACME".query_results[0].result.studiodata'
```

You'll see the digest of the image *this very workflow run* produced, the real
Trivy scanner version, the actual severity counts, and the full vulnerability
list — not the synthetic demo data the older `e2e-public.yml` workflow used to
produce.
