#!/usr/bin/env python3
"""Build CrowsNest github_posture crowdata from real GitHub API data.

Reads posture values from environment variables (gathered by gh in the action's
shell step) and writes the crowdata document to the path in OUT_FILE. Keeping
this as a committed file — instead of inline YAML heredoc — avoids the
block-scalar parsing problems that broke earlier versions.
"""
import json
import os

repo = os.environ["CN_REPO"]
req_wf_name = os.environ["REQ_WF_NAME"]

studiodata = {
    repo: {
        "branchProtection": {"enabled": os.environ["PROT"] == "true"},
        "codeowners": {"present": os.environ["CODEOWNERS"] == "true"},
        "secretScanning": {"openAlerts": int(os.environ["OPEN_ALERTS"])},
        "workflowRuns": {
            "workflows": {
                req_wf_name: {
                    "totalCount": int(os.environ["WF_TOTAL"]),
                    "successRate": float(os.environ["WF_RATE"]),
                }
            }
        },
    }
}

doc = {
    "orgId": os.environ["CN_ORG_ID"],
    "appId": os.environ["CN_APP_ID"],
    "crowId": os.environ["CN_CROW_ID"],
    "data": {
        "applications": {
            os.environ["CN_APP_ID"]: {
                "query_results": [
                    {"result": {"data_type": "github_posture", "studiodata": studiodata}}
                ]
            }
        }
    },
}

with open(os.environ["OUT_FILE"], "w") as f:
    json.dump(doc, f)

print(
    "built github_posture: repo=%s prot=%s codeowners=%s openAlerts=%s wf(%s) total=%s rate=%s"
    % (
        repo,
        os.environ["PROT"],
        os.environ["CODEOWNERS"],
        os.environ["OPEN_ALERTS"],
        req_wf_name,
        os.environ["WF_TOTAL"],
        os.environ["WF_RATE"],
    )
)
