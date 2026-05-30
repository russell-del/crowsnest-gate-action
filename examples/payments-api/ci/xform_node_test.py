#!/usr/bin/env python3
"""node --test stdout -> test_results studiodata + coverage studiodata.

Usage: xform_node_test.py <node-test-output.txt> <results-out.json> <coverage-out.json>

Parses the `tests N / pass N / fail N` summary lines and the
`all files | <line%> | <branch%> | ...` coverage row that
`node --test --experimental-test-coverage` emits.

Each output file is a studiodata object: a single entry whose value holds the
metrics directly, so the OPA policy can read studiodata[<key>].<field>.
"""
import json
import re
import sys

text = open(sys.argv[1], encoding="utf-8", errors="replace").read()
results_out, coverage_out = sys.argv[2], sys.argv[3]


def find_int(pattern):
    m = re.search(pattern, text)
    return int(m.group(1)) if m else 0


total = find_int(r"tests\s+(\d+)")
passed = find_int(r"pass\s+(\d+)")
failed = find_int(r"fail\s+(\d+)")

# studiodata for test_results: { "unit-tests": { framework, total, passed, failed } }
test_studiodata = {
    "unit-tests": {
        "framework": "node:test",
        "total": total,
        "passed": passed,
        "failed": failed,
    }
}
json.dump(test_studiodata, open(results_out, "w"))

line_cov = 0.0
branch_cov = 0.0
m = re.search(r"all files\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)", text)
if m:
    line_cov = float(m.group(1))
    branch_cov = float(m.group(2))

# studiodata for coverage: { "module": { tool, lineCoverage, branchCoverage } }
coverage_studiodata = {
    "module": {
        "tool": "node:test-coverage",
        "lineCoverage": line_cov,
        "branchCoverage": branch_cov,
    }
}
json.dump(coverage_studiodata, open(coverage_out, "w"))

print(
    "node-test: total=%d passed=%d failed=%d lineCov=%.1f branchCov=%.1f"
    % (total, passed, failed, line_cov, branch_cov)
)
