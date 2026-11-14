# SWIM (Mars Subsurface Water Ice Mapping) — context for agents

Purpose: everything an agent needs to use SWIM as the **Mars side** of the analog pipeline (`docs/superpowers/specs/2026-11-14-mars-analog-data-pipeline-design.md`) without re-discovering it. Human-readable Polish summary: `analysis/swim/SWIM_podsumowanie.md`. Earth-side counterpart: `context/permafrost_cci_for_agents.md`. Numbers below come from an analysis at 0.25° (2026-11-14).

## TL;DR

- **What:** NASA/JPL project run by the Planetary Science Institute that maps **buried water ice on Mars, 60°S–60°N**. GeoTIFFs on a 0.05° (~3 km) grid. Public at `https://swim.psi.edu`.
- **Pixel value = ice consistency C ∈ [−1, +1]:**
  - +1: data consistent with buried ice,
  - 0: ambiguous or no data,
  - −1: data inconsistent with ice.

  **It is not an ice amount and not a probability.**
- **Three depth layers:** 0–1 m, 1–5 m, > 5 m. They map naturally onto Earth active-layer and permafrost depths.
- **Gives 2 of our 4 factors directly:**
  - permafrost/ground ice: composites plus neutron, radar and thermal inputs;
  - cracks: a polygonal-terrain landform map, but only to ±49°.
- **Temperature** comes only as a thermal-*consistency* class (no temperatures). **Salt is absent.** We supplemented both (see below).
- **Best use:** a per-site Mars feature vector. For each Mars reference site, sample C_i at 3 depths, polygon occurrence, latitude, and the GRS chlorine value. Compare those with Earth cells from Permafrost_cci.

## Access

- **Directory listings are open (Apache index)** under `https://swim.psi.edu/output/`. The web page download buttons are GET forms that redirect to a zip; direct file URLs are simpler.
- **Cloudflare blocks the default Python user agent (HTTP 403).** Send a browser-like `User-Agent`. Downloads sometimes drop mid-file, so resume with HTTP `Range`.
- **Files (≈ 1.4 GB for everything useful):**

  | product | path under `/output/` | size |
  |---|---|---|
  | C_i 0–1 m (SWIM4MIM, newest) | `SWIM4MIM/Global/Composite/SWIM4MIM_Ci_0_1.tif` | 68 MB |
  | C_i 1–5 m | `SWIM4MIM/Global/Composite/SWIM4MIM_Ci_1_5.tif` | 68 MB |
  | C_i > 5 m | `SWIM4MIM/Global/Composite/SWIM4MIM_Ci_5.tif` | 68 MB |
  | C_i, original SWIM 1.0 equation | `SWIM4MIM/Global/Composite/SWIM4MIM_OriginalCi.tif` | 68 MB |
  | Geomorphology 0–1 / 1–5 / > 5 m | `SWIM4MIM/Global/Datasets/SWIM4MIM_G_{0_1,1_5,5}.tif` | 68 MB each |
  | **10 landform maps** (incl. polygons) | zip `SWIM4MIM/Global/Datasets/SWIM4MIM_G_0_1_Ancillary.zip` | 2 MB zip → 10 × 70 MB tif |
  | Reconnaissance Zones (shapefile) | zip `SWIM4MIM/Global/Datasets/SWIM4MIM_RZ_Ancillary.zip` | 0.1 MB |
  | Neutron (Odyssey NS) | `SWIM2/Global/Datasets/SWIM2_N.tif` | 68 MB |
  | Thermal (TES/THEMIS) | `SWIM2/Global/Datasets/SWIM2_T.tif` | 68 MB |
  | Radar surface power (SHARAD) | `SWIM2/Global/Datasets/SWIM2_RS.tif` | 135 MB |
  | Radar dielectric (SHARAD) | `SWIM2/Global/Datasets/SWIM2_RD.tif` | 135 MB |

  - `*_Browse.png` and `*_Browse.tif` files are labelled previews, not data.
  - `NorthernHemisphere/` holds the older SWIM 1.0 north-only products, including a reflector `Northern_Depth.tif`.
