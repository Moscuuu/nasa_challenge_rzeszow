"""Initialise Earth Engine with the project's service account.

Usage: from ee_init import init; init()
Key lives outside the repo (see context/ui-setup-reference.md §2.4). Override with env vars
EE_PROJECT / EE_SA / EE_KEY if your setup differs.
"""
import os

import ee

PROJECT = os.environ.get("EE_PROJECT", "melodic-subject-506217-a1")
SA = os.environ.get("EE_SA", f"analog-finder-ee@{PROJECT}.iam.gserviceaccount.com")
KEY = os.path.expanduser(os.environ.get("EE_KEY", "~/.config/analog-finder/ee-key.json"))


def init():
    ee.Initialize(ee.ServiceAccountCredentials(SA, KEY), project=PROJECT)
    return ee


if __name__ == "__main__":
    init()
    print("Earth Engine OK:", ee.Image("USGS/SRTMGL1_003").bandNames().getInfo())
