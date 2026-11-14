# Phoenix Mars Lander: przegląd danych i potencjał dla naszych 4 parametrów

Data: 2026-11-14
Zakres: misja Phoenix (NASA, 2008), archiwum NASA PDS. Ocena pod kątem naszych czterech parametrów: **pęknięcia/wzory (poligony)**, **sól**, **temperatura**, **zmarzlina**.

## TL;DR

- Phoenix to **najlepszy pojedynczy zestaw danych z Marsa dla naszych 4 parametrów naraz**. To jedyne miejsce na Marsie, gdzie z powierzchni zmierzono jednocześnie wzory poligonalne, sole (w tym perchloran), temperaturę i lód w gruncie.
- Lądownik stał na równinie Vastitas Borealis (Green Valley), w punkcie **68,22°N, 125,7°W (234,3°E)**, ok. −4,1 km poniżej poziomu odniesienia Marsa. Działał przez **152 sole** (25.05–28.10.2008), w porze od późnej wiosny do lata na półkuli północnej (Ls 77–148). **Brak danych zimowych.**
- **Temperaturę przeliczyłem sam z surowych danych** (stacja MET, 141 plików, 143 pełne sole). Wynik: średnio −85 °C w nocy i −28 °C w dzień. **Ani razu powyżej 0 °C.** Szczegóły w §2.3.
- Dane o soli i lodzie to **pojedyncze próbki** (kilka próbek gleby i kilka wykopów). Dla nas są wartościami referencyjnymi z publikacji, nie mapą.
- Najważniejszy wniosek dla wyszukiwania na Ziemi: poligony na Phoenix powstają **bez topnienia**, przez kurczenie termiczne suchej, zamarzniętej gleby. Ziemski analog to więc **zimna i sucha zmarzlina z solami**, a nie mokra tundra. To mocno zawęża, gdzie szukać (§4).

## 1. Co jest w archiwum i gdzie

