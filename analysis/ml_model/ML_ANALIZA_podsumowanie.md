# Analiza cech i model ML pod analogi odwiertowe — podsumowanie

Data: 2026-11-14. Pojęcia: `GLOSSARY.md`. Spec zespołu: `docs/superpowers/specs/2026-11-14-permafrost-analog-analysis-design.md`.

## Cel

Projekt ma wskazać miejsca na Ziemi, w których można robić **odwierty analogiczne do Marsa**, czyli badać lód i wodę w gruncie w możliwie podobnych warunkach. Ta analiza sprawdza:

1. czy cechy w pipeline'ie niosą prawdziwą informację,
2. czy uczenie maszynowe (PCA, model) coś do tego wnosi,
3. jak nowe warianty wyniku wypadają na tle wyników zespołu w `out/`.

## Dane

| źródło | co | skąd |
|---|---|---|
| ESA Permafrost CCI 2023 | PFR, ALT, GST, T na 2/5/10 m | siatka 0,1° policzona kodem zespołu `pipeline/earth_grid.py` (371 225 komórek zmarzliny) |
| ERA5-Land 2023 | dobowe min / maks / amplituda temperatury powierzchni | migawka `data/` z historii repo (commit `c653840`) |
| opady, NDVI | roczna suma opadów, maks. zieleń roślin | ta sama migawka (`data/dryness/`) |
| NSIDC GGD318 | klasa zawartości lodu (niska / średnia / wysoka) | ta sama migawka (`data/nsidc_ggd318/out/`) |
| `out/` | wyniki pipeline'u (8. przebieg, z suchością) | `main` |

W migawce brakuje letnich wartości ERA5 i wilgotności gleby ze SMAP, więc porównanie z 8. przebiegiem nie jest idealnie „jabłka do jabłek”.

## 1. Diagnoza cech: co jest nie tak

| problem | dowód | skutek |
|---|---|---|
| **Cechy to kopie tej samej informacji** | Temperatury GST, T 1–5 m, T 10 m: ρ ≥ 0,96. „Potencjał pękania” to GST (ρ = −0,93). „Lód > 5 m” = PFR (ρ = 1,00). | „Zimno” liczone kilka razy |
| **Remisy** | Ta sama wartość w 42 % komórek (lód 1–5 m), 44 % (lód > 5 m), 50 % (pękanie) | Ranking nie ma czego rozróżniać |
| **Mars poza zasięgiem Ziemi** | W głębi Mars ma 200–203 K, a najzimniejsza Ziemia 234 K. Amplituda dobowa: Mars 69–79 K, Ziemia ≤ ~39 K. | Ranking „najbliżej Marsa” sprowadza się do „najzimniej” |
| **Porównanie percentyli lodu 1–5 m odwraca sens** | Dla Arcadii i Amazonis (percentyl SWIM ≈ 0,27) pełna zmarzlina dostaje 0,47, a nagradzana jest zmarzlina częściowa | Działa odwrotnie do zamierzeń; lepiej użyć tej cechy jako filtra |
| **Test metody sprawdza głównie zimno** | Klasyfikator bez żadnych danych o Marsie przechodzi test (Suche Doliny 98, Devon 91) | Test jest za słaby, potrzeba więcej znanych analogów |

**Jedyna temperatura porównywalna wprost:** letnie maksimum dobowe. Na 6 z 7 miejsc na Marsie wynosi −7…−12 °C (Hellas +2 °C), a Ziemia to osiąga.

## 2. PCA: ile niezależnej informacji mamy

| zestaw cech | PC1 | PC2 | PC3 | PC4 |
|---|---|---|---|---|
| 8 cech z CCI | **81 %** | 13 % | 4 % | – |
| 9 cech: CCI + ERA5 + opady + NDVI, wszystkie komórki | 65 % | 13 % | 8 % | 6 % |
| to samo, tylko komórki z GST ≤ −5 °C | 61 % | 11 % | 10 % | 8 % |

