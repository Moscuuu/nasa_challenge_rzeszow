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
- **Lato (decyzja zespołu):** w warstwie czynnej 0–1 m te same 3 wielkości liczymy też dla **lokalnego lata** (Ziemia: VI–VIII na N, XII–II na S; Mars: Ls 90–180° na N, Ls 270–360° na S). Razem 6 wielkości, równe wagi. To odsiewa miejsca zimne zimą, ale ciepłe latem (pułapka mokrej tundry). **Warstwy 1–5 m i > 5 m: tylko średnia roczna temperatura.**
- **Ocena:** dla każdej wielkości komórki są ustawione w rankingu według odległości od wartości danego miejsca na Marsie (1. miejsce = najbliżej). Ocena wielkości = percentyl (1 = najbliżej). Ocena temperatury = średnia z wielkości.

### Lód gruntowy (porównanie pozycji)

- **Ziemia:** „pewność płytkiego lodu” z ESA Permafrost CCI v5 (2023): `PFR/100 × clip(1 − ALT/1 m, 0, 1)`, uśrednione do 0,1°.
- **Mars:** SWIM4MIM wskaźnik zgodności z lodem C dla 0–1 m, średnia w oknie 1° wokół miejsca.
- **Ocena:** obie wielkości zamienione na percentyl na tle własnej planety (Ziemia: wszystkie komórki zmarzliny; Mars: wszystkie piksele SWIM z danymi). Ocena = `1 − |percentyl_Ziemia − percentyl_Mars|`.

## 3a. Cechy w warstwach 1–5 m i > 5 m

| | 1–5 m | > 5 m |
|---|---|---|
| temperatura Ziemia | CCI GTD 2023: średnia z T2m i T5m | CCI GTD 2023: T10m |
| temperatura Mars | model: średnia roczna na 2 m i 5 m | model: średnia roczna w najgłębszej warstwie (~5,5 m; poniżej ~1 m profil jest prawie płaski) |
| lód Ziemia | `PFR × clip((5 − max(ALT, 1)) / 4, 0, 1)`: pewność, że warstwa 1–5 m jest zamarznięta | PFR |
| lód Mars | SWIM C 1–5 m | SWIM C > 5 m |
| spękania | później | nieistotne (waga 0) |

- **Percentyle lodu: mid-rank** na obu planetach (remisy dostają średnią z „poniżej” i „poniżej lub równo”). SWIM w warstwach głębszych ma dużo identycznych wartości (np. 0,50).
- **NSIDC GGD318 (ilość lodu) nie jest użyte.** Brak loginu Earthdata na maszynie analizy, a mapa nie obejmuje Antarktydy. CCI mówi tylko, *czy* jest zmarzlina, a nie *ile* jest lodu, więc w warstwach głębszych wskaźnik lodu na Ziemi jest prawie zawsze 1 i słabo rozróżnia komórki. Ulepszenie: GGD318 dla półkuli N, gdy będzie login.
- **Temperatura w głębi nie rozróżnia miejsc na Marsie:** wszystkie 7 mają ~200–202 K, czyli są zimniejsze niż jakikolwiek grunt na Ziemi, więc ranking „najbliżej Marsa” jest dla nich identyczny. Miejsca różnią się tylko lodem, stąd remisy (`tied_site_ids` w kontrakcie 0.4).

### Spękania (warstwy 0–1 m i 1–5 m; w > 5 m nieistotne)

- **Ziemia:** „potencjał pękania” z CCI GST (średnia roczna temperatura powierzchni gruntu) według progów Péwé 1966 z analizy CCI: `clip((−2 °C − GST) / 18 K, 0, 1)`, czyli 0 powyżej −2 °C i 1 przy ≤ −20 °C (pękanie zimne i suche, jak u Phoenixa). **To szacunek z temperatury, a nie obserwacja poligonów**, więc częściowo liczy „zimno” drugi raz.
- **Mars:** SWIM4MIM `SWIM4MIM_Polygons_GIS.tif` (udział zdjęć z przeglądu, na których widać poligony w skali HiRISE), średnia w oknie 1°. Poza pasem przeglądu (~47,9°S–49,0°N) i tam, gdzie piksel ma −30, traktujemy jako brak danych. **Deuteronilus Mensae, Phlegra Montes i Utopia Planitia nie mają pokrycia przeglądem**, więc cecha jest dla nich pominięta (zgodnie z zasadą „brak danych pomijamy”).
- **Ocena:** `1 − |percentyl_Ziemia − percentyl_Mars|` (mid-rank; Mars: wśród przejrzanych pikseli).
- **Skutek uboczny zasady:** miejsca bez danych o poligonach nie dostają kary za tę cechę, więc częściej wygrywają jako „najbliższe” (63 % top 2000 w 0–1 m). Do decyzji zespołu, czy przy wyborze najbliższego miejsca porównywać tylko cechy wspólne dla wszystkich.

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

