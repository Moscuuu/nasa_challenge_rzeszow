# ESA Permafrost_cci — context for agents

Purpose: everything an agent needs to use ESA Permafrost_cci in the Mars-analog pipeline (`docs/superpowers/specs/2026-11-14-mars-analog-data-pipeline-design.md`) without re-discovering it. Human-readable Polish summary: `analysis/permafrost_cci/PERMAFROST_CCI_podsumowanie.md`. Numbers below come from an analysis of v5.0 at 0.1° (2026-11-14).

## TL;DR

- **What:** modelled (CryoGrid, driven by MODIS LST + ERA5) annual permafrost maps. It covers 25–85°N plus ice-free Antarctica, 0.01° (~1 km), 1997–2023. It is **not** in-situ measurement.
- **Gives 3 of our 4 factors:**
  - temperature (ground T at 0/1/2/5/10 m),
  - permafrost (fraction and active layer thickness),
  - cracks only **indirectly**, through temperature thresholds.
- **No salt, no ground-ice content, no landforms.**
- **Best Phoenix-like ground on Earth is the Antarctic Dry Valleys:** GST ≈ −31 °C, ALT ≈ 0. In the Arctic the most Phoenix-like is **northern Ellesmere (~81.8°N, 77°W) and Peary Land, N Greenland (~83°N, 30°W)**, GST ≈ −20.5 °C. That is colder than Devon Island/Haughton (−16 °C).
- **Use as:** an extremity parameter (coldness), a matchable-ish parameter (ALT vs Mars ice-table depth), and a cracking-regime class.

## Access

- **Root (public, no login, plain HTTPS):** `https://dap.ceda.ac.uk/neodc/esacci/permafrost/data/`
- **File URL template (v5.0):**
  `{root}/{folder}/L4/area4/pp/v05.0/{region_dir}/{YYYY}/ESACCI-PERMAFROST-L4-{PROD}-{SRC}-{AREA}_PP-{YYYY}-fv05.0.nc`

  | placeholder | values |
  |---|---|
  | `folder` | `ground_temperature` (PROD=`GTD`), `active_layer_thickness` (`ALT`), `permafrost_extent` (`PFR`) |
  | `region_dir` / `AREA` | `northern_hemisphere` / `AREA4`; `Antarctica` / `AREA27` |
  | `SRC` | `ERA5_MODISLST_BIASCORRECTED` for 1997–2002, `MODISLST_CRYOGRID` for 2003–2023 |

- **Sizes per year:**

  | region | GTD | ALT | PFR |
  |---|---|---|---|
  | Northern Hemisphere | ~360 MB | ~31 MB | ~12 MB |
  | Antarctica | ~7 MB | ~1 MB | ~0.5 MB |

  CEDA served ~10 MB/s in testing.
- **Licence and citation:** each year folder's parent has `00README_catalogue_and_licence.txt` with the CEDA catalogue record and DOI. v5.0 PFR NH: `https://catalogue.ceda.ac.uk/uuid/d235665772ec4b558e9a89ac85595e71`. Cite per record. Older versions v01–v04 exist; v04 is NH-only and ends in 2021.
- **Docs:** Product User Guide `https://dap.ceda.ac.uk/neodc/esacci/permafrost/docs/`, ATBD on climate.esa.int.

## Data model and gotchas

| item | detail |
|---|---|
| Variables | GTD: `GST, T1m, T2m, T5m, T10m` (°C, annual mean). ALT: `ALT` (m, max seasonal thaw). PFR: `PFR` (%). Each has `*_uncertainty`. Dims `(time=1, lat, lon)`. |
| Grid | regular lat/lon 0.01°. NH: lat 25–85, 6000×36000. Antarctica: lat −85…−60, 2500×36000. |
| Storage | NH packed `uint16` with scale/offset (netCDF4/xarray auto-unpack). Antarctica `float64`. Unpacked, one NH variable is ~1.7 GB. **Read in latitude bands and aggregate**; never load a full variable. |
| NaN meaning | NaN = outside model domain (ocean, ice sheets, warm land far from permafrost). |
| Domain | GTD/PFR cover the same 24.5 M km² NH domain, **including non-permafrost land** (PFR=0 on 20 %, GST up to +10 °C). ALT is defined only where permafrost exists (16.9 M km²). |
| Gaps | No data north of 85°N. Greenland/Antarctic ice-sheet interiors excluded. Qaidam Basin (38°N, 93.5°E) is outside the domain. |
| Antarctica caveats | Mapped area 183 k km² is much larger than published ice-free-area estimates (~22–45 k km²), so the mask is generous. **ALT < 0.1 m on 99.96 %**, likely underestimated vs Dry Valleys field data (cm to tens of cm). Do not treat Antarctic ALT as a reliable ice-table depth. |
| Time | Annual only. **No seasonal or diurnal amplitude.** 1997–2002 use different input (ERA5-only). Compute trends from 2003 onward or flag the break. |
| Single-year noise | 2023 was a warm year. GST/cracking changes 2003→2023 are partly that one year; T10m and the multi-year PFR series are robust. |

