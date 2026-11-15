# Kontrakt danych: analiza → GUI

Wersja kontraktu: **0.9** (2026-11-15). Stan obowiązujący; metoda: `docs/superpowers/specs/2026-11-15-drilling-analog-design.md`.

## Zmiany w 0.9 (dla zespołu GUI)

GUI **nie było zmieniane** razem z danymi. Do zrobienia po stronie GUI:

| zmiana | co zrobić |
|---|---|
| Cechy: `temperature`, `ground_ice`, `dryness`, **`bare_ground`** (nowa). **`polygons` nie ma** w komórkach ani w `manifest.features`. | dodać `bare_ground` do listy cech; nie zakładać `polygons` |
| `temperature` to teraz jedna wielkość: letnie maksimum dobowe (`summer_tmax_K`), porównane w kelwinach. Nie ma `parts`. | nie zakładać `parts` |
| `manifest.features[].comparison` ∈ `direct`, `monotone`, `rank` | typ |
| Cecha nieużywana w typie regionu ma `status: "not_relevant"`, `score: null`, ale **ma wartości** | pokazać wartości, bez paska |
| Nowe pola komórki: `region_type`, `type_rank`, `type_percentile`, `stability`, `area_id`, `ground_temperature_source` | pokazać typ, miejsce w typie i odporność |
| `rank` i `percentile` liczone **wśród komórek po filtrach** (nie wśród całej zmarzliny). Między typami nie są porównywalne (różne zestawy cech). | tekst „better than X % of permafrost" → „of candidate cells"; listy osobno dla typu |
| `site_scores[site]` = `null`, gdy miejsce nie ma lodu SWIM w tej warstwie (`manifest.layer_sites`). Mapa takiego miejsca jest pusta. | obsłużyć pustą listę i mapę |
| Nowy plik `areas_<layer>.geojson` | lista obszarów zamiast listy komórek |
| `cells_top`: do 1000 komórek **na typ regionu** (było 2000 łącznie) | |
| Mapy PNG: alfa = 0 także dla komórek, które nie przeszły filtrów | |
| `validation`: nowe pola `kind`, `cells_scored`, `cold_only_percentile`; 15 testów; `weights` puste | pokazać „samo zimno" obok |
| Brak statusu `no_data_penalized` | |
| `mars_sites.geojson` → `properties.surface` (albedo, bezwładność cieplna, źródła, osobno dla każdego miejsca); zmiana addytywna | nic nie trzeba zmieniać w GUI |
| `polygon_checks.json` nie jest już generowany (stary plik w `out/` jest nieaktualny) | |

## 1. Co pokazujemy

Każda **komórka** zmarzliny (0,1°), która przeszła filtry, dostaje ocenę 0–1: na ile nadaje się do testów wiercenia w lodzie takim jak w każdym z **7 miejsc na bazę na Marsie**, w wybranej **warstwie gruntu**. Komórki są rankowane w obrębie **typu regionu** i grupowane w **obszary**.

## 2. Pliki

Wszystkie w `out/`, statyczne.

| plik | po co |
|---|---|
| `manifest.json` | czytaj najpierw: warstwy, cechy, typy regionów, filtry, miejsca, pliki |
| `mars_sites.geojson` | 7 miejsc na Marsie (bez zmian; `polygons` to tylko kontekst) |
| `cells_top_<layer>.geojson` | najlepsze komórki każdego typu, z pełnym opisem |
| `areas_<layer>.geojson` | obszary: grupy komórek do 5 × 5 |
| `score_<layer>_<site_id>.png`, `score_<layer>_best.png` | mapy oceny, 3600 × 1800, R = ocena × 255, alfa 0 = brak oceny |
| `validation_<layer>.json` | test metody |

`<layer>` ∈ `0-1m`, `1-5m`, `gt5m`.

## 3. Konwencje

