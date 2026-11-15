"""Check the Mars thermal model (TES albedo / thermal inertia) against Phoenix MET and the Mars Climate Database.

python analysis/mars_tes/model_checks.py            # uses cached MCD csv
python analysis/mars_tes/model_checks.py --fetch    # rebuild the MCD csv from mcd_raw/ (delete mcd_raw/ to re-query the v6.2 web interface, 24 queries)
No tuning here: the differences are reported, not minimised.
"""
import csv
import json
import re
import sys
import time
from pathlib import Path

import numpy as np
import requests

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(ROOT / "pipeline"))
from mars_thermal import run_sites  # noqa: E402
from tes import site_surface  # noqa: E402

MCD_CSV = HERE / "mcd_summer_tmax.csv"
RAW_DIR = HERE / "mcd_raw"
PHOENIX = {"id": "phoenix", "lat": 68.22, "lon": -125.75}
LS_NORTH, LS_SOUTH = (105, 135, 165), (285, 315, 345)
SCENARIO = "climatology (dust=1, average solar)"
BASE = "https://www-mars.lmd.jussieu.fr/mcd_python/cgi-bin/"
URL = (BASE + "mcdcgi.py?var1=tsurf&var2=none&var3=none&var4=none&datekeyhtml=1&ls={ls}&localtime=all"
       "&latitude={lat}&longitude={lon}&altitude=10.&zkey=3&dust=1&hrkey=1&averaging=off&dpi=80&islog=off"
       "&colorm=jet&proj=cyl&plat=&plon=&palt=&trans=&iswind=off&latpoint=&lonpoint=")


def load_sites():
    sites = json.load(open(ROOT / "data/interim/mars_sites.json"))
    return [{"id": s["id"], "lat": s["lat"], "lon": s["lon"], "albedo": s["albedo"],
             "ti": s["thermal_inertia"], "model": s["temperature"]["summer_tmax"]} for s in sites]


def mcd_daily_max(lat, lon, ls):
    RAW_DIR.mkdir(exist_ok=True)
    cache = RAW_DIR / f"{lat}_{lon}_{ls}.txt"
    if not cache.exists():
        html = requests.get(URL.format(ls=ls, lat=lat, lon=lon), timeout=120).text
        href = re.search(r"""href=['"]\.\./txt/([^'"]+\.txt)""", html).group(1)
        cache.write_text(requests.get(BASE + "../txt/" + href, timeout=120).text)
        time.sleep(2)
    rows = [l.split() for l in cache.read_text().splitlines() if l.strip() and not l.startswith("#")]
    return max(float(r[1]) for r in rows)


def fetch_mcd(points):
    out = []
    for p in points:
        lss = LS_NORTH if p["lat"] >= 0 else LS_SOUTH
        vals = [mcd_daily_max(p["lat"], p["lon"], ls) for ls in lss]
        out.append({"id": p["id"], "lat": p["lat"], "lon": p["lon"],
                    "mcd_summer_tmax_K": round(float(np.mean(vals)), 2), "scenario": SCENARIO,
                    "ls_samples": " ".join(map(str, lss))})
        print(out[-1], flush=True)
    with open(MCD_CSV, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(out[0]))
        w.writeheader()
        w.writerows(out)


def phoenix_check(s):
    out = run_sites(np.array([PHOENIX["lat"]]), np.array([s["albedo"]]), np.array([s["ti"]]))
    ls = out["sol_ls"]
    win = (ls >= 77) & (ls <= 148)
    mission = float(out["daily_max"][0][win].mean())
    summer = float(out["summer_tmax"][0])
    met = list(csv.DictReader(open(ROOT / "analysis/phoenix/phoenix_met_daily.csv")))
    met_tmax = float(np.mean([float(r["t_max"]) for r in met if r["full_sol"] == "True"]))
    # daily min: model surface vs MET air, same caveat (surface is colder than air at night)
    mission_min = float(out["daily_min"][0][win].mean())
    met_tmin = float(np.mean([float(r["t_min"]) for r in met if r["full_sol"] == "True"]))
    return mission, summer, met_tmax, int(win.sum()), mission_min, met_tmin


def main():
    sites = load_sites()
    ph = site_surface(PHOENIX["lat"], PHOENIX["lon"], ROOT / "data/raw/tes")
    ph_s = {**PHOENIX, "albedo": ph["albedo"], "ti": ph["thermal_inertia"]}
    mission, summer, met, nsol, mission_min, met_min = phoenix_check(ph_s)
    ph_s["model"] = summer
    points = sites + [ph_s]
    if "--fetch" in sys.argv or not MCD_CSV.exists():
        fetch_mcd(points)
    mcd = {r["id"]: float(r["mcd_summer_tmax_K"]) for r in csv.DictReader(open(MCD_CSV))}
    print(f"\nPhoenix mission window Ls 77-148 ({nsol} sols): model surface tmax {mission:.1f} K, "
          f"MET air tmax (full sols) {met:.1f} K, diff {mission - met:+.1f} K")
    print(f"Phoenix daily min, same window: model surface tmin {mission_min:.1f} K, "
          f"MET air tmin (full sols) {met_min:.1f} K, diff {mission_min - met_min:+.1f} K "
          f"(surface vs air at 1 m, not the same quantity)")
    print(f"\n{'id':22s}{'albedo':>8s}{'TI':>8s}{'model':>8s}{'MCD':>8s}{'delta':>8s}")
    d = []
    for p in points:
        delta = p["model"] - mcd[p["id"]]
        d.append(delta)
        print(f"{p['id']:22s}{p['albedo']:8.3f}{p['ti']:8.1f}{p['model']:8.1f}{mcd[p['id']]:8.1f}{delta:+8.1f}")
    print(f"delta min {min(d):+.1f} max {max(d):+.1f} mean {np.mean(d):+.1f} K")


if __name__ == "__main__":
    main()