## 5a. Decyzje podjęte przy liczeniu (2026-11-14 wieczór)

- **Komórka zmarzliny** = średni PFR w komórce ≥ 10 % (bez zmarzliny wyspowej). Wynik: 371 225 komórek.
- **Lód na Marsie: percentyl liczony wśród pikseli z sygnałem lodu (C > 0)**, a nie wśród wszystkich. Po stronie Ziemi ranking obejmuje tylko zmarzlinę, czyli grunt z lodem, więc obie populacje znaczą „miejsca z lodem gruntowym”. Pierwsza wersja porównywała różne populacje, przez co mokra tundra Alaski dostawała lód 0,97.
- **Komórka bez temperatury (luki ERA5-Land, 20 850 komórek) nie dostaje wyniku ogólnego.** Lód jest z definicji w każdej komórce zmarzliny, więc wynik z samego lodu dawał 1,0. Pierwsza wersja miała przez to same takie komórki w top 2000.
- `cells_top_0-1m.geojson` ma ~4,7 MB (z oknami eksperymentu), a nie ~2 MB.

## 5b. Wynik pierwszego przebiegu (warstwa 0–1 m)

| test | percentyl (mediana) | wynik |
|---|---|---|
| Suche Doliny McMurdo (znany analog) | 70,8 | ✗ (wymagane ≥ 90) |
| Devon / Haughton (znany analog) | 89,5 | ✗ (o włos) |
| Alaska North Slope (kontrast) | 40,8 | ✓ |

Dlaczego Suche Doliny wypadają słabo: **amplituda dobowa**. W Suchych Dolinach średnia amplituda w roku to ~5 K (noc i dzień polarny), a na miejscach na Marsie ~73 K. Ziemia osiąga najwyżej ~39 K (wysokie pustynie). Temperatura dla Suchych Dolin: minimum 0,99, maksimum 0,92, amplituda **0,08**. To prawdziwe „tu analogia się łamie”, a nie błąd. Drugi czynnik: CCI zaniża ALT w Antarktydzie (ALT = 0), więc „pewność płytkiego lodu” = 1,0, a to na Ziemi pozycja wyższa niż każdego z miejsc na Marsie.

Najlepsze komórki: **Ladakh / Aksai Chin (35°N 77°E, wysoka zimna pustynia)** oraz **Jakucja / Kołyma (60–70°N, 125–150°E)**.

**Po dodaniu lata (drugi przebieg):** Suche Doliny 73,4 ✗, Devon 86,2 ✗, Alaska 43,0 ✓. Najlepsze 2000 komórek przesunęło się w stronę **wysokich zimnych pustyń: Karakorum / Ladakh / Pamir (30–40°N, 70–80°E)** i **Tybetu (30–35°N, 90–95°E)**. Syberia spadła, ale nadal jest w top 2000. Najlepsza komórka: 35,25°N 77,25°E (Aksai Chin), wynik 0,947, najbliższa Arcadii.

## 5c. Wyniki wszystkich warstw (trzeci przebieg, mid-rank lodu)

| test | 0–1 m | 1–5 m | > 5 m |
|---|---|---|---|
| Suche Doliny (znany analog, ≥ 90) | 65,6 ✗ | **98,3 ✓** | **98,2 ✓** |
| Devon / Haughton (znany analog, ≥ 90) | 86,6 ✗ | **93,1 ✓** | **92,7 ✓** |
| Alaska North Slope (kontrast, < 50) | **42,8 ✓** | 67,7 ✗ | 65,8 ✗ |

