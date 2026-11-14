# SMAP L4 — podsumowanie zbioru danych (status: dane w trakcie pobierania)

Data: 2026-11-14
Zakres: NASA SMAP (Soil Moisture Active Passive), produkt **L4 SPL4SMGP v8**. Ocena pod kątem naszych parametrów: **temperatura** i **zmarzlina**, plus filtr **suchości** (odrzucenie mokrej tundry).

> **Status:** skrypty gotowe i przetestowane na danych syntetycznych. Zadania pobrania wysłane do NASA AppEEARS 2026-11-14 (~13:53 UTC), na razie w kolejce (`pending`). Sekcja 5 (wyniki) do uzupełnienia po pobraniu.

## TL;DR

- SMAP to **jedyny zbiór w naszym zestawie, który daje dla Ziemi temperaturę gruntu na kilku głębokościach, wilgotność gleby i opady w jednej spójnej siatce**, co 3 godziny, globalnie, od 2015 r.
- Szukamy nie po prostu „zimnych miejsc”, tylko miejsc **zimnych latem, suchych i z płytką trwałą zmarzliną**. Samo zimno daje złe analogi (Syberia: −50 °C zimą, ale +30 °C latem; mokra tundra; lądolody).
- Z SMAP liczymy dla każdego piksela 9 km wskaźniki porównywalne z Phoenix: **udział dni bez rozmarzania, liczbę dni z przejściem przez 0 °C, amplitudę dobową, głębokość, od której grunt nigdy nie rozmarza** (`frozen_below_m`), opady i wilgotność.
- Rozdzielczość 9 km: **SMAP to sito regionalne**, nie narzędzie do wskazania konkretnego stanowiska ani poligonów.

## 1. Co to za zbiór i skąd

| cecha | wartość |
|---|---|
| produkt | **SPL4SMGP v8** (SMAP L4 Global 3-hourly 9 km EASE-Grid Surface and Root Zone Soil Moisture Geophysical Data) |
| archiwum | NASA NSIDC DAAC, doi:10.5067/T5RUATAQREF8 |
| co to jest | **model + asymilacja** obserwacji SMAP (temperatura jasnościowa L-band) w modelu powierzchni lądu NASA GEOS (Catchment). Nie jest to bezpośredni pomiar. |
| siatka | EASE-Grid 2.0, 9 km, 3856 × 1624 pikseli, globalnie (bez lądolodów i otwartej wody) |
| krok czasowy | 3 h (8 wartości na dobę, **średnie 3-godzinne**), od 31.03.2015 do dziś |
| format | HDF5, ~140 MB na plik globalny → ~400 GB na rok |
| dostęp | darmowe konto NASA Earthdata Login |

### Jak pobieramy

Pliki są globalne, więc zwykłe pobieranie to ~400 GB/rok. Zamiast tego używamy **NASA AppEEARS**, który wycina region po stronie NASA, a my pobieramy tylko piksele regionu (łącznie < ~1 GB).

| skrypt | rola |
|---|---|
| `smap_l4_appeears.py` | **główny**: zadanie AppEEARS per region → NetCDF `data/smap_l4/<region>.nc` |
| `smap_l4_fetch.py` | zapasowy: earthaccess, pobiera globalne pliki dzień po dniu, wycina region, kasuje surowe (wolny, ~400 GB transferu/rok) |
| `smap_l4_metrics.py` | wskaźniki per piksel → `<region>_metrics.nc` / `.csv` + porównanie z Phoenix |

## 2. Jakie zmienne pobieramy i po co

