# NSIDC GGD318 — mapa zmarzliny i lodu gruntowego (Brown i in.) — podsumowanie

Data: 2026-11-14
Zakres: NSIDC to archiwum, nie jeden zbiór. Wybraliśmy **Circum-Arctic Map of Permafrost and Ground-Ice Conditions, v2 (GGD318)**, bo jako jedyny w naszym zestawie mówi, **ile lodu jest w gruncie**, czyli coś, co da się postawić obok SWIM (Mars) i lodu z Phoenix.

## TL;DR

- Wektorowa mapa (13 671 poligonów) całej półkuli północnej od ~20°N. Każdy poligon ma: **zasięg zmarzliny** (ciągła / nieciągła / sporadyczna / wyspowa), **zawartość lodu gruntowego** (wysoka / średnia / niska) i **typ terenu** (niziny z grubą pokrywą osadów / góry z cienką pokrywą).
- **Brak Antarktydy i półkuli południowej** → Suche Doliny i Ojos del Salado poza mapą. Walidacji na Suchych Dolinach nie zrobimy tym zbiorem (tak jak SMAP).
- To **mapa kartograficzna z lat 90.** (skala 1:10 mln), nie pomiar satelitarny. Dobra jako warstwa kategorii „czy jest dużo lodu”, nie jako liczby.
- Wyniki dla regionów: **Devon Island (Haughton) = 100 % „ciągła + dużo lodu”**, Axel Heiberg 34 %, Alaska 41 %, Qiangtang 0 % (tam zmarzlina nieciągła, ale prawie cała z wysoką zawartością lodu w klasie górskiej).

## 1. Co to za zbiór i skąd

| cecha | wartość |
|---|---|
| produkt | **GGD318 v2**, Circum-Arctic Map of Permafrost and Ground-Ice Conditions |
| autorzy | Brown J., Ferrians O., Heginbottom J. A., Melnikov E. (2002), IPA |
| archiwum | NASA NSIDC DAAC, doi:10.7265/skbg-kf16 |
| co to jest | zdigitalizowana mapa IPA 1:10 000 000 (1997), kompilacja map krajowych i obserwacji terenowych |
| zasięg | półkula północna, ~20°N–90°N (z Tybetem, Mongolią, Alpami, Skandynawią) |
| format | shapefile `permaice.shp` (Lambert azimuthal equal-area, biegun N, południk 180°) + raster `nhipa.byte` 12,5 km |
| rozmiar | ~23 MB całość |
| dostęp | darmowe konto NASA Earthdata Login (`~/_netrc`) |

## 2. Klasy (legenda mapy)

| pole | kod | znaczenie |
|---|---|---|
| `EXTENT` | C / D / S / I | zmarzlina **ciągła** 90–100 % / **nieciągła** 50–90 % / **sporadyczna** 10–50 % / **wyspowa** < 10 % powierzchni |
| `CONTENT` | h / m / l | widoczny lód gruntowy w górnych **10–20 m**, % objętości |
| `LANDFORM` | f | niziny, wyżyny, obniżenia z **grubą pokrywą osadów** (> 5–10 m): h > 20 %, m 10–20 %, l < 10 % |
| | r | **góry**, wyżyny z cienką pokrywą i odsłoniętą skałą: h > 10 %, l < 10 % (brak klasy m) |
| `COMBO` | g / l / o / r / ld | lodowiec / jezioro / morze / zmarzlina reliktowa / ląd bez zmarzliny |

**Uwaga:** „h” w górach (> 10 %) to nie to samo co „h” na nizinach (> 20 %). W skrypcie zawartość lodu jest kodowana porządkowo (1–3), bez udawania procentów.

## 3. Jak to łączymy z Marsem

| Ziemia (GGD318) | Mars | uwagi |
|---|---|---|
| zasięg C/D/S/I → `pf_frac` (środek klasy: 0,95 / 0,70 / 0,30 / 0,05) | SWIM: indeks spójności lodu | oba mówią „jak pewne / powszechne jest lód w gruncie” |
| zawartość lodu h/m/l → `ice_ord` 3/2/1 | Phoenix: lód na 2–18 cm, w części wykopów **lód prawie czysty** (nadmiarowy) | Phoenix ≈ najwyższa klasa (h) |
| `phoenix_like_frac` = udział „ciągła + h” | Phoenix (68°N, równiny Vastitas Borealis) | proste kryterium do rankingu |
| typ terenu f/r | rodzaj podłoża na lądowisku | Phoenix to równina z osadami → bliżej `f` niż `r` |

Głębokość lodu (Phoenix: centymetry) **nie jest** w tym zbiorze. Bierzemy ją z Permafrost_cci (ALT) i SMAP (`frozen_below_m`).

## 4. Wyniki dla regionów

Udziały liczone po powierzchni lądu bez lodowców i wody (`regions.csv`). Pola liczone w odwzorowaniu równopolowym, więc są prawdziwe.

