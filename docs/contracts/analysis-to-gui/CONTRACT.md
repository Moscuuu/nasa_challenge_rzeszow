# Kontrakt danych: analiza → GUI

Wersja kontraktu: **0.5** (2026-11-14). Status: **trzecia dostawa danych** w `out/`: wszystkie 3 warstwy i wszystkie 3 cechy (temperatura, lód gruntowy, spękania).

Zmiany w 0.5 (spękania):
- **`features.polygons`** w komórce: `{score, earth_value: {cracking_potential, ground_surface_temp_K}, mars_value: {swim_polygon_share}, unit, status, source}`. `status` = `ok`; `no_data`, gdy miejsce na Marsie nie ma pokrycia SWIM (Deuteronilus Mensae, Phlegra Montes, Utopia Planitia); `not_relevant` w `gt5m`.
- **Uwaga do wyświetlania:** po stronie Ziemi spękania są **szacowane z temperatury gruntu**, a nie zaobserwowane na zdjęciach. W GUI warto to napisać przy tej cesze („estimated from ground temperature”).
- **`mars_sites.geojson`**: `features.polygons` = `{value, rank, status, unit, source}`.
- **Uczciwość porównania między miejscami:** dla miejsc ze `status: "no_data"` wynik jest średnią z 2 cech, a nie z 3, bo brak danych pomijamy, a nie zerujemy. GUI powinno pokazać to przy wyniku, np. „2 of 3 features”.

Zmiany w 0.4:
- **Test metody osobno dla każdej warstwy:** `validation_<layer>.json` zamiast `validation.json`. W manifeście `files.validation` jest teraz obiektem `{layer: plik}`.
- **Temperatura w warstwach głębszych** to jedna wielkość: `t_1_5` (średnia roczna temperatura gruntu na 2 i 5 m) albo `t_gt5` (na 10 m). Klucze w `parts`, `earth_value` i `mars_value` wynikają z warstwy (np. `parts.t_1_5`, `earth_value.t_1_5_K`). GUI powinno iterować po kluczach, a nie zakładać ich listy.
- **`ground_ice.earth_value`**: pierwszy klucz zależy od warstwy: `shallow_ice_certainty` (0-1m), `frozen_1_5m_certainty` (1-5m), `permafrost_fraction` (gt5m).
- **`mars_sites.geojson`**: `ground_ice` ma wartości dla każdej warstwy (`{"0-1m": {value, rank}, "1-5m": …, "gt5m": …, unit, source}`), a `temperature` ma dodatkowo `t_1_5_K` i `t_gt5_K`.
- **Nowe pole `tied_site_ids`** w komórce: wszystkie miejsca na Marsie z wynikiem równym najlepszemu (±0,001). W warstwach głębszych remisy są częste, bo każde miejsce na Marsie jest zimniejsze niż jakikolwiek grunt na Ziemi, a kilka ma tę samą wartość SWIM. Jeśli lista ma więcej niż 1 element, GUI powinno pokazać wszystkie, a nie tylko `best_site_id`.
- `polygons.status` = `not_relevant` w `gt5m`.

Zmiany w 0.3: temperatura w warstwie `0-1m` ma 6 wielkości: `tmin`, `tmax`, `amp` (cały rok) i `summer_tmin`, `summer_tmax`, `summer_amp` (lokalne lato). Klucze w `parts`, `earth_value` i `mars_value` to odpowiednio `<wielkość>` i `<wielkość>_K`. W warstwach `1-5m` i `gt5m` temperatura będzie jedną średnią roczną.

Zmiany w 0.2: kształt cechy `temperature` (min/max/amplituda), `ground_ice` porównywany przez pozycję (`"comparison": "position"`), nowy `status: "pending"` (cecha jeszcze nie policzona), nowe pole `experiment_window` w komórce (§6.1), `coords_status` w miejscach na Marsie.

