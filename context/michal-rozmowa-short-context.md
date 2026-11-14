# Michał — Context (Earth ↔ Mars Analogs)

## Core idea

Find places on Earth that match places on Mars on several factors at once (one factor alone means little). Then use the matching Earth site as a test ground: ISRU, landing site choice, validating ice models.

---

## The 4 factors

| #   | Factor                                               | Phoenix reference value                                                                          |
| --- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 1   | **Cracks / patterns** (thermal-contraction polygons) | Polygon diameter 2.5–6 m (median 4.6 m), second system ~20–25 m, troughs ~17 cm deep, slope < 7° |
| 2   | **Salt**                                             | Perchlorate 0.4–0.6 wt%, pH 7.7, Mg²⁺/Na⁺, CaCO₃ 3–5 wt%                                         |
| 3   | **Temperature**                                      | Air at 1 m: min −85 °C, max −28 °C, daily range 57 K, never above 0 °C (summer only)             |
| 4   | **Permafrost / ground ice**                          | Ice 2–18 cm deep (mean 4.6 cm), ice-cemented soil under a dry layer                              |

---

## Chosen datasets

| Dataset                                                            | Body                     | What it gives                                                                               | Factor     |
| ------------------------------------------------------------------ | ------------------------ | ------------------------------------------------------------------------------------------- | ---------- |
| **SMAP** (NASA Soil Moisture Active Passive)                       | Earth                    | Soil moisture (top ~5 cm) and freeze/thaw state, ~9–36 km                                   | 3, 4       |
| **ABoVE** (NASA Arctic-Boreal Vulnerability Experiment, ORNL DAAC) | Earth (Alaska, W Canada) | Active layer thickness, ground ice, airborne radar/lidar/imagery of permafrost and polygons | 1, 4       |
| **NSIDC** (National Snow and Ice Data Center)                      | Earth                    | Archive: permafrost extent maps, CALM active layer data, also hosts SMAP                    | 4          |
| **ESA Permafrost_cci**                                             | Earth                    | Ground temperature by depth, active layer thickness, permafrost extent (~1 km, NetCDF)      | 3, 4       |
| **SWIM** (Mars Subsurface Water Ice Mapping)                       | Mars                     | Ice consistency index and depth to ice (neutron + radar + thermal), GeoTIFF                 | 4          |
| **Phoenix lander** (PDS)                                           | Mars                     | MET temperatures (processed already), WCL salts, TEGA/RA ground ice, SSI/HiRISE polygons    | 1, 2, 3, 4 |

---

## Pairing logic (Earth ↔ Mars)

| Factor                  | Earth source                              | Mars source          |
| ----------------------- | ----------------------------------------- | -------------------- |
| Cracks / patterns       | ABoVE imagery                             | Phoenix SSI + HiRISE |
| Salt                    | —                                         | Phoenix WCL / TEGA   |
| Temperature             | Permafrost_cci (ground), SMAP freeze/thaw | Phoenix MET          |
| Permafrost / ground ice | Permafrost_cci, NSIDC, ABoVE, SMAP        | SWIM, Phoenix        |

---

## Gaps and gotchas

- **Salt, Earth side:** no dataset chosen yet. Perchlorate at Mars-like levels occurs naturally only in the Atacama and the Antarctic Dry Valleys.
- **Polygons:** Phoenix's 3–6 m polygons are invisible in 10 m (Sentinel-2) and 30 m (Landsat) imagery. They need sub-metre imagery or a ~2 m DEM (ArcticDEM/REMA). ABoVE only covers Alaska and W Canada.
- **Temperature mismatch:** Phoenix MET measures air at 1 m, while Earth products measure ground or surface temperature. Compare derived values instead (daily range, freeze/thaw count, % of hours below 0 °C) or use THEMIS/TES or the Mars Climate Database for Mars surface temperature.
- **Phoenix gives single points, not maps.** Use SWIM for regional Mars ice.
- **Phoenix has no winter data** (152 sols, late spring to summer).
- **Wet-tundra trap:** ABoVE and SMAP mostly cover thawing boreal and tundra permafrost, which is the wrong analog type. Use them to filter **for** thin active layers and dryness.