| Instrument | Co mierzy | Nasz parametr | Archiwum (PDS) | Forma danych |
|---|---|---|---|---|
| **MET** (stacja meteo, Kanada/CSA) | temperatura powietrza na 0,25 / 0,5 / 1 m, ciśnienie, co 2 s | temperatura | [PDS Atmospheres – MET](https://atmos.nmsu.edu/data_and_services/atmospheres_data/phoenix/met.html) | tabele ASCII (PDS4); uśrednienia 512 s w plikach `*RML_*.TAB` (~9 MB za całą misję) |
| **LIDAR** (część MET) | chmury lodowe, opad śniegu, pył | temperatura / zmarzlina (cykl wody) | [PDS Atmospheres – LIDAR](https://atmos.nmsu.edu/data_and_services/atmospheres_data/phoenix/lidar.html) | profile |
| **MECA–WCL** (Wet Chemistry Lab) | rozpuszczalne sole: ClO₄⁻, Cl⁻, SO₄²⁻, Mg²⁺, Na⁺, K⁺, Ca²⁺, pH, przewodność | **sól** | [PDS Geosciences – MECA](https://pds-geosciences.wustl.edu/missions/phoenix/meca.htm) | napięcia elektrod (EDR/RDR); kilka próbek |
| **MECA–TECP** (sonda w gruncie) | temperatura i przewodność cieplna gleby, wilgotność względna | temperatura, zmarzlina | jw. | szeregi czasowe |
| **TEGA** (piec i spektrometr mas) | lód wodny, węglany, uwalniane gazy | **zmarzlina**, sól (węglany) | [PDS Geosciences – TEGA](https://pds-geosciences.wustl.edu/missions/phoenix/tega.htm) | szeregi czasowe; kilka próbek |
| **RA / RAC** (ramię i kamera ramienia) | wykopy (Dodo-Goldilocks, Snow White), lód pod gruntem | **zmarzlina** | [PDS Geosciences – RA](https://pds-geosciences.wustl.edu/missions/phoenix/index.htm), RAC w PDS Imaging | obrazy, pozycje ramienia |
| **SSI** (kamera stereo) | panoramy, poligony i rowy w skali metrów | **pęknięcia/wzory** | PDS Imaging (Planetary Image Atlas) | obrazy, stereo |
| **HiRISE** (MRO, z orbity) | poligony 2,5–25 m w całym regionie | **pęknięcia/wzory** | PDS Imaging / HiRISE | obrazy ~0,25–0,3 m/piksel; numeryczny model terenu |

Wyszukiwarka całego archiwum: [Phoenix Analyst's Notebook](http://an.rsl.wustl.edu/phx/).
Uwaga: w lipcu 2026 dane MECA i TEGA przeniesiono do formatu PDS4, więc stare ścieżki PDS3 mogą nie działać.

## 2. Ocena per parametr

### 2.1 Pęknięcia / wzory (poligony): potencjał **wysoki**

- Poligony są na całym obszarze lądowania. Z orbity policzono **915 poligonów o średniej średnicy 4,6 m** (najmniejsze ~2,5 m, ograniczenie rozdzielczości). Z powierzchni opisano poligony 3–6 m. Widać też starszy, słabszy system większych poligonów z rowami co ~22 m.
- Rowy między poligonami mają średnio **~17 cm głębokości**, a teren jest prawie płaski (średnie nachylenie 6,7°).
- Mechanizm: **kurczenie termiczne zamarzniętej gleby** (w obecnych warunkach bez wody w stanie ciekłym, por. §2.3).
- **Wartości referencyjne dla porównań:** średnica poligonu 2,5–6 m (mediana ~4,6 m), drugi poziom ~20–25 m, głębokość rowu ~0,17 m, nachylenie <7°.
- **Problem dla porównania z Ziemią:** poligony 3–6 m są **niewidoczne w Sentinel-2 (10 m) i Landsat (30 m)**. Potrzebne są obrazy submetrowe albo model terenu ~2 m (np. ArcticDEM / REMA dla Antarktydy). W Google Earth Engine wybór takich danych jest ograniczony, więc w skali globalnej ten parametr trzeba będzie mierzyć pośrednio (np. tekstura terenu) albo tylko na wybranych kandydatach.

### 2.2 Sól: potencjał **wysoki** (jako wartości referencyjne)

Z analiz WCL i TEGA:
- **Perchloran ClO₄⁻: ~0,4–0,6% masy gleby.** To najważniejsze odkrycie Phoenix. Perchloran obniża temperaturę zamarzania solanek i jest toksyczny dla ludzi, więc liczy się też dla przyszłej bazy.
- **pH 7,7 ± 0,3–0,5** (lekko zasadowe, buforowane węglanem).
- Kationy: głównie **Mg²⁺ i Na⁺**, mniej K⁺ i Ca²⁺. Aniony: także Cl⁻ i HCO₃⁻.
- **Siarczany:** w abstrakcie Hecht 2009 tylko „możliwie”. Późniejsza praca Kounaves et al. 2010 (GRL) podaje rząd ~1 wt%. *Wartość do potwierdzenia w źródle, jeśli chcemy jej użyć.*
- **Węglan wapnia (TEGA): ~3–5 wt%** (Boynton et al. 2009).
- Ograniczenie: kilka próbek z kilku metrów kwadratowych. To punkt odniesienia, nie mapa. Do mapowania soli na Marsie w skali regionalnej trzeba sięgnąć po dane orbitalne (CRISM/OMEGA, mapy chlorków). To poza zestawem Phoenix.
- **Porównanie z Ziemią:** perchloran występuje naturalnie w ilościach porównywalnych z Marsem tylko w kilku miejscach: na pustyni Atakama (złoża azotanów) i w glebach Suchych Dolin Antarktydy. Inne miejsca to słaby analog „chemiczny”, nawet jeśli są słone.

### 2.3 Temperatura: potencjał **wysoki** (dane przeliczone przeze mnie)

Źródło: MET, pliki uśrednione co 512 s (`*RML_*.TAB`), czujnik na wysokości **1 m** (temperatura **powietrza**, nie gruntu). Przeliczenie: `analysis/phoenix/phx_met_analyze.py`. Wynik dla każdego sola: `analysis/phoenix/phoenix_met_daily.csv`.

| Wielkość (143 pełne sole) | K | °C |
|---|---|---|
| Minimum dobowe: średnio | 188,5 | **−84,7** |
| Minimum dobowe: najniższe (koniec misji) | 175,4 | −97,8 |
| Maksimum dobowe: średnio | 245,6 | **−27,6** |
| Maksimum dobowe: najwyższe | 253,5 | −19,7 |
| Średnia dobowa | 216,3 | −56,9 |
| **Amplituda dobowa** | średnio **57 K** (zakres 50–66 K) | |
| Liczba pomiarów powyżej 0 °C | **0** | |

- Przebieg doby: najzimniej ok. **02:00** czasu lokalnego (~−84 °C), najcieplej **14:00–16:00** (~−36 °C, średnia godzinowa).
- **Trend sezonowy:** w solach 0–90 minima ~−82 °C, a w solach 120–151 już ~−93 °C, bo zbliżała się jesień. Ciśnienie spadło z **~840 Pa do ~730 Pa**, bo CO₂ zamarza na biegunie południowym.
- Przy gruncie jest cieplej w dzień: czujnik na 0,25 m pokazuje w południe średnio ~1 K więcej niż ten na 1 m.
- **Wniosek:** w lecie arktycznym na Marsie temperatura powietrza ani razu nie przekroczyła 0 °C, więc **nie ma cyklu zamarzania i rozmarzania**. Lód zanika przez **sublimację**, nie topnienie. To jest kluczowe kryterium dla analogu ziemskiego.
- **Uwaga przy porównaniu z Ziemią:** MODIS LST mierzy **temperaturę powierzchni gruntu**, a MET temperaturę **powietrza na 1 m**. Nie porównujmy ich 1:1. Albo bierzemy temperaturę powierzchni Marsa z orbity (THEMIS/TES, Mars Climate Database), albo porównujemy pochodne: amplitudę dobową, odsetek godzin poniżej 0 °C, liczbę przejść przez 0 °C.
- Żadne miejsce na Ziemi nie osiąga −85 °C średnio co noc latem, więc tak jak w naszym projekcie traktujemy temperaturę jako parametr „im bliżej Marsa, tym lepiej” (percentyl na Ziemi).

### 2.4 Zmarzlina / lód w gruncie: potencjał **wysoki**

- Pod warstwą luźnej, suchej gleby leży **płytki lód**: średnio **4,6 cm** głębokości (Mellon et al. 2009), w zakresie **5–18 cm** w wykopach w środku i na skraju poligonu (Smith et al. 2009). W rowach między poligonami lodu nie znaleziono do ~20 cm.
- **~90% lodu to gleba cementowana lodem** (lód w porach). Lokalnie występuje prawie czysty lód. W wykopie Dodo-Goldilocks jasne kawałki lodu **sublimowały w ciągu kilku soli**, co jest widoczne na zdjęciach.
- TEGA potwierdziła, że to **lód wodny**. LIDAR zarejestrował **opad śniegu** (kryształki lodu z chmur), który wyparował, zanim dotarł do gruntu.
- **Wartości referencyjne:** głębokość stropu lodu 2–18 cm, sucha warstwa przykrywająca, lód w porach, brak warstwy sezonowo rozmarzającej (w sensie ziemskim).
- **Porównanie z Ziemią:** to jest **„sucha zmarzlina”**, a nie typowa zmarzlina tundrowa z grubą warstwą sezonowo rozmarzającą. Najbliższe znane odpowiedniki to strefa górna Suchych Dolin Antarktydy (np. University Valley, z lodem kilkadziesiąt cm pod gruntem). Na mapach globalnych (ESA CCI Permafrost: temperatura gruntu, głębokość warstwy rozmarzającej, 1 km) szukamy miejsc z **bardzo cienką warstwą rozmarzającą i małymi opadami**.

## 3. Wektor referencyjny „Phoenix” do naszego modelu podobieństwa

Proponuję wpisać Phoenix jako jedną stronę marsjańską w `mars_sites.csv`:

| Parametr | Wartość Phoenix | Typ porównania |
|---|---|---|
| wzory: średnica poligonu | 2,5–6 m (mediana 4,6 m); drugi system ~20–25 m | dopasowanie wartości (tylko tam, gdzie mamy dane o wysokiej rozdzielczości) |
| wzory: obecność poligonów termicznych | tak, pokrywają cały teren | obecność / brak |
| sól: perchloran | 0,4–0,6 wt% | obecność / siła (perchloran = rzadki na Ziemi) |
| sól: pH | 7,7 | dopasowanie wartości |
| sól: dominujące kationy | Mg²⁺, Na⁺ | obecność |
| sól: węglany | CaCO₃ 3–5 wt% | obecność |
| temperatura: amplituda dobowa (powietrze 1 m) | 57 K | „im bliżej, tym lepiej” |
| temperatura: max dobowe | −28 °C (nigdy >0 °C) | „im zimniej, tym lepiej” / brak rozmarzania |
| temperatura: min dobowe | −85 °C | „im zimniej, tym lepiej” |
| zmarzlina: głębokość lodu | 2–18 cm | dopasowanie (im płycej, tym lepiej) |
| zmarzlina: typ | lód w porach + lokalnie czysty lód, sucha warstwa przykrywająca | obecność |
| środowisko: opady (dla Ziemi) | ~0 (tylko śnieg sublimujący) | „im suszej, tym lepiej” |

## 4. Co z tego wynika dla wyszukiwania na Ziemi

Wszystkie cztery parametry Phoenix wskazują razem na jeden typ środowiska: **zimną, hiperaridną zmarzlinę z poligonami kontrakcyjnymi i solami w glebie**. Ziemskie miejsca, które warto sprawdzić naszymi danymi:
- **Znane (do walidacji):** Suche Doliny McMurdo, szczególnie University Valley i Beacon Valley. Dla perchloranu częściowo też Atakama, ale ona nie ma zmarzliny.
- **Mniej znane (do sprawdzenia danymi, na razie hipotezy):** płaskowyż **Changtang/Qiangtang w Tybecie** (zmarzlina, słone jeziora, mało opadów, wysoko), **kotlina Qaidam** od strony zmarzliny, wysokie **Andy na granicy Chile i Argentyny** (np. rejon Ojos del Salado: zmarzlina nad 5000 m plus salary), wysoka Arktyka Kanady (**wyspa Axel Heiberg**, gdzie źródła solankowe płyną przez zmarzlinę), suche obszary **Jakucji / Mongolii**.
- **Gdzie analogia się łamie:** ciśnienie (~7–8 hPa vs 1013 hPa, więc na Ziemi lód topnieje zamiast sublimować), brak poziomu −85 °C w nocy latem, promieniowanie UV, grawitacja.

## 5. Ryzyka i ograniczenia danych

1. **Brak zimy:** lądownik nie przetrwał zimy, więc mamy tylko lato. Wartości zimowe trzeba wziąć z modeli, np. z Mars Climate Database.
2. **Dane punktowe:** sól i lód to kilka próbek z kilku m². Pasują jako wartości referencyjne, nie jako mapa.
3. **Rozdzielczość wzorów:** poligony 3–6 m wymagają obrazów submetrowych. W globalnej siatce 5 km nie da się ich wykryć bezpośrednio.
4. **Powietrze vs grunt:** MET mierzy powietrze, MODIS mierzy powierzchnię (§2.3).
5. **Surowe dane WCL/TEGA** wymagają kalibracji. Szybciej użyć liczb z publikacji niż przeliczać wszystko od zera w 24 h.
6. Jeden plik MET (sol 72) ma błędny czas lokalny w spisie archiwum, więc go pominąłem. Na wyniki to nie wpływa.

## 6. Proponowane następne kroki

1. Dodać Phoenix z wektorem z §3 do listy stron marsjańskich.
2. Dla temperatury pobrać temperaturę **powierzchni** w miejscu lądowania z THEMIS/TES albo Mars Climate Database, żeby porównywać ją z MODIS LST na Ziemi.
3. Sprawdzić dane ESA CCI Permafrost i opady (CHIRPS/ERA5) dla kandydatów z §4.
4. Dla 2–3 najlepszych kandydatów zrobić ręczny pomiar poligonów na obrazach o wysokiej rozdzielczości i porównać średnice z 4,6 m.

## Pliki w tym folderze

- `phx_met_fetch.py`: pobiera spis i wszystkie pliki MET `*RML_*.TAB` z PDS (`python -I phx_met_fetch.py <folder>`).
- `phx_met_analyze.py`: liczy statystyki dla każdego sola (`python -I phx_met_analyze.py <folder> <wynik.csv>`).
- `phoenix_met_daily.csv`: wynik dla każdego sola: zakres pomiarów, Ls, temperatura (min, max, średnia, amplituda) na 1 m, ciśnienie.

## Źródła

- NASA PDS Geosciences Node, Phoenix: https://pds-geosciences.wustl.edu/missions/phoenix/index.htm (MECA, TEGA, RA)
- NASA PDS Atmospheres Node, Phoenix MET: https://atmos.nmsu.edu/data_and_services/atmospheres_data/phoenix/met.html
- Smith P.H. et al. (2009), *H₂O at the Phoenix Landing Site*, Science 325
- Mellon M.T. et al. (2009), *Ground ice at the Phoenix Landing Site* oraz *The periglacial landscape at the Phoenix landing site*, JGR 114 ([abstrakt](https://experts.arizona.edu/en/publications/periglacial-landforms-at-the-phoenix-landing-site-and-the-norther/))
- Hecht M.H. et al. (2009), *Detection of perchlorate and the soluble chemistry of martian soil at the Phoenix lander site*, Science 325 ([abstrakt](https://experts.arizona.edu/en/publications/detection-of-perchlorate-and-the-soluble-chemistry-of-martian-soi/))
- Kounaves S.P. et al. (2010), Environ. Sci. Technol. 44 ([PDF](https://planetary.chem.tufts.edu/Kounaves%20etal%20ES&T%202010v44p2360.pdf)); Kounaves et al. (2010) GRL o siarczanach
- Boynton W.V. et al. (2009), *Evidence for calcium carbonate at the Mars Phoenix landing site*, Science 325
- Catling D.C. et al. (2010), perchloran: Atakama vs Mars ([PDF](https://faculty.washington.edu/dcatling/Catling2010_AtacamaMarsPerchlorate.pdf))