## Key numbers (v5.0)

### Permafrost and active layer (NH)

- **Area 2023:** 12.5 M km² (Σ PFR × area). By year:

  | 1997 | 2003 | 2013 | 2023 |
  |---|---|---|---|
  | 13.6 | 14.1 | 13.3 | 12.5 M km² |

- **Trend 2003–2023:** −0.76 M km²/decade (−5.7 %/decade), p < 0.001.
- **Zones 2023:**

  | continuous ≥ 90 % | discontinuous 50–90 % | sporadic 10–50 % | isolated < 10 % |
  |---|---|---|---|
  | 7.9 | 4.6 | 4.4 | 3.4 M km² |

- **Active layer thickness 2023:** median 1.04 m (p5 0.33, p95 2.85). Mean 0.97 → 1.06 → 1.27 m (2003/2013/2023). Deepened on 90 % of the area.
- **ALT ≤ 0.18 m** (Phoenix ice depth 2–18 cm): only 0.27 M km² in the NH.

### Temperature (permafrost cells, PFR ≥ 50 %)

- **T10m:** NH median −3.3 °C (min −20.1). Antarctica median −22.6 °C (min −39.1).
- **NH classes by T10m:**

  | warm −2…0 | cool −5…−2 | cold −10…−5 | very cold −20…−10 | < −20 °C |
  |---|---|---|---|---|
  | 35 % | 25 % | 26 % | 11 % | 0 % |

  Antarctica: 61 % < −20 °C.
- **Warming 2003→2023, NH pixel-wise:** GST +2.2, T1m +1.6, T10m +1.0 °C. Area with T10m ≤ −5 °C fell from 5.8 to 4.6 M km².
- **Thermal offset:** NH T10m is on average 1.2 °C colder than GST, a recent-warming signature. Antarctica ≈ 0.
- **Mars context:** Earth's coldest annual ground is ≈ −40 °C (Antarctica). Phoenix air was −85…−28 °C. **Temperature is an extremity parameter, never a direct match.**

### Salt (derived; the dataset has no salinity)

- **NH permafrost that would be unfrozen at 10 m if pore water were saline:**

  | 1 % NaCl | 3.5 % (≈ seawater, −2.1 °C) | 10 % | 15 % |
  |---|---|---|---|
  | 16 % | **39 %** | 73 % | 92 % |

- **Coasts (~50 km band):** 2.4 M km² permafrost, of which 0.34 M km² (14 %) is salt-sensitive (T10m > −2.1 °C). Inland the share is 45 %, because Arctic coasts are colder.
- **Antarctica:** 57 % of permafrost is colder than the NaCl eutectic (−21 °C). CaCl₂ (−50 °C) brine is liquid everywhere. Consistent with **Don Juan Pond** (CCI GST −28 °C), a real never-freezing CaCl₂ pond: a good sanity check.
- **Perchlorate** (Phoenix 0.4–0.6 wt%, eutectic −67…−75 °C) would never freeze in Earth permafrost. A chemical analog needs actual perchlorate (Dry Valleys soils, Atacama).

### Cracks (regime inferred from GST)

- **Thresholds**, conservative because GST is 2–6 K warmer than air under snow:

  | regime | GST |
  |---|---|
  | relict/inactive ice wedges | −6…−2 °C |
  | active ice-wedge cracking | −20…−6 °C |
  | cold-dry contraction (sand wedges, Phoenix-like) | ≤ −20 °C |

  Sources: Péwé 1966; Romanovsky 1985.
- **2023 areas:**

  | regime | NH | Antarctica |
  |---|---|---|
  | relict | 3.45 M km² | 8 k km² |
  | active | 2.88 M km² | 57 k km² |
  | cold-dry | **59 km²** (N Ellesmere / N Greenland only) | **112 k km²** |

- **NH active + cold-dry area by year:** 4.95 (2003), 4.56 (2013), 2.88 (2023) M km². The 2023 drop is partly the warm year.
- **NH pattern:** 565 patches; largest 1.35 M km² (Yakutia ~70°N, 129°E); top 5 = 75 % of area. Power-law size tail α = 1.55 ± 0.04 above ~100 km². Moran's I 0.95 at 0.5°. Antarctic patches run N–S along the Transantarctic Mountains.

