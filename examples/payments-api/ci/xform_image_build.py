#!/usr/bin/env python3
"""Image build facts -> image_build studiodata.

Usage: xform_image_build.py <image> <digest> <registry> <out.json>
"""
import json
import sys
import datetime

image, digest, registry, out_path = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]

studiodata = {
    digest: {
        "image": image,
        "digest": digest,
        "registry": registry,
        "pushedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    }
}
json.dump(studiodata, open(out_path, "w"))
print("image_build: %s@%s registry=%s" % (image, digest[:19], registry))
