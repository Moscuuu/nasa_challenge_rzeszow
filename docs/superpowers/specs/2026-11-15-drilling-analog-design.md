# Analogi do wiercenia w lodzie: specyfikacja (stan obowiązujący)

Data: 2026-11-15. Zastępuje `2026-11-14-permafrost-analog-analysis-design.md` (tamten plik zostaje jako historia przebiegów 1–8).
Pojęcia: `GLOSSARY.md`. Kontrakt z GUI: `docs/contracts/analysis-to-gui/CONTRACT.md` (0.9). Rejestr decyzji: `docs/DECISIONS.md`. Progi: `pipeline/config.py`.

## 1. Teza

Wskazać **miejsca na Ziemi do testów wiercenia w lodzie gruntowym takim jak w wybranych miejscach na Marsie** (7 Kandydackich Miejsc Bazy).

Na każdym z tych miejsc lód leży pod suchą pokrywą, nigdy nie rozmarza, a grunt jest zimniejszy niż gdziekolwiek na Ziemi. Dlatego Mars **wyznacza warunki** (filtry i kierunek cech), a nie jest dopasowywany rankingiem.

## 2. Dlaczego nie porównanie rankingowe

Wyniki analizy z 2026-11-14 (`analysis/ml_model/ML_ANALIZA_podsumowanie.md`):

- Grunt w głębi: Mars 200–203 K, najzimniejsza Ziemia 234 K. „Najbliżej Marsa" znaczyło „najzimniej na Ziemi".
- Cechy powtarzały tę samą informację (temperatury ρ ≥ 0,96; potencjał pękania = GST; lód > 5 m = PFR).
- Dopasowanie percentyli lodu 1–5 m nagradzało słabszą zmarzlinę (Arcadia, Amazonis).
- Amplituda dobowa gaśnie w gruncie po ~15–20 cm, więc dla odwiertu nie ma znaczenia.

Usunięte z oceny: temperatura porównywana rankingiem, amplituda, spękania (szacowane z temperatury), dopasowanie percentyli lodu.

## 3. Maska

- **Podstawa: Global Permafrost Zonation Index** (Gruber 2012, 1 km). Komórka 0,1° jest komórką zmarzliny, gdy ≥ 10 % jej pikseli ma PZI ≥ 0,5.
- **PZI kończy się na 60°S.** Antarktyda zostaje na masce ESA Permafrost CCI (średni PFR ≥ 10 %).
- PZI obejmuje też lądolody i ciepły grunt. Usuwają je filtry (§4), nie maska.
- Wynik: 401 614 komórek.

## 4. Filtry

Komórka wchodzi do rankingu tylko, gdy przejdzie wszystkie:

| filtr | próg | po co |
|---|---|---|
| temperatura gruntu w warstwie | ≤ −5 °C | lód pozostaje twardo zamarznięty; zimniej nie znaczy „bardziej jak Mars" |
| grubość warstwy rozmarzającej (ALT) | ≤ 0,5 m, tam gdzie znana | letnie rozmarzanie zostaje w pokrywie, nad lodem |
| udział lata bez śniegu (MODIS) | ≥ 10 % | w komórce jest goły grunt, nie lodowiec |
| udział lodowca / lądolodu (MODIS Land Cover) | < 50 % | nie w Antarktydzie: produkt oznacza tam lodem cały kontynent, z Suchymi Dolinami |

Temperatura gruntu: CCI (GST dla 0–1 m, średnia z 2 i 5 m dla 1–5 m, 10 m dla > 5 m). Poza zasięgiem CCI: temperatura powietrza z PZI + 2 K (założenie).

Warstwa 1–5 m: filtry przechodzi 52 993 komórek, ocenę dostaje 46 195 (reszta nie ma temperatury ERA5, głównie wybrzeża).

## 5. Cechy

Każda 0–1, wyżej = bliżej warunków Marsa.

| cecha (id w kontrakcie) | jak liczona | źródło |
|---|---|---|
| letnia temperatura powierzchni (`temperature`) | `1 − |Ziemia − Mars| / 20 K`, średnie dobowe maksimum w lokalnym lecie, **w kelwinach** | ERA5-Land; Mars: model cieplny |
| głębokość do gruntu, który nie rozmarza (`ground_ice`) | `1 − ALT / 0,5 m` | CCI |
| suchość (`dryness`) | ranking wśród komórek po filtrach, najsuchsza = 1; średnia z opadu rocznego i letniej wilgotności 0–5 cm, tam gdzie każde istnieje | ERA5-Land, NASA SMAP L4 |
| goły grunt latem (`bare_ground`) | udział bezchmurnych obserwacji lata bez śniegu | NASA MODIS MOD10A1 |

