"""Ground-ice CONTENT (amount) for the deeper Depth Layers, from NSIDC GGD318 (Brown et al. 2002).

GGD318 gives visible ground-ice content in the upper 10-20 m as low / medium / high (ordinal 1-3, the
% ranges differ between lowlands and mountains, so no midpoints are invented). Northern hemisphere only
(>= ~20 N): Antarctica has no value.

Input: the 0.1 deg grid made by the team's GGD318 analysis
    python analysis/nsidc_ggd318/ggd318_fetch.py --out data/nsidc_ggd318      (needs NASA Earthdata login)
    python analysis/nsidc_ggd318/ggd318_analyze.py --data data/nsidc_ggd318 --out data/nsidc_ggd318/out --no-plot
Output: data/interim/ice_content.npz with `content` (1800 x 3600, ice_ord / 3, NaN where not mapped)

score.py uses it when present: Earth ice indicator for 1-5 m and > 5 m = CCI frozen certainty x content.
A cell without content counts as missing ground-ice data and, by the team rule, scores 0 for ice.

Usage: python -I pipeline/ice_content.py data/nsidc_ggd318/out/grid_0p1deg.csv.gz data/interim/ice_content.npz
"""
import sys
from pathlib import Path

import numpy as np
import pandas as pd

NX, NY, RES = 3600, 1800, 0.1


def main(grid_csv: Path, out: Path) -> None:
    g = pd.read_csv(grid_csv)
    g = g[g["ice_ord"].notna()]
    rows = np.floor((90 - g["lat"].to_numpy()) / RES).astype(int)
    cols = np.floor((g["lon"].to_numpy() + 180) / RES).astype(int)
    content = np.full((NY, NX), np.nan, dtype=np.float32)
    content[rows, cols] = g["ice_ord"].to_numpy() / 3.0
    np.savez_compressed(out, content=content)
    print("saved", out, "cells with ice content", int(np.isfinite(content).sum()))


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]))