## Known-site values (10 km window median, 2023)

| site | kind | PFR | ALT m | GST °C | T10m °C | cracking regime | Phoenix-index pct |
|---|---|---|---|---|---|---|---|
| University Valley (−77.86, 160.72) | Mars analog | 100 | 0.0 | −30.9 | −30.1 | cold-dry | 100 |
| Beacon Valley (−77.83, 160.65) | Mars analog | 100 | 0.0 | −30.9 | −30.0 | cold-dry | 100 |
| Don Juan Pond (−77.56, 161.19) | Mars analog | 100 | 0.0 | −28.2 | −27.6 | cold-dry | 99 |
| Taylor Valley (−77.61, 163.15) | Mars analog | 100 | 0.0 | −23.5 | −22.5 | cold-dry | 98 |
| Axel Heiberg, Expedition Fd. (79.40, −90.80) | Mars analog | 100 | 0.2 | −16.7 | −15.8 | active | 96 |
| Haughton Crater (75.38, −89.68) | Mars analog | 100 | 0.3 | −15.7 | −15.4 | active | 93 |
| Eureka, Ellesmere (79.99, −85.93) | Mars analog | 100 | 0.4 | −15.9 | −15.6 | active | 92 |
| Utqiagvik (71.29, −156.79) | permafrost ref | 100 | 0.4 | −5.8 | −8.1 | relict | 81 |
| Duvanny Yar (68.63, 159.15) | permafrost ref | 100 | 0.6 | −6.0 | −6.1 | active | 79 |
| Bockfjorden, Svalbard (79.45, 13.33) | Mars analog | 100 | 0.5 | −1.8 | −2.9 | none | 76 |
| Beiluhe, Tibet (34.82, 92.92) | permafrost ref | 100 | 0.8 | −0.8 | −1.0 | none | 73 |
| Adventdalen, Svalbard (78.20, 15.85) | permafrost ref | 100 | 0.6 | −2.1 | −3.3 | relict | 70 |
| Tuktoyaktuk (69.44, −133.03) | permafrost ref | 100 | 0.7 | −3.3 | −5.8 | relict | 68 |
| Qaidam Basin (38.0, 93.5) | Mars analog | – | – | – | – | outside domain | – |

**Phoenix-likeness index** (heuristic, equal weights, 0–1) = mean of four components:
1. coldness percentile of −GST among permafrost cells,
2. shallow ice: 1 if ALT ≤ 0.18 m, else exp(−(ALT−0.18)/0.5),
3. PFR/100,
4. cracking: cold-dry 1, active 0.6, relict 0.2, none 0.

Known Mars analogs: median 97th percentile, 7 of 8 in the top 10 %. This is **not an independent validation**: known analogs are biased to polar sites, and the Antarctic ALT≈0 inflates scores. The top 2 % of cells are all Antarctic.

## How to use in the pipeline

- **Parameters to extract per 0.1° cell:** `PFR, ALT, GST, T1m, T10m` plus a land fraction (share of native 0.01° pixels with data, for coast-correct area weights). Aggregate with NaN-aware block means. Keep the uncertainty fields if weighting.
- **Spec mapping (§7.1):**
  - "Ice / permafrost" → `PFR` (presence) and `ALT` (proxy for ice-table depth; compare to Mars SWIM depth classes 0–1 / 1–5 / > 5 m and Phoenix 0.02–0.18 m);
  - "Mean surface temperature, cold-side" → `GST` as an extremity percentile;
  - cracking regime → a categorical feature linked to Mars polygon terrain.
- **Factor coverage:**

  | factor | coverage |
  |---|---|
  | temperature | ✔ |
  | permafrost | ✔ |
  | cracks | ~ (proxy only; pair with ArcticDEM/HiRISE-scale imagery for real polygons) |
  | salt | ✘ (pair with other sources; only freezing-point reasoning possible) |

- **Validation labels:** use the site table above. Expect Dry Valleys > Canadian High Arctic > Svalbard. Svalbard (Bockfjorden) is too warm for active cracking (GST −1.8 °C), so its analog value is geological/hydrothermal, not thermal.
- **Don't:**
  - treat CCI as measured borehole data;
  - compare Earth °C directly to Mars °C;
  - trust Antarctic ALT as an ice-table depth;
  - read single-year 2023 surface changes as a trend;
  - forget that NaN ≠ "no permafrost" (it means outside the domain; use PFR = 0 for "no permafrost").