Ten dokument mówi zespołowi GUI, **jakie pliki dostanie od zespołu analizy i co w nich jest**. GUI można budować już teraz na przykładowych plikach z `examples/`. Prawdziwe dane będą miały ten sam kształt.

Pojęcia (Komórka, Kandydackie Miejsce Bazy, Warstwa gruntu, Znany analog itd.) są zdefiniowane w `GLOSSARY.md`. Teksty widoczne dla użytkownika aplikacji są **po angielsku**.

## 1. Co pokazujemy (w jednym zdaniu)

Każda **komórka** wiecznej zmarzliny na Ziemi (siatka 0,1°) dostaje ocenę 0–1: jak bardzo przypomina każde z **7 miejsc na bazę na Marsie**, osobno dla każdej z **3 cech** (temperatura, lód gruntowy, spękania), w wybranej **warstwie gruntu**. Komórek nie łączymy w regiony.

## 2. Pliki

Wszystkie pliki leżą w jednym folderze `out/`. Bez bazy danych, bez backendu: GUI czyta je jak statyczne pliki.

| plik | po co | rozmiar |
|---|---|---|
| `manifest.json` | **czytaj najpierw**: lista warstw, cech, miejsc na Marsie i plików; etykiety po angielsku | mały |
| `mars_sites.geojson` | 7 miejsc na bazę na Marsie (punkty) | mały |
| `cells_top_<layer>.geojson` | najlepsze komórki dla danej warstwy, z pełnym opisem (do klikania) | ~5 MB |
| `score_<layer>_<site_id>.png` | mapa cieplna wyniku dla całej Ziemi (do nałożenia na globus) | ~1 MB każda |
| `validation_<layer>.json` | wynik testu metody na znanych analogach i kontraście, osobno dla warstwy | mały |

`<layer>` ∈ `0-1m`, `1-5m`, `gt5m`. Od wersji 0.4 są wszystkie trzy. Które warstwy są gotowe, mówi `manifest.json` (`layers[].available`).

## 3. Konwencje

- Współrzędne: WGS84 dla Ziemi, planetocentryczne dla Marsa. **Długość geograficzna wschodnia dodatnia, zakres −180…180** na obu planetach, więc GUI nic nie przelicza.
- GeoJSON: kolejność `[lon, lat]`.
- Wyniki: liczby 0–1, gdzie **1 = najbardziej jak na Marsie**. Zaokrąglone do 3 miejsc po przecinku.
- **Brak danych to `null`, nigdy 0.** GUI musi pokazać to jako „no data”, a nie jako słaby wynik.
- Identyfikatory komórek: `c_<lat>_<lon>` ze środkiem komórki, np. `c_81.85_-77.05`.

## 4. `manifest.json`

```json
{
  "contract_version": "0.4",
  "generated_at": "2026-11-14T20:00:00Z",
  "mock": false,
  "cell_size_deg": 0.1,
  "layers": [
    {"id": "0-1m", "label": "0–1 m (dig-able ice)", "available": true},
    {"id": "1-5m", "label": "1–5 m (shallow drilling)", "available": true},
    {"id": "gt5m", "label": "> 5 m (deep resources)", "available": true}
  ],
  "features": [
    {"id": "temperature", "label": "Temperature", "comparison": "rank"},
    {"id": "ground_ice", "label": "Ground ice", "comparison": "position"},
    {"id": "polygons", "label": "Thermal-contraction polygons", "comparison": "presence"}
  ],
  "sites": ["arcadia_planitia", "deuteronilus_mensae", "..."],
  "files": {"mars_sites": "mars_sites.geojson", "cells_top": {"0-1m": "cells_top_0-1m.geojson"}, "score_maps": {"0-1m": {"arcadia_planitia": "score_0-1m_arcadia_planitia.png"}}, "validation": {"0-1m": "validation_0-1m.json", "1-5m": "validation_1-5m.json", "gt5m": "validation_gt5m.json"}},
  "sources": [{"id": "esa_cci_permafrost", "label": "ESA Permafrost CCI v5", "url": "https://climate.esa.int/en/projects/permafrost/"}]
}
```