| zmienna (SPL4SMGP) | co to | nasz parametr | po co |
|---|---|---|---|
| `temp_lowatmmodlay` | temperatura powietrza w najniższej warstwie modelu (**~40–80 m**) | temperatura | najbliżej temperatury powietrza z Phoenix MET (1 m) |
| `surface_temp` | temperatura powierzchni (skin) | temperatura | dni z rozmarzaniem, amplituda dobowa |
| `soil_temp_layer1` … `4` | temperatura gruntu: ~0–0,10 / 0,10–0,29 / 0,29–0,68 / 0,68–1,44 m* | **zmarzlina** | na jakiej głębokości grunt nigdy nie rozmarza (Phoenix: lód na 2–18 cm) |
| `sm_surface`, `sm_rootzone` | wilgotność gleby 0–5 cm i 0–100 cm, m³/m³ | suchość | Phoenix: sucha gleba nad lodem → odrzucamy mokrą tundrę |
| `sm_surface_wetness` | wilgotność jako ułamek nasycenia | suchość | j.w., niezależne od typu gleby |
| `precipitation_total_surface_flux` | opad całkowity (deszcz + śnieg) | środowisko | hiperaridność (Phoenix: ~0) |
| `land_fraction_snow_covered` | udział pokrywy śnieżnej | zmarzlina | śnieg izoluje grunt; analogi Phoenix są prawie bez śniegu |

\* Głębokości warstw z dokumentacji modelu Catchment (grubości 0,0988 / 0,1952 / 0,3859 / 0,7626 m). **Do potwierdzenia w specyfikacji produktu przed cytowaniem.**

## 3. Wskaźniki (per piksel 9 km) i wartości referencyjne Phoenix

Doby liczone w **lokalnym czasie słonecznym** (przesunięcie o długość geograficzną), żeby pasowały do soli Phoenix. „Lato” = VI–VIII na półkuli N, XII–II na S (Phoenix ma tylko późną wiosnę i lato).

| wskaźnik | znaczenie | Phoenix | kierunek |
|---|---|---|---|
| `*_frac_summer_days_no_thaw` | udział letnich dni, w których max < 0 °C | **1,0** | im bliżej 1, tym lepiej |
| `*_ft_days_per_year` | dni/rok z przejściem przez 0 °C (min < 0 < max) | **~0** | im mniej, tym lepiej |
| `*_frac_below0` | udział pomiarów 3-h poniżej 0 °C | 1,0 | im więcej, tym lepiej |
| `*_daily_range_summer_K` | średnia amplituda dobowa latem | **57 K** | im większa, tym bliżej |
| `*_daily_max_summer_K` / `min` | średnie max / min dobowe latem | 245,6 / 188,5 K | im zimniej, tym lepiej |
| `frozen_below_m` | strop najpłytszej warstwy gruntu, która nigdy nie przekracza 0 °C (przybliżenie stropu zmarzliny) | **~0,02–0,18 m** | im płycej, tym lepiej |
| `precip_mm_per_year` | opad roczny | ~0 | im mniej, tym lepiej |
| `sm_surf_mean`, `sm_surf_summer_mean` | wilgotność 0–5 cm | sucha | im mniej, tym lepiej |
| `snow_frac_summer_mean` | pokrywa śnieżna latem | ~0 | im mniej, tym lepiej |

`*` = `tair`, `tsurf`, `tsoil1` … `tsoil4`.

## 4. Regiony (rok 2023)

| region | bbox (lon/lat) | rola |
|---|---|---|
| `dry_valleys` | 160,5…163°E, 78…77,2°S | znany analog → **walidacja metody** (jeśli nie zamaskowany) |
| `qiangtang` | 82…90°E, 33…36°N | główny kandydat z raportu Phoenix (zmarzlina, słone jeziora, sucho, wysoko) |
| `ojos_del_salado` | 69,5…67,5°W, 28…26°S | kandydat: zmarzlina > 5000 m + salary |
| `axel_heiberg` | 95…88°W, 78,5…81°N | kandydat: źródła solankowe przez zmarzlinę |
| `alaska_north_slope` | 160…145°W, 69…71°N | **kontrast**: mokra tundra (zły typ analogu), sprawdza, czy wskaźniki ją odróżniają |

Identyfikatory zadań AppEEARS: `data/smap_l4/appeears_tasks.json` (pełny rok) i `data/smap_l4_test/appeears_tasks.json` (test 3 dni, Dry Valleys, 1–3.07.2023).

## 5. Wyniki

*Do uzupełnienia po pobraniu danych.* Planowane:
- tabela regionów: mediana wskaźników z §3 obok Phoenix,
- ranking regionów pod kątem „zimno latem + sucho + płytka zmarzlina”,
- kontrast Alaska vs kandydaci,
- mapy `frozen_below_m` i `frac_summer_days_no_thaw`.