- **PC1 = „zimno + sucho + bez roślin + płytki lód”.** W przyrodzie te cechy chodzą w parze, więc opady i NDVI też niosą informację o zimnie.
- Osobny kierunek tworzy **duża amplituda dobowa + mało opadów + brak roślin**. To wysokie zimne pustynie (Tybet, Pamir).
- Dodanie ERA5 i suchości wnosi **nową informację**: zamiast jednej osi są 4.
- Grupowanie k-means (6 grup) rozdziela Suche Doliny, Devon i Alaskę do różnych grup.

**Decyzja:** PCA służy do **sprawdzania cech** (czy nowa cecha to nowa informacja), a **nie do liczenia wyniku**. Wybielenie daje pełną wagę każdej niezależnej osi, także osi z błędu albo z kilku nietypowych komórek.

## 3. Filtr zimna zamiast porównywania temperatury

Porównywanie percentyli temperatury nie ma sensu: „średnio zimno” na Marsie (−40 °C) i „średnio zimno” na Ziemi (−10 °C) to różne rzeczy. Temperatura służy więc jako **filtr**.

| filtr GST | komórek | uwagi |
|---|---|---|
| ≤ −5 °C | 127 tys. | ALT jeszcze się różni (mediana 0,40 m) |
| ≤ −10 °C | 57 tys. | 31 % to Antarktyda |
| ≤ −20 °C | 13 tys. | **sama Antarktyda, wszystkie cechy identyczne**, nie ma czego porównywać |

## 4. Dwa rodzaje analogów

Wynik oparty na odległości od „marsjańskiego rogu” przestrzeni cech (opady → 0, NDVI → 0, amplituda → Mars) przeszedł test (Suche Doliny 99, Devon 91, Alaska 0). Najlepsze komórki to jednak prawie wyłącznie **Tybet / Aksai Chin**: duża amplituda, ale średnie maksimum dobowe +7 °C. Z top 2000 pipeline'u pokrywa się tylko 12 komórek.

| typ analogu | podobny do Marsa pod względem | gdzie |
|---|---|---|
| **polarna pustynia** | stały mróz, sucho, płytki lód | Antarktyda, północna Grenlandia, Arktyka Kanady |
| **wysoka zimna pustynia** | duże dobowe wahania, brak roślin | Tybet, Pamir, Karakorum |

**Pod odwierty pasuje polarna pustynia.** Wahania dobowe gasną w gruncie e-krotnie co ~15–20 cm, a na 1 m zostaje z nich < 1 %. Amplituda jest więc bez znaczenia dla próbki z odwiertu. Do tego w Tybecie latem rozmarza 0,2–0,5 m gruntu, czyli lód przechodzi przez wodę ciekłą. **Amplitudę usunięto z oceny.**

## 5. Model ilości lodu

Na odwiertach najbardziej brakuje danych o **ilości lodu**. CCI mówi tylko, *czy* jest zmarzlina.

- **Model:** gradient boosting przewiduje klasę lodu GGD318 (górne 10–20 m) z 9 cech dostępnych na całej siatce.
- **Dane uczące:** 305 936 komórek z półkuli N.

| model | zbalansowana trafność | AUC „wysoka vs reszta” |
|---|---|---|
| **gradient boosting** | **0,68** | **0,85** |
| regresja logistyczna | 0,56 | 0,67 |
| zgadywanie | 0,33 | 0,50 |

- W każdej klasie trafia 64–73 % komórek. Najważniejsze cechy: opady, T 10 m, dobowe maksimum.
- Devon (model go nie widział): przewidziane P(wysoka) = 0,91, mapa mówi 90 %.
- **Antarktyda: 94 % komórek poza zakresem danych uczących.** Model zgaduje tam w ciemno, więc jego wartość lodu dla Antarktydy jest bez znaczenia.

## 6. Wynik „pod odwierty” i porównanie z `out/`

- **Filtry:** T 10 m ≤ −5 °C i ALT ≤ 0,5 m (zostaje 72 066 komórek).
- **Ocena:** równe wagi czterech percentyli: zimno w głębi, płytko do lodu, ilość lodu (model), mało opadów.

| test (mediana percentyla) | pipeline 0–1 m | pipeline 1–5 m | **pod odwierty** |
|---|---|---|---|
| Suche Doliny (≥ 90) | 97 ✓ | 92 ✓ | **99 ✓** |
| Devon (≥ 90) | 84 ✗ | 92 ✓ | **94 ✓** |
| Alaska, mokra tundra (< 50) | 59 ✗ | 68 ✗ | **0 ✓** (85 % jej komórek odpada na filtrach) |

