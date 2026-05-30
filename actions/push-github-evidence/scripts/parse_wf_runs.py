#!/usr/bin/env python3
"""Parse a gh workflow-runs JSON file -> 'TOTAL RATE' on stdout.

TOTAL is 1 if at least one completed run exists, else 0.
RATE is 1.0 if the most-recent completed run succeeded, else 0.0.
Committed as a file to avoid fragile inline multi-line bash inside YAML.
"""
import json
import sys

try:
    data = json.load(open(sys.argv[1]))
    runs = data.get("workflow_runs", [])
    if not runs:
        print("0 0")
    else:
        latest = runs[0].get("conclusion")
        print("1 " + ("1.0" if latest == "success" else "0.0"))
except Exception:
    print("0 0")