- **Letnia temperatura to jedyna cecha różna między miejscami na Marsie.** Albedo (TES, Christensen 2001) i bezwładność cieplna (TES, Putzig i Mellon 2007) są liczone per miejsce, więc maksima letnie wynoszą 264,5–284,8 K (przedtem, ze stałym albedo i bezwładnością, 260,4–276,0 K). Remisy między miejscami są rzadsze, ale różnice rzędu kilku K mieszczą się w błędzie modelu.
- **Miejsce liczy się w warstwie tylko, gdy SWIM pokazuje tam lód (C > 0,1).** W > 5 m odpadają Erebus Montes i Amazonis.
- Śnieg **nie** odróżnia mokrej tundry od suchej zmarzliny (obie są latem bez śniegu). Odróżnia goły grunt od lodowca.
- Ocena ogólna = zwykła średnia cech używanych w danym typie regionu.

## 6. Typy regionów

Nie każda cecha istnieje i jest wiarygodna wszędzie. Komórki są rankowane **w obrębie typu**, na cechach ważnych dla całego typu. Dzięki temu w rankingu nie ma braków danych: nic nie jest zerowane ani pomijane.

| typ | cechy | dlaczego |
|---|---|---|
| `northern` (półkula N w zasięgu CCI) | wszystkie 4 | |
| `antarctic` | bez głębokości rozmarzania | ALT z CCI to tam ~0 m wszędzie (znane zaniżenie) |
| `pzi_only` (poza CCI: Andy, inne góry, luki na wybrzeżu Arktyki) | suchość, goły grunt | brak ALT; ERA5-Land wygładza rzeźbę gór |

Komórka bez cechy wymaganej w jej typie nie dostaje oceny.

## 7. Odporność

Ocena jest przeliczana w 20 wariantach: próg −5 / −10 °C × ALT 0,5 / 1,0 m × (wszystkie cechy lub bez jednej z czterech). `stability` = udział wariantów, w których komórka jest w najlepszych 10 % swojego typu. To druga liczba obok rankingu, nie zamiast niego.

## 8. Obszary

Eksportowane komórki (do 1000 najlepszych w każdym typie) są grupowane: najlepsza wolna komórka zabiera wolne komórki w oknie 5 × 5 wokół siebie. Obszar ma więc najwyżej 5 × 5 komórek. Samotna komórka jest obszarem jednokomórkowym, żadna nie wypada. Punkt obszaru = jego najlepsza komórka.

## 9. Wyniki (warstwa 1–5 m, 2026-11-15)

| typ | ocenionych | czołówka |
|---|---|---|
| `northern` | 42 844 | **Peary Land, północna Grenlandia** (~82°N, 30–37°W): 664 z 1000 najlepszych komórek; grunt −17 °C, ALT 0,0–0,1 m, letnie maksimum −5 °C, opad ~137 mm, odporność ~1,0. Dalej Ellesmere. |
| `antarctic` | 2 478 | Terra Nova Bay (75°S, 163,5°E), dalej rejon McMurdo Sound (78°S, 164–165°E); najwięcej komórek w Górach Królowej Maud (306 z 1000) |
| `pzi_only` | 873 | **Andy, Puna de Atacama** (27–29°S, 69°W; rejon Ojos del Salado), 68 komórek, miejsce 1 w typie; dalej nunataki północnej Grenlandii |

Trzy warstwy dają prawie tę samą listę: różni je tylko temperatura w filtrze i zestaw miejsc na Marsie.

## 10. Test metody

`pipeline/validate.py`. Percentyl liczony **wśród komórek po filtrach, w obrębie typu**. Obok ten sam test dla oceny „samo zimno".