Cechy w danej warstwie mogą nie mieć znaczenia (np. spękania w `gt5m`). Wtedy cecha ma w tej warstwie wagę 0 i wartość `null` z `"status": "not_relevant"`.

## 5. `mars_sites.geojson`

Jeden punkt (`Point`) na miejsce. Właściwości:

| pole | typ | opis |
|---|---|---|
| `id` | string | np. `arcadia_planitia` |
| `name` | string | po angielsku, np. `Arcadia Planitia` |
| `window_deg` | number | rozmiar okna wokół punktu (1,0) |
| `coords_status` | string | `approximate` (przybliżony środek obszaru) lub `published` |
| `features` | object | `temperature`: `{tmin_K, tmax_K, amp_K, summer_tmin_K, summer_tmax_K, summer_amp_K, unit, source}` (średnie dobowe minimum, maksimum, amplituda temperatury powierzchni: cały rok marsjański i lokalne lato); `ground_ice`: `{value, rank, unit, source}`, gdzie `value` = wskaźnik SWIM C, `rank` = pozycja na tle Marsa 0–1; `polygons`: `{..., status: "pending"}` |
| `chlorine_wt_pct` | number \| null | chlor z orbity (GRS); **tylko informacja**, nie wchodzi do oceny |
| `description` | string | 1–2 zdania po angielsku: dlaczego to miejsce jest kandydatem |
| `citation` | string | źródło propozycji miejsca |

## 6. `cells_top_<layer>.geojson`

Punkt (`Point`) w środku komórki. Komórka ma bok 0,1°, więc GUI może narysować kwadrat z `cell_size_deg`. Plik zawiera **najlepsze komórki** (patrz §9, punkt A). Właściwości jednej komórki:

| pole | typ | opis |
|---|---|---|
| `id` | string | `c_<lat>_<lon>` |
| `rank` | int | miejsce w rankingu całej Ziemi (1 = najlepsza) w tej warstwie |
| `percentile` | number | 0–100, pozycja wśród wszystkich komórek zmarzliny |
| `score` | number | wynik względem **najbliższego** miejsca na bazę (najwyższy z 7) |
| `best_site_id` | string | id najbliższego miejsca na Marsie |
| `tied_site_ids` | string[] | wszystkie miejsca z wynikiem równym najlepszemu (±0,001); zawiera też `best_site_id` |
| `site_scores` | object | `{site_id: score}` dla wszystkich 7 miejsc |
| `features` | object | dla każdej cechy względem `best_site_id`: `{score, earth_value, mars_value, unit, status, source}`; `status` ∈ `ok`, `no_data`, `not_relevant`, `pending`. `temperature` ma dodatkowo `parts: {tmin, tmax, amp, summer_tmin, summer_tmax, summer_amp}` (ocena każdej z 6 wielkości), a `earth_value`/`mars_value` to obiekty `{tmin_K, …, summer_amp_K}`. `ground_ice.earth_value` = `{shallow_ice_certainty, active_layer_m, permafrost_fraction}`, `mars_value` = `{swim_c}` |
| `strengths` | string[] | id cech z najwyższą oceną („co jest podobne”) |
| `breaks_down` | string[] | id cech z najniższą oceną („gdzie analogia się łamie”) |
| `known_analog` | string \| null | nazwa znanego analogu, jeśli komórka w nim leży, np. `McMurdo Dry Valleys` |
| `place` | string \| null | najbliższa nazwa geograficzna + kraj, np. `Peary Land, Greenland` (w 0.2 jeszcze `null`) |
| `experiment_window` | object \| null | okno eksperymentu dla każdego z 7 miejsc (§6.1) |

### 6.1 `experiment_window`

Kiedy temperatura powierzchni w komórce mieści się w typowym dobowym zakresie temperatur danego miejsca na Marsie (cały rok marsjański). **Tylko informacja**, nie zmienia wyniku.

