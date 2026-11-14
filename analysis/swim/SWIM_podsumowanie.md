# SWIM — podsumowanie zbioru danych

**SWIM (Subsurface Water Ice Mapping on Mars)** to projekt NASA/JPL realizowany przez Planetary Science Institute. Mapuje lód wodny ukryty pod powierzchnią Marsa, czyli marsjańską wieczną zmarzlinę, w pasie **60°S–60°N**. Celem jest wskazanie miejsc, gdzie przyszłe misje i astronauci znajdą lód najbliżej równika i najpłycej.

- Źródło: <https://swim.psi.edu> (zakładka *Products*), pliki publicznie dostępne bez logowania.
- Publikacja referencyjna: Morgan, Putzig i in. (2025), *Planet. Sci. J.* 6:29, doi:10.3847/PSJ/ad9b24.

---

## 1. Z czego składa się zbiór

### Format i wartości

| cecha | wartość |
|---|---|
| format | GeoTIFF, 1 pasmo, float32 |
| siatka | 0,05° (≈ 3 km), 7200 × 2400 pikseli, rzut walcowy równoodległościowy (Mars 2000, sfera) |
| zasięg | 180°W–180°E, 60°S–60°N |
| wartość piksela | **wskaźnik zgodności z lodem C ∈ [−1, +1]** |
| brak danych | −30 lub −3,4·10³⁸ |

Wskaźnik zgodności C **nie jest ilością lodu**. Mówi tylko, czy dane z danego instrumentu są zgodne z obecnością lodu pod powierzchnią:

- **+1** — dane zgodne z lodem,
- **0** — brak danych lub wynik niejednoznaczny,
- **−1** — dane przeczą obecności lodu.

### Warstwy wejściowe (SWIM 2.0)

| warstwa | instrument | co mierzy | głębokość |
|---|---|---|---|
| Neutron | Mars Odyssey NS | wodór (WEH) w gruncie | ~0–1 m |
| Thermal | TES / THEMIS | bezwładność cieplna; luźna warstwa nad warstwą z lodem | cm–1 m |
| Radar surface | SHARAD | moc odbicia; niska gęstość wskazuje na lód | ~0–5 m |
| Radar dielectric | SHARAD | przenikalność ε′ (≤ 3 oznacza lód, ≥ 7 skałę) | 5–100 m |
| Geomorphology | CTX / HiRISE | formy peryglacjalne i lodowcowe | 0–1 m / > 5 m |

### Warstwy wynikowe (SWIM4MIM)

- **Mapy złożone C_i** dla trzech przedziałów głębokości: 0–1 m, 1–5 m i > 5 m.
- **Mapy 10 form terenu**, m.in. *poligony* (spękania), teren muszelkowy (*scalloped*), lodowce, kratery piedestałowe i płaszcz lodowy. Wartość piksela to odsetek zdjęć z przeglądu, na których widać daną formę.
- **Strefy rozpoznania (Reconnaissance Zones)** — plik shapefile z 5 poligonami o łącznej powierzchni ≈ 15 mln km².

### Dane dodatkowe (spoza SWIM)

- **Sól.** SWIM nie zawiera danych o soli, dlatego dołączono **mapę chloru** ze spektrometru gamma GRS (Mars Odyssey; NASA PDS, siatka 5°). Chlor jest standardowym wskaźnikiem chlorków i nadchloranów.
- **Temperatura.** SWIM nie podaje temperatur, tylko ich interpretację. W analizie użyto więc **jednowymiarowego modelu cieplnego gruntu**:
  - nasłonecznienie wynikające z orbity Marsa,
  - przewodzenie ciepła w gruncie,
  - sezonowa czapa szronu CO₂ (z bilansem ciepła utajonego).

Łącznie ≈ **1,4 GB** danych (22 produkty).

---

## 2. Najważniejsze wyniki

### Wieczna zmarzlina

| głębokość | obszar silnie zgodny z lodem (C > 0,5) | % pasa 60°S–60°N | półkula N / S |
|---|---|---|---|
| 0–1 m | 10,1 mln km² | 8,1 % | 10,7 % / 5,4 % |
| 1–5 m | 5,7 mln km² | 4,5 % | 7,2 % / 1,8 % |
| > 5 m | 1,3 mln km² | 1,0 % | 2,0 % / 0,0 % |

- **Granica lodu.** Lód jest wyraźnie bliżej równika na **półkuli północnej**. Warstwa 0–1 m jest zgodna z lodem (C > 0) od ok. **30°N** i od ok. **35°S**. Silna zgodność (C > 0,5) zaczyna się od **≈ 52°N**, a jej granica zmienia się z długością geograficzną w przedziale 42–58°N.
- **Układ pionowy.** 28 % obszaru jest zgodne z lodem na wszystkich trzech głębokościach. 34 % nie jest zgodne na żadnej. 14 % ma sygnał lodu tylko w warstwie 1–5 m, czyli lód przykryty suchą warstwą.
- **Zgodność instrumentów jest słaba.** Korelacje między warstwami wynoszą r = −0,15 … 0,32. Każdy instrument „widzi” inną głębokość i inną właściwość gruntu, dlatego SWIM łączy je w jedną mapę.
- **Strefy rozpoznania** mają wyższe C_i na głębokości 1–5 m niż otoczenie na tych samych szerokościach: 0,28 wobec 0,21.