- **Citation:** Morgan, Putzig et al. 2025, *PSJ* 6:29, doi:10.3847/PSJ/ad9b24 (SWIM4MIM). Putzig, Morgan et al. 2023 (SWIM 2.0). Morgan et al. 2021, *Nature Astronomy* (SWIM 1.0).

## Data model and gotchas

| item | detail |
|---|---|
| Grid | 7200 × 2400, 0.05°, Mars 2000 sphere (R = 3396.19 km), equirectangular, centre meridian 0. Coordinates in **metres** (divide by π·R/180 for degrees). Longitude −180…180 °E (Phoenix 234.3°E = −125.7°). Lat −60…60. |
| Nodata | `−30` in composites. RS/RD are **float64 with −1.8·10³⁰⁸ fill**: mask *before* casting to float32 or it overflows. Landform maps use −3.4·10³⁸. |
| Value classes | Many layers are quantised (radar surface power has only 95 distinct values). Neutron: −1…+1 continuous from WEH. **Thermal has only 0…+1** (no "inconsistent" class published). Radar dielectric is 98.5 % zeros (= no coverage). |
| Landform maps | Value = share of survey images showing the landform (k/n), occasionally > 1 where surveys overlap; clip to [0, 1]. **Polygons are mapped only between ≈ 47.9°S and 49.0°N**: poleward rows are filled with **0 = not surveyed, not "absent"**. Treat cells poleward of the last detection as NaN, or polygons will look anti-correlated with ice. |
| Landform weights | Weights in the 0–1 m geomorphology equation (READ_ME in the zip): polygons 1.0; scalloped, glacier, pedestal 0.75; mantle, textured, expanded/ring-mold/terraced craters, fill 0.1. |
| Survey artefacts | Polygon map has circular survey footprints. Small polygon patches follow **N–S CTX image strips**, so orientation statistics must be area-weighted. |
| Resolution | 3 km pixels cannot resolve individual cracks (Phoenix polygons are 2.5–6 m). Crack geometry needs HiRISE (0.25 m/px). |

## Key numbers

### Overall consistency (area-weighted, 60°S–60°N)

| layer | mean | % > 0.5 | % > 0 | % < 0 |
|---|---|---|---|---|
| C_i 0–1 m | 0.05 | 8.1 | 49.7 | 48.5 |
| C_i 1–5 m | 0.12 | 4.5 | 57.0 | 25.5 |
| C_i > 5 m | 0.13 | 1.0 | 30.6 | 0.2 |
| Neutron | −0.30 | 9.4 | 30.4 | 69.6 |
| Thermal | 0.07 | 4.8 | 18.8 | 0.0 |
| Radar surface | 0.00 | 0.3 | 41.6 | 33.8 |
| Geomorphology 0–1 m | 0.28 | 27.3 | 35.4 | 0.0 |

### Permafrost (buried ice)

- **Strongly ice-consistent area (C_i > 0.5):**

  | depth | area | N hemisphere | S hemisphere |
  |---|---|---|---|
  | 0–1 m | **10.1 M km²** | 10.7 % | 5.4 % |
  | 1–5 m | 5.7 M km² | 7.2 % | 1.8 % |
  | > 5 m | 1.3 M km² | 2.0 % | 0.0 % |

  Ice is much closer to the equator in the north.
- **Equatorward boundary** (lowest latitude from which ≥ 50 % of every band poleward exceeds the threshold):

  | threshold | 0–1 m | 1–5 m | > 5 m |
  |---|---|---|---|
  | C_i > 0.5 | 52.5°N (42.5–58.5°N by 30° sector) | not reached | not reached |
  | C_i > 0 | 29.5°N / 35.5°S | 24.5°N / 28.5°S | 31.5°N / 37.5°S |

- **Vertical pattern:**
  - all three layers ice-consistent: 28 %;
  - none: 34 %;
  - only 1–5 m, i.e. ice under a dry cover: 14 %;
  - 0–1 and 1–5 m: 12 %;
  - only 0–1 m: 9 %.
