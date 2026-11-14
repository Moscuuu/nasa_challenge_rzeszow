"""Aggregate Phoenix MET RML files into per-sol stats. Args: IN_DIR OUT_CSV"""
import csv, glob, os, sys
from collections import defaultdict

IN, OUT = sys.argv[1], sys.argv[2]
SOL = 88775.244  # seconds in a Mars sol
COLS = ["dur", "p_avg", "p_sd", "p_min", "p_max",
        "t250_avg", "t250_sd", "t250_min", "t250_max",
        "t500_avg", "t500_sd", "t500_min", "t500_max",
        "t1000_avg", "t1000_sd", "t1000_min", "t1000_max",
        "tref_avg", "tref_sd", "tref_min", "tref_max", "event"]

inv = {r["FILE_NAME"]: r for r in csv.DictReader(open(os.path.join(IN, "inventory.csv")))}

samples = []  # (sol, ltst_h, ls, row dict)
for fn in sorted(glob.glob(os.path.join(IN, "*RML_*.TAB"))):
    meta = inv[os.path.basename(fn)]
    sol0 = int(os.path.basename(fn)[2:5])
    parts = meta["LOCAL_TRUE_SOLAR_TIME"].split(":")
    if len(parts) != 3:
        print("skip (bad LTST in inventory):", os.path.basename(fn), meta["LOCAL_TRUE_SOLAR_TIME"])
        continue
    h, m, s = map(float, parts)
    t0 = h * 3600 + m * 60 + s  # Mars-seconds into sol (LTST scaled to 86400)
    ls = float(meta["Ls"])
    for line in open(fn):
        v = [float(x) for x in line.split(",") if x.strip()]
        if len(v) != len(COLS):
            continue
        r = dict(zip(COLS, v))
        mars_s = t0 + r["dur"] * 86400 / SOL  # convert Earth s -> LTST-scaled s
        sol = sol0 + int(mars_s // 86400)
        ltst = (mars_s % 86400) / 3600
        samples.append((sol, ltst, ls, r))

by_sol = defaultdict(list)
for s in samples:
    by_sol[s[0]].append(s)

out = []
for sol, ss in sorted(by_sol.items()):
    hours = {int(x[1]) for x in ss}
    t = [x[3]["t1000_avg"] for x in ss if 120 < x[3]["t1000_avg"] < 320]
    tmin = [x[3]["t1000_min"] for x in ss if 120 < x[3]["t1000_min"] < 320]
    tmax = [x[3]["t1000_max"] for x in ss if 120 < x[3]["t1000_max"] < 320]
    p = [x[3]["p_avg"] for x in ss if 500 < x[3]["p_avg"] < 1100]
    if not t:
        continue
    out.append(dict(sol=sol, ls=round(ss[0][2], 2), n=len(ss), hours_covered=len(hours),
                    full_sol=len(hours) >= 22,
                    t_mean=round(sum(t) / len(t), 2), t_min=round(min(tmin), 2), t_max=round(max(tmax), 2),
                    t_range=round(max(tmax) - min(tmin), 2),
                    p_mean=round(sum(p) / len(p), 2) if p else ""))

with open(OUT, "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=list(out[0].keys()))
    w.writeheader(); w.writerows(out)

full = [o for o in out if o["full_sol"]]
print("sols total", len(out), "full-coverage sols", len(full), "sol range", out[0]["sol"], out[-1]["sol"])
def stat(k, rows):
    xs = [o[k] for o in rows]
    return f"{k}: min {min(xs):.1f} max {max(xs):.1f} mean {sum(xs)/len(xs):.1f}"
for k in ["t_mean", "t_min", "t_max", "t_range"]:
    print(stat(k, full))
ps = [o["p_mean"] for o in full if o["p_mean"] != ""]
print(f"p_mean: min {min(ps):.1f} max {max(ps):.1f}")
# early vs late mission
for lo, hi in [(0, 30), (60, 90), (120, 152)]:
    rows = [o for o in full if lo <= o["sol"] < hi]
    if rows:
        print(f"sols {lo}-{hi}:", stat("t_min", rows), "|", stat("t_max", rows), "| p", round(sum(o['p_mean'] for o in rows)/len(rows),1))
# hourly climatology (all samples) 1000mm
hb = defaultdict(list)
for sol, ltst, ls, r in samples:
    if 120 < r["t1000_avg"] < 320:
        hb[int(ltst)].append(r["t1000_avg"])
print("hourly mean T1000 (K):", {h: round(sum(v)/len(v), 1) for h, v in sorted(hb.items())})
# vertical gradient midday vs night
def grad(cond):
    d = [r["t250_avg"] - r["t1000_avg"] for sol, l, ls, r in samples if cond(l) and 120 < r["t250_avg"] < 320 and 120 < r["t1000_avg"] < 320]
    return round(sum(d)/len(d), 2)
print("T250-T1000 midday(11-15):", grad(lambda l: 11 <= l < 15), " night(0-4):", grad(lambda l: l < 4))
# hours below 273 K, below 250 K
allt = [r["t1000_max"] for _, _, _, r in samples if 120 < r["t1000_max"] < 320]
print("max ever T1000:", round(max(allt), 1), "K; samples with max>273K:", sum(1 for x in allt if x > 273))
