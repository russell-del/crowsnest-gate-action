#!/usr/bin/env python3
"""npm audit --json -> dep_scan studiodata.

Usage: xform_npm_audit.py <npm-audit.json> <out.json>
npm audit --json puts severity tallies under .metadata.vulnerabilities and
per-advisory detail under .vulnerabilities.
"""
import json
import sys

audit = json.load(open(sys.argv[1]))
out_path = sys.argv[2]

vmeta = audit.get("metadata", {}).get("vulnerabilities", {})
dmeta = audit.get("metadata", {}).get("dependencies", {})
total_deps = dmeta.get("total", 0) if isinstance(dmeta, dict) else (dmeta or 0)

advisories = []
for name, v in (audit.get("vulnerabilities", {}) or {}).items():
    sev = v.get("severity", "unknown")
    if sev in ("critical", "high"):
        advisories.append({"package": name, "severity": sev})

studiodata = {
    "dependency-tree": {
        "scanner": "npm-audit",
        "severityCount": {
            "critical": vmeta.get("critical", 0),
            "high": vmeta.get("high", 0),
            "moderate": vmeta.get("moderate", 0),
            "low": vmeta.get("low", 0),
        },
        "totalDependencies": total_deps,
        "advisories": advisories[:25],
    }
}
json.dump(studiodata, open(out_path, "w"))
print(
    "npm-audit: critical=%d high=%d moderate=%d deps=%d"
    % (
        vmeta.get("critical", 0),
        vmeta.get("high", 0),
        vmeta.get("moderate", 0),
        total_deps,
    )
)
