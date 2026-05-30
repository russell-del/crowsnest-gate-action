#!/usr/bin/env python3
"""Wrap a studiodata JSON file in the CrowsNest crowdata envelope and write it.

Reads:
  CN_STUDIODATA_FILE - path to JSON holding the studiodata object
  CN_DATA_TYPE, CN_APP_ID, CN_ORG_ID, CN_CROW_ID, OUT_FILE
"""
import json
import os

studiodata = json.load(open(os.environ["CN_STUDIODATA_FILE"]))

doc = {
    "orgId": os.environ["CN_ORG_ID"],
    "appId": os.environ["CN_APP_ID"],
    "crowId": os.environ["CN_CROW_ID"],
    "data": {
        "applications": {
            os.environ["CN_APP_ID"]: {
                "query_results": [
                    {
                        "result": {
                            "data_type": os.environ["CN_DATA_TYPE"],
                            "studiodata": studiodata,
                        }
                    }
                ]
            }
        }
    },
}

with open(os.environ["OUT_FILE"], "w") as f:
    json.dump(doc, f)

print("wrapped %s -> %s" % (os.environ["CN_DATA_TYPE"], os.environ["OUT_FILE"]))
