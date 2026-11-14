# Analogi zmarzliny Ziemia ↔ Mars: specyfikacja i plan analizy

Data: 2026-11-14. Zastępuje `2026-11-14-mars-analog-data-pipeline-design.md`.
Pojęcia: `GLOSSARY.md`. Kontrakt z zespołem GUI: `docs/contracts/analysis-to-gui/CONTRACT.md`.
Budżet: **15 h** (od 2026-11-14 ~16:00).

## 1. Cel

Ocenić każdą **komórkę** (0,1°) wiecznej zmarzliny na Ziemi: jak bardzo przypomina każde z **7 Kandydackich Miejsc Bazy na Marsie**, osobno dla każdej cechy, w wybranej **warstwie gruntu**. Wynik: pliki dla GUI według kontraktu.

## 2. Ustalenia (z sesji pytań)

| temat | decyzja |
|---|---|
| Mars | 7 miejsc na bazę, okno ~1° wokół opublikowanych współrzędnych. Phoenix nie jest używany. |
| Ziemia | wszystkie komórki zmarzliny (CCI: półkula N 25–85°N + Antarktyda), bez łączenia w regiony |
| Cechy | temperatura, lód gruntowy, spękania (na końcu). Sól i zasolenie wypadają (brak danych dla stref polarnych). |
| Warstwy | 0–1 m najpierw, potem 1–5 m i >5 m |
| Wagi | równe wagi dla cech istotnych w danej warstwie; brak danych pomijany, nie zerowany |
| Ocena ogólna | zwykła średnia ocen cech; najbliższe miejsce na bazę = najwyższy z 7 wyników |
| Test metody | znane analogi (Suche Doliny, Devon) ≥ 90. percentyl; kontrast (Alaska North Slope) < 50. percentyl. Nowe znaleziska nie muszą być tak dobre. |
| Okno eksperymentu | tylko informacja, cały rok marsjański |

## 3. Cechy w warstwie 0–1 m

### Temperatura (porównanie rankingowe)

- **Ziemia:** ERA5-Land `skin_temperature` (Earth Engine, `ECMWF/ERA5_LAND/DAILY_AGGR`, rok 2023, natywnie 0,1°): średnie dobowe **minimum**, **maksimum** i **amplituda**.
- **Mars:** dobowy przebieg temperatury powierzchni dla każdego miejsca z jednowymiarowego modelu cieplnego (nasłonecznienie z orbity, przewodzenie w gruncie, szron CO₂), uśredniony po roku marsjańskim: minimum, maksimum, amplituda.
- **Ocena:** dla każdej z 3 wielkości komórki są ustawione w rankingu według odległości od wartości danego miejsca na Marsie (1. miejsce = najbliżej). Ocena wielkości = percentyl (1 = najbliżej). Ocena temperatury = średnia z 3 wielkości.

### Lód gruntowy (porównanie pozycji)

- **Ziemia:** „pewność płytkiego lodu” z ESA Permafrost CCI v5 (2023): `PFR/100 × clip(1 − ALT/1 m, 0, 1)`, uśrednione do 0,1°.
- **Mars:** SWIM4MIM wskaźnik zgodności z lodem C dla 0–1 m, średnia w oknie 1° wokół miejsca.
- **Ocena:** obie wielkości zamienione na percentyl na tle własnej planety (Ziemia: wszystkie komórki zmarzliny; Mars: wszystkie piksele SWIM z danymi). Ocena = `1 − |percentyl_Ziemia − percentyl_Mars|`.

### Spękania (później)

Ziemia: przybliżenie z temperatury (reżim pękania). Mars: mapa poligonów SWIM. Dokładamy na końcu.

## 4. Okno eksperymentu

Dla 2000 najlepszych komórek: godzinowa klimatologia ERA5-Land (miesiąc × godzina lokalna, `skin_temperature`). Okno względem miejsca na Marsie to komórki tablicy miesiąc × godzina, w których temperatura mieści się w rocznym zakresie dobowym miejsca [min, max]. Podajemy najlepsze miesiące, godziny i liczbę godzin w roku.

## 5. Plan implementacji (kolejność ustalona z zespołem)

Kod w `pipeline/`, surowe dane w `data/raw/` (poza gitem), dane pośrednie w `data/interim/`, wyniki dla GUI w `out/`.

1. **Sito 0–1 m**
   1. `fetch_cci.py`: CCI PFR + ALT 2023 (N + Antarktyda).
   2. `fetch_swim.py`: SWIM C dla 3 warstw.
   3. `fetch_era5.py`: statystyki temperatury ERA5-Land na siatce 0,1°.
   4. `mars_thermal.py`: model cieplny Marsa → temperatury 7 miejsc.
   5. `mars_sites.py`: współrzędne + wartości 7 miejsc (lód SWIM, temperatura, chlor GRS jako informacja).
   6. `earth_grid.py`: CCI → siatka 0,1°, maska zmarzliny, pewność płytkiego lodu.
   7. `score.py`: oceny cech, wynik ogólny, ranking, najbliższe miejsce.
2. **Test metody**: `validate.py` → `validation.json`.
3. **Dostawa dla GUI**: `export.py` → `manifest.json`, `mars_sites.geojson`, `cells_top_0-1m.geojson`, 8 map PNG; okno eksperymentu (`experiment_window.py`).
4. **Dodatki**: warstwy 1–5 m i >5 m, ręczny pomiar poligonów dla kilku najlepszych komórek, globus Marsa (GUI).
5. **Spękania**.

## 6. Ograniczenia

- ERA5-Land i CCI to modele, nie pomiary. Dobowe min/max z ERA5-Land liczone w dobach UTC.
- Temperatura Marsa pochodzi z prostego modelu (stałe albedo i bezwładność cieplna dla miejsca), bez atmosfery i stoków.
- Lód: porównujemy pozycję w rankingu, nie ilość lodu, bo obie planety mierzą co innego.
- Rok 2023 był wyjątkowo ciepły (CCI).