### Temperatura

- **Wyniki modelu:**
  - równik: średnio ≈ 224 K (−49 °C), maksimum dobowe ≈ 296 K;
  - minimum 148 K, czyli temperatura szronu CO₂.
- **Stabilność lodu w modelu** (dzisiejszy klimat): lód jest trwały poleward od **≈ 65°** na głębokości 0,5 m i od **≈ 55–57°** na głębokości 1 m.
- **Lód poza strefą stabilności.** SWIM wykrywa lód znacznie bliżej równika niż ta granica. To najpewniej lód reliktowy z okresów większego nachylenia osi Marsa, który powoli sublimuje.
- **Związek temperatury z lodem jest silny.** Korelacja Spearmana średniej rocznej temperatury z C_i (0–1 m) wynosi **ρ = −0,63**. Średnie C_i przekracza 0,5 dopiero poniżej ≈ 190 K.
- **Warstwa termiczna SWIM** zawiera wyłącznie wartości 0…+1, bez klasy „niezgodny”. 19 % obszaru ma wartość dodatnią, reszta wartość 0.

### Sól (chlor z GRS)

- **Zawartość chloru:** średnio 0,49 % wag. (zakres 0,22–0,80 %). Maksimum leży przy równiku, w okolicy 180°E (Medusae Fossae).
- **Mniej chloru tam, gdzie jest lód:**
  - obszary zgodne z lodem: 0,39 %,
  - obszary niezgodne z lodem: 0,50 %.
- **Chlor a wodór.** Chlor koreluje z wodorem z GRS (r = 0,48; po usunięciu wpływu szerokości geograficznej r = 0,37). Wskazuje to na sole uwodnione.
- **Możliwość powstawania solanek.**
  - Na 45°N temperatura w szczycie dnia przekracza punkt eutektyczny NaCl (252 K) przez 61 % marsjańskich dób.
  - Dla nadchloranów Ca i Mg (198–206 K) dzieje się tak przez cały rok.
  - Wskaźnik „okna solankowego” (lód × chlor × czas powyżej eutektyki) jest najwyższy na **≈ 42°N** (Arcadia Planitia, ok. 150–160°W).

### Spękania (grunt poligonalny)

Grunt poligonalny to sieć szczelin powstających, gdy grunt związany lodem kurczy się na mrozie. Jest odpowiednikiem ziemskich klinów lodowych.

- **Zasięg mapowania.** Przegląd poligonów obejmuje tylko pas **≈ 48°S–49°N**. Wartości 0 dalej ku biegunom oznaczają brak przeglądu, a nie brak spękań, i zostały odfiltrowane.
- **Zasięg spękań.** Spękany teren zajmuje **15,6 mln km²**, czyli 62 % przeglądanego obszaru. Występuje od ok. **27°** szerokości na obu półkulach.
- **Wzór przestrzenny:**
  - 47 płatów; 5 największych obejmuje 82 % spękanej powierzchni;
  - rozkład wielkości płatów ma ogon potęgowy, α ≈ 1,4;
  - 90 % spękanej powierzchni układa się w **pasy równoleżnikowe (E–W)**, co wskazuje na kontrolę klimatyczną;
  - długość korelacji E–W jest 2,5 razy większa niż N–S;
  - autokorelacja jest bardzo silna (Moran's I = 0,98 dla sąsiednich komórek).
- **Co sprzyja spękaniom:**
  - **lód.** Gdy C_i > 0,6, spękania widać praktycznie zawsze; przy C_i < 0 tylko w ~37 %;
  - **naprężenia termiczne.** Modelowany stosunek naprężenia do wytrzymałości gruntu przekracza 1 od ok. 25–30° szerokości. Jego korelacja z udziałem spękań wynosi ρ = 0,77.
- **Współwystępowanie z innymi formami.** Poligony występują zwykle razem z płaszczem lodowym (69 %) i terenem teksturowanym (62 %).

---

## 3. Ograniczenia

- Wskaźnik C to **zgodność, nie ilość lodu**. Warstwy różnią się rozdzielczością: GRS ma 5°, a SWIM 0,05°.
- Model cieplny przyjmuje stałe albedo (0,25) i stałą bezwładność cieplną (250). Nie uwzględnia stoków, pyłu ani atmosfery, więc jest przybliżeniem pierwszego rzędu.
- W rozdzielczości SWIM (3 km) widać tylko *gdzie* jest teren spękany. Geometria pojedynczych szczelin (5–30 m), np. rozmiar poligonów i udział złączy typu T (sieć młoda) i Y (sieć dojrzała), wymaga zdjęć HiRISE (0,25 m/px).
- Próba automatycznego wykrycia sieci szczelin na fragmencie HiRISE z rejonu lądowania Phoenix (PSP_001880_2485) dała **niewiarygodny wynik**. Rynny są tam subtelne i oświetlone z jednej strony, a w kadrze widać linie szwów.
