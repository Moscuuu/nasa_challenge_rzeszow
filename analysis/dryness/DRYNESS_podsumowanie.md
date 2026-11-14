# Suchość (opady + zieleń) — podsumowanie

Data: 2026-11-14
Cel: odrzucić „mokrą tundrę”. Analog Phoenix ma być zimny, **suchy** i **goły**.

## Skąd dane

| warstwa | zbiór (Google Earth Engine) | co to | lata |
|---|---|---|---|
| `precip_mm_yr` | ECMWF/ERA5_LAND/MONTHLY_AGGR, `total_precipitation_sum` | średni roczny opad (deszcz + śnieg), mm | 2014–2023 |
| `ndvi_max` | MODIS/061/MOD13A3 (NASA), `NDVI` | jak bardzo zielono w szczycie lata (mediana z rocznych maksimów) | 2014–2023 |

Siatka 0,1°, taka sama jak w `ggd318_analyze.py` (środki komórek −179,95…179,95).

## Ocena 0–1

- `s_precip` = 1 − percentyl opadu wśród lądu Ziemi (najsuchsze = 1)
- `s_ndvi` = 1 − percentyl NDVI (najbardziej gołe = 1)
- `s_dry` = średnia geometryczna obu; gdy brak NDVI (Antarktyda), tylko `s_precip`

## Wyniki dla regionów (mediana)

| region | opad mm/rok | NDVI | `s_dry` |
|---|---|---|---|
| atacama_yungay | 43 | 0,10 | **0,90** |
| north_ellesmere (kandydat) | 143 | 0,04 | **0,84** |
| dry_valleys (znany analog) | 76 | brak | **0,83** |
| peary_land (kandydat) | 185 | 0,10 | 0,80 |
| ojos_del_salado | 229 | 0,08 | 0,79 |
| axel_heiberg | 257 | 0,14 | 0,74 |
| devon_island_haughton (znany analog) | 265 | 0,18 | 0,73 |
| qiangtang | 446 | 0,13 | 0,66 |
| **alaska_north_slope (mokra tundra)** | 307 | **0,59** | **0,60** |
| svalbard_bockfjord | 669 | 0,10 | 0,57 |

- **Mokra tundra wypada nisko**, głównie przez zieleń (NDVI 0,59 przy ~0,1 w miejscach marsjańskich). Działa.
- Nowi kandydaci (północna Ellesmere, Ziemia Peary’ego) są suchsi niż znany analog Devon.

## Ograniczenia

- **ERA5 zawyża opady w górach** (np. Tybet: 446 mm, pomiary naziemne zwykle 150–300 mm). Patrzymy na ranking, nie na milimetry.
- **MODIS nie daje NDVI dla Antarktydy** (brak danych < ~55°S). Tam ocena tylko z opadu.
- Lądolody (wnętrze Grenlandii i Antarktydy) też wypadają jako „suche”. Odsiewa je dopiero warstwa zmarzliny (CCI: tylko grunt wolny od lodu).
- Percentyle liczone są względem całego lądu Ziemi, więc ocena 0,6 dla Alaski znaczy „suchsza niż połowa świata”, a nie „sucha”.

## Pliki

- skrypt: `analysis/dryness/dryness_fetch.py` (`python analysis/dryness/dryness_fetch.py`, ~15 min; `--from-cache` przelicza bez EE)
- wyniki (`data/dryness/`, poza gitem): `dryness_grid_0p1deg.csv.gz`, `regions.csv`, `map_dryness.png`, `raw_*.npy`
- logowanie do EE: `scripts/ee_init.py` (klucz konta serwisowego w `~/.config/analog-finder/`, poza repo)