```json
"experiment_window": {
  "arcadia_planitia": {"months": [6, 7, 8], "hours_local": [0, 1, 2, 3, 4, 13, 14], "hours_per_year": 412, "mars_range_K": [173.3, 246.6]},
  "...": {}
}
```

- `months`: miesiące (1–12), w których jest choć jedna godzina w zakresie,
- `hours_local`: godziny lokalnego czasu słonecznego (0–23), w których jest choć jeden miesiąc w zakresie,
- `hours_per_year`: łączna liczba godzin w roku w zakresie (0 = Ziemia tu nigdy nie jest tak zimna/ciepła jak to miejsce),
- źródło: ERA5-Land hourly 2023, klimatologia miesiąc × godzina.

Ocena ogólna = **zwykła średnia** cech ze statusem `ok` (równe wagi, braki pomijane). GUI tego nie liczy, wartość przychodzi gotowa w `score`.

## 7. `score_<layer>_<site_id>.png`

- Odwzorowanie walcowe równoodległościowe, **3600 × 1800 px** (0,1°/px), lewy górny róg = 180°W, 90°N. Pasuje wprost jako tekstura na `SphereGeometry` (`context/ui-setup-reference.md` §4.3).
- PNG RGBA w skali szarości: kanał R = `score × 255`, **alfa = 0 tam, gdzie nie ma zmarzliny lub danych**. Kolory nakłada GUI.

## 8. `validation_<layer>.json`

Pokazuje, czy metoda działa: znane analogi powinny wypaść wysoko, kontrast (mokra tundra) nisko. Kontrast ma sens tylko w `0-1m`: poniżej warstwy czynnej mokra tundra to zwykły zimny, zamarznięty grunt. Każdy test ma pole `applicable` (bool). W warstwach głębszych kontrast ma `applicable: false`: wynik jest podany, ale GUI nie powinno go pokazywać jako porażki metody.

Zasada `passed`: znany analog zalicza, gdy mediana jego komórek leży w **najlepszych 10 %** komórek zmarzliny (`median_percentile ≥ 90`). Kontrast zalicza, gdy leży **poniżej mediany** (`median_percentile < 50`).

```json
{
  "layer": "0-1m",
  "checks": [
    {"name": "McMurdo Dry Valleys", "role": "known_analog", "median_percentile": 99.1, "passed": true},
    {"name": "Devon Island (Haughton)", "role": "known_analog", "median_percentile": 93.0, "passed": true},
    {"name": "Alaska North Slope", "role": "contrast", "median_percentile": 41.0, "passed": true}
  ],
  "weights": {"temperature": 0.5, "ground_ice": 0.5, "polygons": 0.0},
  "notes": "Polygons not yet included."
}
```

## 9. Otwarte punkty (mogą zmienić kontrakt)

- ~~A. Ile komórek trafia do `cells_top`?~~ **Ustalone:** 2000 najlepszych na warstwę.
- ~~B. Mapy cieplne PNG.~~ **Ustalone:** 8 map na warstwę: po jednej na każde miejsce na Marsie (`score_<layer>_<site_id>.png`) + `score_<layer>_best.png` (najlepszy z 7 wyników). Po kliknięciu miejsca na Marsie GUI podmienia teksturę globusa na mapę tego miejsca.
- **C. Dokładne współrzędne 7 miejsc na Marsie.** W `examples/` są przybliżone.

## 10. Kolejność dostaw

1. **Teraz:** pliki przykładowe w `examples/` (`"mock": true`): dane zmyślone, kształt prawdziwy.
2. **Pierwsza dostawa:** warstwa `0-1m`, cechy temperatura + lód gruntowy, `validation.json`.
3. **Kolejne:** warstwy `1-5m` i `gt5m`, na końcu spękania.

Każda zmiana kształtu danych podnosi `contract_version`.