| miejsce | rola | percentyl | samo zimno | wynik |
|---|---|---|---|---|
| Suche Doliny McMurdo (pudełko) | znany analog | 91,3 | 69,9 | ✓ |
| Taylor Valley | znany analog | 95,5 | 54,7 | ✓ |
| Don Juan Pond | znany analog | 92,7 | 75,9 | ✓ |
| Axel Heiberg | znany analog | 87,5 | 91,5 | ✗ |
| University Valley | znany analog | 73,8 | 85,1 | ✗ |
| Beacon Valley | znany analog | 68,4 | 85,5 | ✗ |
| Haughton / Devon (pudełko) | znany analog | 59,9 | 87,1 | ✗ |
| Haughton (punkt) | znany analog | 65,7 | 86,9 | ✗ |
| Eureka | znany analog | 70,2 | 87,6 | ✗ |
| Alaska North Slope, Utqiagvik, Tuktoyaktuk, Duvanny Yar, Adventdalen, Beiluhe | kontrast | 0–21,5 | 0–14,4 | ✓ (6/6) |

**Znane analogi: 3 z 9 powyżej progu 90 (po zmianie modelu Marsa, przedtem 4; Axel Heiberg 94,2 → 87,5). Kontrasty: 6 z 6.** Progów nie dostrajano do testu.

Co z tego wynika:

- **Haughton i Eureka wypadają w środku stawki (60–70).** Powód: powierzchnia nagrzewa się tam latem do ok. +15 °C, czyli ~25 K powyżej miejsc na Marsie. To prawdziwe miejsce, gdzie analogia pęka, a nie błąd metody. „Samo zimno" stawia je wyżej (87).
- **University Valley i Beacon Valley (68–74)** tracą na gołym gruncie: komórka 0,1° uśrednia wąską dolinę z lodem wokół (śnieg-wolne 40 %).
- W Antarktydzie cechy dają więcej niż samo zimno (Taylor 96 wobec 55). W Arktyce Kanady mniej.
- Kontrasty odpadają głównie na filtrach. To cel filtrów, ale test kontrastu jest przez to słaby.
- To kontrola na kilkunastu miejscach, nie dowód podobieństwa do Marsa.

## 11. Ograniczenia

- CCI i ERA5-Land to modele, nie pomiary. Rok 2023 (wyjątkowo ciepły).
- CCI nie odróżnia suchej zmarzliny (bez lodu) od gruntu scementowanego lodem. **Ilość lodu nie jest w ocenie.**
- Korelacje cech wśród ocenionych komórek (Spearman): letnie maksimum ~ goły grunt 0,78 (goły grunt nagrzewa się; te dwie cechy ciągną w przeciwne strony), temperatura gruntu ~ opad 0,67. Zimno nadal częściowo siedzi w suchości.
- Model cieplny Marsa: albedo z TES (Christensen 2001) i bezwładność cieplna z Putzig i Mellon (2007), średnia z okna ±0,5° wokół każdego miejsca. Sprawdzenie na Mars Climate Database v6.2 (lato, maksimum dobowe temperatury powierzchni): model − MCD = −1,7 do −8,2 K dla siedmiu miejsc, średnio −4,6 K (model chłodniejszy). Phoenix: model (powierzchnia, okno misji Ls 77–148) 257,5 K, czujniki MET (powietrze) 245,6 K, czyli tylko dolna granica; szeregu TECP nie pobrano, więc nie ma porównania z pomiarem temperatury gruntu. `summer_tmax` jest dokładne do kilku kelwinów, nie lepiej. Tabela dla każdego miejsca, stare i nowe albedo, TI i `summer_tmax` (stare: 0,25 i 250 wszędzie; zmiana +4,1 do +13,8 K) wraz z MCD: `analysis/mars_tes/MARS_TES_podsumowanie.md`, sekcja „Model vs MCD”.
- `pzi_only`: temperatura gruntu z założenia (powietrze + 2 K), opad ERA5 w górach zawyżony, tylko 2 cechy. Odporność niska (0,5): próg −10 °C usuwa Andy.
- Komórka 0,1° uśrednia doliny ze stokami.

## 12. Nie zrobione

- Ilość lodu jako opis komórki (GGD318 na półkuli N), typologia przez grupowanie.
- Podłoże i rzeźba, dostępność logistyczna, poligony obserwowane na zdjęciach.
- GUI nie jest dostosowane do kontraktu 0.9 (lista zmian w kontrakcie).
- `pipeline/polygon_check.py` nie jest już uruchamiany (eksperyment, `validated: false`).

## 13. Uruchomienie

`pip install -r requirements.txt`, klucz konta serwisowego Earth Engine (`scripts/ee_init.py`), potem `bash pipeline/run_all.sh`. Dane surowe: ~7 GB (PZI 2 × 3,1 GB).