**Najlepsze komórki w głębi:** wszystkie 2000 leżą w **Antarktydzie, w Górach Transantarktycznych (75–85°S, 155–170°E)**, gdzie grunt na 2–10 m ma ok. 234 K (−39 °C), najzimniej na Ziemi. W warstwach głębszych metoda sprowadza się więc do „najzimniejsza zmarzlina na Ziemi”. Każda komórka top 2000 ma ten sam remis (1–5 m: Erebus + Utopia; > 5 m: 4 miejsca), więc **warstwy głębsze nie rozróżniają miejsc na Marsie**. Zastrzeżenie: maska Antarktydy w CCI jest hojna (183 tys. km² wobec 22–45 tys. km² gruntu bez lodu), więc część komórek na 84°S może być skrajem lądolodu. Do sprawdzenia na zdjęciach przed pokazaniem jako „odkrycie”.

Wniosek: znane analogi są dobrymi analogami **lodu w głębi**, ale nie **warstwy powierzchniowej** (brak marsjańskiej amplitudy dobowej). Kontrast „mokra tundra” działa tylko w 0–1 m, bo w głębi Alaska to zwykła zimna zmarzlina. Test kontrastu w warstwach głębszych to błąd założeń testu, a nie metody.

## 5d. Wyniki ze spękaniami (czwarty przebieg, wszystkie 3 cechy)

| test | 0–1 m | 1–5 m | > 5 m (bez spękań) |
|---|---|---|---|
| Suche Doliny (≥ 90) | **92,7 ✓** | **98,3 ✓** | **98,2 ✓** |
| Devon / Haughton (≥ 90) | **96,5 ✓** | **91,6 ✓** | **92,7 ✓** |
| Alaska North Slope (kontrast, < 50; tylko 0–1 m) | **44,2 ✓** | 67,3 (n/d) | 65,8 (n/d) |

**Warstwa 0–1 m przechodzi wszystkie trzy testy.** Zastrzeżenie: spękania po stronie Ziemi są liczone z temperatury, więc część poprawy to podwójne liczenie „zimna”. Najlepsze komórki 0–1 m: **Jakucja / Kołyma (60–70°N, 125–145°E)** oraz **Pamir / Karakorum / Ladakh (30–40°N, 70–80°E)**. Najlepsza: 36,85°N 74,35°E (Karakorum), 0,944, najbliżej Deuteronilus Mensae (ocena z 2 cech: Deuteronilus nie ma danych o poligonach).

## 5e. Dodatki (2026-11-14 wieczór)

- **Nazwy komórek (`place`):** Natural Earth 10m (domena publiczna). Najmniejszy region fizyczny zawierający środek komórki (pasmo, płaskowyż, wyspa…) + kraj, np. „Verkhoyansk Range, Russia”. 4039 z 4058 komórek top (wszystkie warstwy) ma nazwę. `pipeline/fetch_places.py`, `pipeline/places.py`.
- **Automatyczny pomiar poligonów (ArcticDEM 2 m): nie przeszedł kontroli.** Dominujący rozstaw wzoru liczony z widma mocy wycinków 2 × 2 km (`pipeline/polygon_check.py`). Na kontroli z pewnymi poligonami (Utqiagvik, Alaska) wzór jest ledwo widoczny, bo szum DEM jest rzędu głębokości rowów (~0,2–0,5 m). Na komórce górskiej w Jakucji najsilniejszy „sygnał” dały żleby na stokach. Wynik ma flagę `validated: false` i **nie wchodzi do oceny**. Podglądy cieniowania (`out/polygon_checks/*.png`) służą do oceny wzrokowej przez człowieka. Wniosek pomocniczy: najlepsze komórki 0–1 m w Jakucji to **pasma górskie** (Wierchojańskie, Czerskiego, Suntar-Chajata), a nie płaskie równiny, gdzie zwykle występują poligony. Komórka 0,1° uśrednia doliny i stoki.
- **Globus Marsa:** zadanie zespołu GUI (dane w `mars_sites.geojson`).
- **Współrzędne miejsc na Marsie z publikacji** (`coords_source` w `mars_sites.py`): Arcadia: krater „Badger” w warstwie lodu Bramson 2015 (46,58°N, −165,15°); Deuteronilus: EZ Head i in. 2015 (39,11°N, 23,20°E); Erebus Montes: EZ Viola i in. 2015 (39,0°N, −167,9°). **Wcześniejsza wartość 35,7°N 175°E była błędna.** Krater w Amazonis: Posiolova 2022 / Dundas 2023 (35,1°N, −170,2°); Hellas: EZ Levy i Holt 2015 (−39,05°, 101,91°E). Przybliżone (bez opublikowanego punktu): Phlegra Montes, Utopia Planitia.

### Skutek zmiany współrzędnych (piąty przebieg)