## 6. Status i co zostało sprawdzone

| krok | status |
|---|---|
| wybór produktu i zmiennych | ✅ zweryfikowane w API AppEEARS (SPL4SMGP.008, wszystkie 11 zmiennych dostępne) |
| skrypt pobierania (earthaccess) | ✅ wyszukiwanie w CMR działa (8 plików/dobę, ~140 MB/plik, wersja v8); pobieranie nieuruchomione (za duże) |
| skrypt AppEEARS | ✅ logowanie i wysłanie zadań działa; konwersja NetCDF przetestowana na pliku syntetycznym |
| skrypt wskaźników | ✅ przetestowany na danych syntetycznych ze znanym wynikiem (np. opad 63,1 mm/rok, `frozen_below_m` = 0,099 m) |
| zadania AppEEARS | ⏳ **w kolejce** (`pending`) |
| test Dry Valleys: 8 kroków/dobę? maska lodu? | ⏳ czeka na zadanie testowe |
| wskaźniki dla 5 regionów | ⏳ po pobraniu |

## 7. Ograniczenia

1. **Średnie 3-godzinne, nie ekstrema.** Amplituda dobowa jest zaniżona (test: rzeczywiste 40 K → ~37 K).
2. **Nie ta sama wielkość co Phoenix.** Phoenix MET to powietrze na 1 m; SMAP daje powietrze na ~40–80 m, temperaturę powierzchni i gruntu. Porównujemy wskaźniki pochodne (dni bez rozmarzania, przejścia przez 0 °C), nie surowe temperatury.
3. **Model, nie pomiar.** L4 to model GEOS z asymilacją SMAP; w miejscach bez stacji (Antarktyda, wysokie Andy) wynik zależy mocno od modelu i wymuszeń meteo.
4. **Maska lodu.** `surface_temp` i inne zmienne wykluczają „permanent ice”. **Suche Doliny mogą wyjść jako brak danych** → wtedy walidację trzeba zrobić innym zbiorem (ERA5 / MODIS LST).
5. **Rozdzielczość 9 km.** Piksel uśrednia dolinę, stoki i lodowce; poligonów (3–6 m) nie widać. SMAP = sito regionalne, potem kandydaci do sprawdzenia danymi o wysokiej rozdzielczości.
6. **Brak soli.** SMAP nie mówi nic o perchloranach; ten parametr musi przyjść z innego źródła.
7. **Jeden rok (2023).** Dla pewności warto potem powtórzyć dla 2–3 lat (zmienność roczna).

## 8. Następne kroki

1. Po teście: sprawdzić 8 kroków/dobę i maskę Dry Valleys; w razie problemów poprawić skrypty.
2. Pobrać pełny rok dla 5 regionów, policzyć wskaźniki, uzupełnić §5.
3. Potwierdzić głębokości warstw gruntu w specyfikacji SPL4SMGP.
4. Połączyć z ESA Permafrost_cci (grubość warstwy czynnej, 1 km) jako drugie źródło dla `frozen_below_m`.

## Pliki w tym folderze

- `smap_l4_appeears.py`: pobieranie przez AppEEARS (`python smap_l4_appeears.py --start … --end … --region NAZWA:lon0,lat0,lon1,lat1 --out data/smap_l4`).
- `smap_l4_fetch.py`: pobieranie przez earthaccess (zapasowe).
- `smap_l4_metrics.py`: wskaźniki (`python smap_l4_metrics.py data/smap_l4/<region>.nc`).

## Źródła

- SPL4SMGP v8, NSIDC DAAC: https://nsidc.org/data/spl4smgp , doi:10.5067/T5RUATAQREF8
- NASA AppEEARS: https://appeears.earthdatacloud.nasa.gov
- Reichle R.H. et al., *SMAP Level 4 Surface and Root Zone Soil Moisture (L4_SM) Product Specification Document* (NASA GMAO) — opis zmiennych i warstw modelu
- Wartości referencyjne Phoenix: `analysis/phoenix/PHOENIX_WNIOSKI.md`