- **Instruments agree weakly:** pairwise r = −0.15…0.32. Each senses a different depth and property, so never use a single input as "the" ice map.
- **Reconnaissance Zones:** 5 polygons, 15 M km². Mean C_i at 1–5 m is 0.28 inside vs 0.21 outside at 25–55° latitude.

### Temperature (derived; SWIM has no temperatures)

- **1-D regolith model** (albedo 0.25, thermal inertia 250 SI, CO₂ frost with latent heat): equator mean 224 K, peak 296 K; minimum 148 K (CO₂ frost).
- **Present-day ground-ice stability:** poleward of 65° at 0.5 m depth and 57°N / 55°S at 1 m.
- SWIM ice equatorward of this is out of equilibrium: relic ice from higher obliquity, or locally favoured.
- Colder ground is more ice-consistent: Spearman ρ(T_mean, C_i 0–1 m) = −0.63. Mean C_i exceeds 0.5 only below ≈ 190 K.

### Salt (supplement: Mars Odyssey GRS chlorine, PDS `ODY-M-GRS-5-ELEMENTS-V1.0`, 5° bins)

- **Chlorine** averages 0.49 wt% (range 0.22–0.80). The maximum is equatorial near 180°E (Medusae Fossae).
- **Less chlorine where there is ice:** 0.39 wt% where C_i > 0.5, against 0.50 wt% where C_i < 0.
- **Chlorine vs GRS H₂O:** r = 0.48, or 0.37 with latitude removed.
- **"Brine window"** (ice × Cl × time above the perchlorate eutectic) peaks at ≈ 42.5°N in Arcadia Planitia (150–160°W).

### Cracks (polygonal terrain, within the ±49° mapped band)

- **Extent:** 15.6 M km², = 62 % of the surveyed area. Present from ≈ 27° latitude in both hemispheres.
- **Patches:** 47; the top 5 hold 82 % of the area. Power-law size tail α = 1.39 ± 0.06. 90 % of the area-weighted extent is elongated E–W (latitude/climate control).
- **Controls:** where C_i 0–1 m > 0.6, practically all surveyed ground is cracked, vs ~37 % where C_i < 0 (Spearman 0.50). Modelled thermal-stress/strength ratio vs zonal crack fraction: ρ = 0.77.
- **Co-occurring landforms where polygons occur:** latitude-dependent mantle 69 %, textured terrain 62 %.
- **HiRISE crack-network test** at the Phoenix site (PSP_001880_2485) was **unreliable**: subtle troughs, one-sided lighting, seams. Do not use those numbers.

## Phoenix reference (Mars ground truth)

68.22°N, 234.3°E:
- ice table 2–18 cm (mean 4.6 cm),
- air −85…−28 °C,
- polygons 2.5–6 m,
- perchlorate 0.4–0.6 wt%.

Phoenix lies **north of SWIM's 60°N edge**, so it cannot be sampled from SWIM rasters; use these literature values (see `analysis/phoenix/`).

## How to use in the pipeline

- **Mars site features** (spec §7.3), sampled over a site-sized window:
  - median C_i at 0–1, 1–5 and > 5 m;
  - neutron, thermal and radar surface values;
  - polygon occurrence (NaN outside ±49°);
  - nearest GRS Cl.
- **Pairing with Earth (Permafrost_cci):**

  | Mars (SWIM) | Earth (Permafrost_cci) |
  |---|---|
  | C_i 0–1 m | PFR plus shallow ALT |
  | depth of first ice-consistent layer | ALT |
  | polygon occurrence | cracking regime from GST |
  | thermal consistency | GST/T1m, extremity percentile only |

- **Factor coverage:**

  | factor | coverage |
  |---|---|
  | permafrost | ✔ |
  | cracks | ✔ (coarse, ±49° only) |
  | temperature | ~ (class, or derived model) |
  | salt | ✘ in SWIM, ✔ via GRS Cl |

- **Don't:**
  - read C_i as ice amount or probability;
  - average C_i across depths without saying so;
  - treat zeros as "no ice" (often "no data");
  - use polygon zeros poleward of ±49°;
  - compare Mars kelvin with Earth °C directly;
  - sample Phoenix from SWIM (outside coverage).