| region | lodowce | ciągła | nieciągła | lód h | lód m | lód l | `phoenix_like_frac` | góry (r) |
|---|---|---|---|---|---|---|---|---|
| `devon_island_haughton` (znany analog) | 0 % | 100 % | 0 % | **100 %** | 0 % | 0 % | **1,00** | 100 % |
| `alaska_north_slope` (kontrast) | 0 % | 100 % | 0 % | 41 % | 48 % | 11 % | 0,41 | 7 % |
| `axel_heiberg` | 37 % | 100 % | 0 % | 34 % | 0 % | 66 % | 0,34 | 100 % |
| `svalbard_bockfjord` (znany analog) | 20 % | 100 % | 0 % | 0 % | 47 % | 53 % | 0,00 | 53 % |
| `qiangtang` | 0 % | 0 % | **99 %** | 94 % | 0 % | 6 % | 0,00 | 100 % |
| `dry_valleys`, `ojos_del_salado` | — | — | — | — | — | — | poza mapą | — |

Wnioski:

1. **Lód gruntowy nie odróżnia Alaski od dobrych analogów.** Mokra tundra Alaski ma dużo lodu (41 % h, prawie połowa m). To potwierdza „pułapkę mokrej tundry”: GGD318 nadaje się jako warstwa „jest lód / nie ma lodu”, a **suchość musi przyjść z SMAP / opadów**.
2. **Qiangtang** wypada jako zmarzlina **nieciągła**, z lodem „h” w klasie górskiej (> 10 %). Na tej mapie to słabszy kandydat niż wyspy arktyczne. Uwaga: mapa tybetańska jest stara i zgrubna; Permafrost_cci daje tu dokładniejszy obraz.
3. **Devon Island (Haughton)**, znany analog, wychodzi najlepiej w tej warstwie. Dobra wiadomość dla walidacji, ale to jeden punkt.
4. **Svalbard (Bockfjord)** ma lód niski–średni. To analog **mineralno-procesowy** (wulkany, karbonaty), nie lodowy, więc zgodnie ze specyfikacją pipeline'u nie powinien ustawiać wag.

## 5. Pliki wynikowe

W `data/nsidc_ggd318/out/` (poza gitem):

| plik | zawartość |
|---|---|
| `regions.csv` | tabela z §4 + `pf_frac_mean`, `ice_ord_mean`, `mapped_frac` |
| `grid_0p1deg.csv.gz` | **478 115 komórek 0,1°** (≥ 20°N) ze zmarzliną lub lodowcem: `lat, lon, extent, pf_frac, ice, ice_ord, landform, glacier, relict`. Komórki nieobecne w pliku = brak zmarzliny (lub poza mapą na S od 20°N) |
| `map_regions.png` | mapa zasięg × lód z ramkami regionów |

Siatka 0,1° pasuje do pierwszego przebiegu pipeline'u (`docs/superpowers/specs/2026-11-14-mars-analog-data-pipeline-design.md`, §7.2) jako parametr „Ice / permafrost”.

## 6. Ograniczenia

1. **Tylko półkula północna.** Antarktyda (Suche Doliny), Andy (Ojos del Salado) poza zasięgiem. Dla nich: Permafrost_cci v5 (ma Antarktydę).
2. **Mapa, nie pomiar.** Kompilacja z 1997 r. w skali 1:10 mln; granice poligonów mają dokładność rzędu dziesiątek km. Stan sprzed ocieplenia ostatnich dekad.
3. **Kategorie, nie liczby.** Procenty to szerokie przedziały, a klasy „h” różnią się progiem między nizinami a górami.
4. **Brak głębokości lodu i grubości warstwy czynnej.**
5. **Lód ≠ analog.** Dużo lodu ma też mokra tundra. Parametr ma sens tylko razem z suchością i temperaturą latem.

## 7. Następne kroki

1. Dołączyć `grid_0p1deg.csv.gz` do globalnej siatki pipeline'u jako parametr ekstremalności „lód gruntowy”.
2. Zestawić `phoenix_like_frac` z wynikami SMAP (suchość, dni bez rozmarzania), gdy zadania AppEEARS się skończą.
3. Sprawdzić Tybet z Permafrost_cci (PFR, ALT), bo tu GGD318 jest najsłabszy.

## Pliki w tym folderze

- `ggd318_fetch.py`: pobieranie (`python analysis/nsidc_ggd318/ggd318_fetch.py --out data/nsidc_ggd318`).
- `ggd318_analyze.py`: dekodowanie klas, statystyki regionów, siatka 0,1°, mapa (`python analysis/nsidc_ggd318/ggd318_analyze.py`). Wymaga `geopandas pyogrio shapely pyproj matplotlib`.

## Źródła

- Brown J., Ferrians O., Heginbottom J. A., Melnikov E. (2002). *Circum-Arctic Map of Permafrost and Ground-Ice Conditions*, Version 2 (GGD318). NSIDC, Boulder. https://doi.org/10.7265/skbg-kf16
- Strona zbioru: https://nsidc.org/data/ggd318/versions/2
- Wartości referencyjne Phoenix: `analysis/phoenix/PHOENIX_WNIOSKI.md`