- WGS84 / planetocentryczne; długość wschodnia dodatnia, −180…180; GeoJSON `[lon, lat]`.
- Oceny 0–1, 3 miejsca po przecinku. **Brak danych to `null`, nigdy 0.**
- Id komórki: `c_<lat>_<lon>`; id obszaru: `a_<layer>_<n>`.

## 4. `manifest.json` (pola nowe w 0.9)

| pole | opis |
|---|---|
| `features[]` | `{id, label, comparison}`; 4 cechy |
| `region_types[]` | `{id, label, features[], caveats[]}`; `id` ∈ `northern`, `antarctic`, `pzi_only`; `features` = cechy, na których typ jest rankowany; `caveats` = zastrzeżenia do pokazania przy typie |
| `filters` | progi: `ground_temperature_max_K`, `active_layer_max_m`, `snow_free_summer_min`, `ice_fraction_max` |
| `robustness` | `{variants, meaning}` |
| `layer_sites` | `{layer: [site_id]}`: miejsca z lodem SWIM w warstwie |
| `files.areas` | `{layer: plik}` |

## 5. `cells_top_<layer>.geojson`

| pole | typ | opis |
|---|---|---|
| `id` | string | |
| `rank`, `percentile` | int, 0–100 | wśród wszystkich ocenionych komórek (do mapy); nieporównywalne między typami |
| `region_type` | string | typ regionu |
| `type_rank`, `type_percentile` | int, 0–100 | miejsce w typie; **to jest ranking do pokazania** |
| `stability` | 0–1 | udział wariantów, w których komórka jest w najlepszych 10 % typu |
| `area_id` | string | obszar, do którego należy |
| `score` | number | ocena względem najlepszego miejsca na Marsie |
| `best_site_id`, `tied_site_ids`, `site_scores` | | jak dotąd; remisy są regułą (miejsca różni tylko letnia temperatura) |
| `ground_temperature_source` | string | `esa_cci_permafrost` albo `pzi` (powietrze + 2 K, założenie) |
| `features` | object | 4 bloki `{score, earth_value, mars_value, unit, status, source}`; `dryness` ma też `parts` |
| `strengths`, `breaks_down`, `known_analog`, `place`, `experiment_window` | | jak dotąd |

Wartości w blokach cech:

| cecha | `earth_value` | `mars_value` |
|---|---|---|
| `temperature` | `summer_tmax_K` | `summer_tmax_K` |
| `ground_ice` | `active_layer_m`, `ground_temperature_K` | `swim_c` (kontekst, nieporównywane) |
| `dryness` | `precip_mm_yr`, `wet_summer` | oba 0 |
| `bare_ground` | `snow_free_summer` | 1 |

## 6. `areas_<layer>.geojson`

Punkt w najlepszej komórce obszaru. Posortowane malejąco po `score_best`.

| pole | opis |
|---|---|
| `id`, `region_type` | |
| `cells`, `cell_ids` | liczba i id komórek (od najlepszej) |
| `best_cell_id`, `place`, `bbox` | proponowany punkt, nazwa, ramka `[lon0, lat0, lon1, lat1]` |
| `score_best`, `score_mean`, `type_rank_best`, `stability_mean` | |
| `best_site_id`, `known_analog` | |

## 7. `validation_<layer>.json`

`checks[]`: `{name, role, kind, bbox, cells, cells_scored, median_percentile, cold_only_percentile, passed, applicable}`.

- `kind`: `box` albo `point` (punkt = 3 × 3 komórki).
- Znany analog zalicza przy medianie ≥ 90 wśród swoich ocenionych komórek. Kontrast zalicza przy medianie < 50 po wszystkich komórkach; komórka, która nie przeszła filtrów, liczy się jako 0.
- `cold_only_percentile`: ten sam test dla oceny „samo zimno". Jeśli jest równie wysoki, cechy nic tu nie dodają.
- `cells`: `{permafrost, pass_filters, scored}`; `feature_correlation`: Spearman między wielkościami.

## 8. `experiment_window`

Bez zmian: `{site_id: {months, hours_local, hours_per_year, mars_range_K}}`, tylko informacja.