| test | 0–1 m | 1–5 m | > 5 m |
|---|---|---|---|
| Suche Doliny (≥ 90) | 70,5 ✗ | 98,3 ✓ | 98,2 ✓ |
| Devon / Haughton (≥ 90) | 85,3 ✗ | 93,0 ✓ | 92,7 ✓ |
| Alaska (kontrast, < 50; tylko 0–1 m) | 43,0 ✓ | 67,6 (n/d) | 65,8 (n/d) |

**Zaliczenie 0–1 m w czwartym przebiegu było kruche.** Opublikowany punkt Arcadii leży poza przeglądem poligonów SWIM, a stary, przybliżony miał pełny sygnał poligonów (1,0). Teraz dane o poligonach mają tylko 3 z 7 miejsc (Erebus, Amazonis, Hellas). Wniosek dla prezentacji: wynik warstwy 0–1 m zależy od tego, czy w pobliżu miejsca na Marsie zmapowano poligony. Uczciwie pokazać jako „ograniczenie danych”, nie jako sukces lub porażkę metody. Warstwy głębsze są stabilne.

## 5f. Zasada braków danych zmieniona (decyzja zespołu, 2026-11-14 ~20:40)

**Brak danych w cesze, która liczy się w danej warstwie, = 0 (kara). Cecha, która w warstwie się nie liczy, nie ma wpływu.** Zastępuje wcześniejsze „braki pomijamy, nie zerujemy” i „komórka bez temperatury nie dostaje wyniku”.

Skutki (szósty przebieg):

| test | 0–1 m | 1–5 m | > 5 m |
|---|---|---|---|
| Suche Doliny (≥ 90) | 68,1 ✗ | 91,6 ✓ | 98,2 ✓ |
| Devon / Haughton (≥ 90) | 91,7 ✓ | 92,0 ✓ | 92,7 ✓ |
| Alaska (kontrast, < 50; tylko 0–1 m) | 58,9 ✗ | 67,6 (n/d) | 65,8 (n/d) |

- W 0–1 m i 1–5 m „najbliższym” miejscem mogą być teraz tylko miejsca z danymi o poligonach (Erebus, Amazonis, Hellas). Pozostałe 4 dostają 0 za spękania.
- ~21 tys. komórek bez temperatury ERA5 dostaje teraz niskie wyniki zamiast wypaść z rankingu, co podnosi percentyle pozostałych o kilka punktów. To częściowo tłumaczy wzrost Alaski (43 → 59).

**NSIDC GGD318 uruchomione (siódmy przebieg, 2026-11-14 ~21:30).** Wskaźnik lodu w warstwach głębszych = pewność zmarzliny (CCI) × ilość lodu (GGD318, `ice_ord/3`). 410 928 komórek ma wartość ilości lodu.

| test | 1–5 m | > 5 m |
|---|---|---|
| Suche Doliny (≥ 90) | **59,4 ✗** | **18,3 ✗** |
| Devon / Haughton (≥ 90) | 97,2 ✓ | 98,3 ✓ |
| Alaska (kontrast; n/d w głębi) | 79,6 | 72,3 |

Antarktyda nie ma danych GGD318, więc zgodnie z zasadą kar dostaje 0 za lód i wypada z czołówki warstw głębszych. Suche Doliny przestają przechodzić test. To skutek braku danych, a nie wynik fizyczny. Alternatywa do decyzji zespołu: w Antarktydzie liczyć lód tylko z CCI.

Wcześniejszy opis (przed uruchomieniem): **NSIDC GGD318 (ilość lodu) przygotowane, nieuruchomione:** `pipeline/ice_content.py` + `score.py` (warstwy 1–5 m i > 5 m: pewność zmarzliny × ilość lodu). Brak loginu Earthdata na maszynie analizy. **Uwaga:** GGD318 nie obejmuje Antarktydy, więc według nowej zasady kar Antarktyda dostanie 0 za lód w warstwach głębszych i wypadnie z czołówki (dziś zajmuje całe top 2000).

## 6. Ograniczenia

- ERA5-Land i CCI to modele, nie pomiary. Dobowe min/max z ERA5-Land liczone w dobach UTC.
- Temperatura Marsa pochodzi z prostego modelu (stałe albedo i bezwładność cieplna dla miejsca), bez atmosfery i stoków.
- Lód: porównujemy pozycję w rankingu, nie ilość lodu, bo obie planety mierzą co innego.
- Rok 2023 był wyjątkowo ciepły (CCI).
