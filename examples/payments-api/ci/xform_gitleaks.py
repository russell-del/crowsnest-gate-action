#!/usr/bin/env python3
"""gitleaks JSON report -> secret_scan studiodata.

Usage: xform_gitleaks.py <gitleaks-report.json> <files-scanned> <out.json>
gitleaks `detect -f json` emits a JSON array of findings (empty array = clean).
"""
import json
import sys

report_path, files_scanned, out_path = sys.argv[1], int(sys.argv[2]), sys.argv[3]

try:
    findings = json.load(open(report_path))
    if not isinstance(findings, list):
        findings = []
except Exception:
    findings = []

summary = [
    {
        "rule": f.get("RuleID", "?"),
        "file": f.get("File", "?"),
        "line": f.get("StartLine", 0),
    }
    for f in findings[:25]
]

studiodata = {
    "source-tree": {
        "scanner": "gitleaks",
        "leakCount": len(findings),
        "filesScanned": files_scanned,
        "findings": summary,
    }
}
json.dump(studiodata, open(out_path, "w"))
print("gitleaks: leakCount=%d filesScanned=%d" % (len(findings), files_scanned))