Gdzie są najlepsze komórki (top 2000; wspólnych z pipeline'em 1–5 m: **0**):

| region | pipeline 1–5 m | pod odwierty |
|---|---|---|
| Arktyka Kanady (Banks, Victoria Island) | 1 993 | 28 (Ellesmere) |
| Antarktyda (Ziemia Wiktorii, Góry Transantarktyczne) | 2 | 1 783 |
| północna Grenlandia (Peary Land) | 1 | 189 |

**Zastrzeżenie:** Antarktyda wygrywa częściowo z powodów niepewnych. ALT = 0 m w CCI to znane zaniżenie, a ilość lodu jest tam ekstrapolowana. CCI nie odróżnia też **suchej zmarzliny** (zamarznięta, bez lodu) od gruntu scementowanego lodem. **Antarktyda zostaje w wynikach**, ale cecha „ilość lodu” powinna tam mieć wartość „brak danych” (wynik z 3 pozostałych cech), dopóki nie dojdą dane z literatury.

## 6a. Zasięg: Andy i mapa PZI

CCI nie obejmuje Ameryki Południowej ani obszarów poniżej 25°N. Wypada więc **sucha, wysokogórska zmarzlina Andów** (Puna de Atacama), klasyczny analog Marsa. Uzupełnienie: **Global Permafrost Zonation Index** (Gruber 2012, 1 km, publiczny). Zawiera też MAAT, czyli temperaturę powietrza przeliczoną z uwzględnieniem wysokości (model terenu SRTM).

- PZI zgadza się z maską CCI w 88 % komórek półkuli N.
- Nowe względem maski CCI:

  | skąd | komórek 0,1° | zimne i suche (MAAT ≤ −5 °C, opady < 300 mm) | ocena |
  |---|---|---|---|
  | **Andy 22–35°S** | **463** (12 tys. km² zmarzliny) | **127** | ✅ dodać |
  | lądolód Grenlandii, lodowce | ok. 44 tys. | ok. 23 tys. | ❌ lód, a nie grunt |
  | tajga Syberii / Mongolii | ok. 27 tys. | 20 | ❌ PZI nie widzi izolacji śniegiem |

- Ojos del Salado: 917 km² zmarzliny w oknie 0,5°, najzimniejszy piksel −13,9 °C, 275 mm opadów. Llullaillaco: −12,7 °C, 178 mm.
- **Temperatura z ERA5 w górach jest błędna.** Komórka 0,1° ma wygładzoną rzeźbę terenu: Ojos del Salado wychodzi +3,9 °C, a szczyt ma −13,9 °C. Nawet po poprawce o wysokość filtr −5 °C przechodzi 0–11 % andyjskich pikseli zmarzliny (z MAAT: 90 %). W górach do filtrowania trzeba używać MAAT, a nie ERA5.
- Uśrednianie CCI do 0,1° prawie niczego nie ukrywa: poza maską tylko 11 komórek ma ≥ 5 km² pikseli 1 km z płytkim lodem. Natomiast **20 % komórek maski (76 tys.) nie ma ani jednego takiego piksela**, więc maskę dla 0–1 m warto zawęzić.

## 6b. Wynik „pod odwierty” na siatce 1 km

- **Maska:** piksele CCI 1 km z PFR ≥ 50 %, a poza zasięgiem CCI piksele PZI ≥ 0,5. Razem 25,3 mln pikseli, liczone ok. 50 s.
- **Temperatura gruntu:** CCI T 10 m, a w Andach MAAT + 2 °C (założenie).
- **Filtry:** T ≤ −5 °C, ALT ≤ 0,5 m (tam, gdzie ALT znamy). Zostaje 6,3 mln pikseli, w tym 6,4 tys. w Andach.
- **Ocena:** jak w §6. Opady i ilość lodu z modelu skopiowane z komórek 0,1°.

| wariant braków danych | Suche Doliny | Devon | Alaska | top 20 000 pikseli |
|---|---|---|---|---|
| brak pominięty | 99,5 ✓ | 94,1 ✓ | 0 ✓ | 100 % Antarktyda (Góry Transantarktyczne, ok. −35 °C) |
| brak = 0 (zasada zespołu) | 98,6 ✓ | 96,0 ✓ | 0 ✓ | 94 % Arktyka Kanady (Ellesmere, Axel Heiberg, ok. −16 °C, ALT 0,1 m), 6 % Grenlandia |

- **Zasada braków danych przestawia czołówkę między kontynentami** (zero wspólnych pikseli). To decyzja zespołu.
- **Andy są w rankingu, ale nie w czołówce.** Najlepsze piksele: Llullaillaco, 94. percentyl (brak = 0: 83.); Ojos del Salado, 457 km², 92. percentyl (81.). Powód: Andy to „ciepła” zmarzlina (−8 do −12 °C) i mają tylko 2 z 4 cech. W jednym wspólnym rankingu zawsze wygrywa najzimniejsze miejsce, dlatego warto pokazywać **osobne listy: analogi polarne i wysokogórskie**.

## 7. Jak walidujemy

| co | na czym | ograniczenia |
|---|---|---|
| **model lodu** | walidacja przestrzenna 5 × (bloki 5° × 5°) na etykietach GGD318, półkula N | Sprawdza zgodność z mapą z 1997 r., a nie z prawdziwym lodem. Bloki się stykają. W Antarktydzie brak etykiet. |
| **wynik** | test zespołu (`pipeline/validate.py`): Suche Doliny i Devon ≥ 90. percentyl, Alaska < 50 | Tylko 3 regiony. Test nagradza zimno. Alaska odpada głównie na filtrach. |

## Decyzje

- Sól i zasolenie poza projektem (warunki na Ziemi nieporównywalne).
- Temperatura jako **filtr**, a nie porównanie percentyli.
- **Amplituda dobowa poza oceną** (bez znaczenia na głębokości odwiertu).
- PCA tylko do diagnozy cech.
- **Antarktyda zostaje w wynikach.**
- Model ML: **przewidywanie ilości lodu** (dużo prawdziwych etykiet), a nie klasyfikator „analog / nie analog” (3 regiony testowe to za mało).

## Otwarte sprawy / następne kroki

1. Ilość lodu w Antarktydzie: oznaczyć jako brak danych, potem uzupełnić z mapy typów zmarzliny Suchych Dolin (Bockheim i in. 2007).
2. Lepsze dane o lodzie dla półkuli N: mapa lodu gruntowego Kanady (O'Neill i in. 2019), baza jedomy (IRYP, Strauss i in.).
3. Mocniejsza walidacja:
   - więcej znanych analogów odwiertowych (University Valley, Beacon Valley, Axel Heiberg, Svalbard),
   - dane punktowe GTN-P (otwory) i CALM (warstwa czynna), m.in. do sprawdzenia ALT = 0 w Antarktydzie.
4. Przeniesienie modelu lodu do `pipeline/` z flagą `extrapolation` w kontrakcie GUI.
5. Odwierty: główną warstwą jest 1–5 m, a 0–1 m opisuje suchą pokrywę nad lodem.
6. Siatka 1 km (maska CCI + PZI, temperatura z CCI/MAAT, bez ERA5 w górach) i osobne listy według typu analogu.
7. Zespół: wybrać zasadę braków danych i progi filtrów.

Raport dla agenta, który ma ulepszyć algorytm: `context/algorithm_improvement_brief_for_agents.md`.

## Pliki

Kod i wyniki są lokalnie, poza repo (zgodnie z zasadą „w repo tylko markdown”):

- `ml_probe/`: `probe.py` (korelacje, remisy, k-means), `distributions.py`, `pca.py`, `pca2.py`, `score_pca.py`, `ice_model.py`, `mountain_fine.py` (CCI 1 km w górach), `pzi_extend.py` (PZI, Andy), `grid1km.py` (wynik na siatce 1 km)
- PZI: https://microsite.geo.uzh.ch/cryodata/pf_global/ (`PZI.flt`, `MAAT_MEAN.flt`, po 3,1 GB)
- `output_ml/`: wykresy PNG, `*_metrics.json`, `ice_model_cells.csv.gz` (wynik dla każdej komórki)
