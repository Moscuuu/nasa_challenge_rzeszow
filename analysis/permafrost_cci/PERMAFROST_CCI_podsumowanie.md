# ESA Permafrost CCI — podsumowanie zbioru danych

**Permafrost_cci** to projekt Europejskiej Agencji Kosmicznej z programu Climate Change Initiative, prowadzony przez Uniwersytet w Oslo. Dostarcza globalne mapy **wiecznej zmarzliny na Ziemi**: temperaturę gruntu na kilku głębokościach, grubość warstwy czynnej i udział zmarzliny w pikselu.

Dane **nie są bezpośrednim pomiarem**. Powstają w modelu cieplnym gruntu CryoGrid, który jest zasilany:
- satelitarną temperaturą powierzchni z MODIS (od 2003 r.),
- reanalizą pogodową ERA5 (w latach 1997–2002 tylko ERA5, skorygowana).

| | |
|---|---|
| Dostęp | archiwum CEDA: <https://dap.ceda.ac.uk/neodc/esacci/permafrost/data/>, bez logowania |
| Wersja | **v5.0** (najnowsza; zawiera też Antarktydę) |
| Okres | 1997–2023, jeden plik na rok i produkt |
| Licencja | ESA CCI Permafrost terms; cytować wg katalogu CEDA |

---

## 1. Z czego składa się zbiór

### Produkty

| produkt | zmienne | jednostka | co oznacza |
|---|---|---|---|
| **GTD** (ground temperature) | `GST`, `T1m`, `T2m`, `T5m`, `T10m` | °C | średnia roczna temperatura gruntu: na powierzchni oraz na 1, 2, 5 i 10 m |
| **ALT** (active layer thickness) | `ALT` | m | grubość warstwy czynnej, czyli maksymalna głębokość letniego rozmarzania |
| **PFR** (permafrost fraction) | `PFR` | % | udział zmarzliny w pikselu (prawdopodobieństwo) |

Każda zmienna ma też pole niepewności (`*_uncertainty`).

### Siatka i regiony

| cecha | półkula północna | Antarktyda |
|---|---|---|
| zasięg | 25°N–85°N | 60°S–85°S, tylko grunt wolny od lodu |
| siatka | 0,01° (≈ 1 km), 6000 × 36000 | 0,01°, 2500 × 36000 |
| obszar z danymi | 24,5 mln km² (domena modelu) | 0,18 mln km² |
| rozmiar pliku za rok | GTD ≈ 360 MB, ALT ≈ 31 MB, PFR ≈ 12 MB | 1–7 MB |

- Format to NetCDF. Na półkuli północnej wartości są zapisane jako spakowane uint16, a w Antarktydzie jako float64.
- Jedna zmienna rozpakowana w pamięci zajmuje kilka GB, dlatego trzeba ją czytać pasami szerokości geograficznej.
- **Domena modelu** obejmuje obszary zimne wraz z ich obrzeżem. 20 % domeny ma PFR = 0, a temperatura powierzchni sięga tam +10 °C.
- **ALT** jest określone tylko tam, gdzie występuje zmarzlina (16,9 mln km²).
- **Braki:** nie ma danych na północ od 85°N. Wnętrze lądolodu Grenlandii i Antarktydy jest pominięte.

Do analizy pobrano ≈ 1,5 GB:
- PFR za wszystkie lata 1997–2023,
- GTD i ALT za lata 2003, 2013 i 2023 (wszystkie z tego samego okresu MODIS),

i uśredniono je do siatki 0,1°.

---

## 2. Najważniejsze wyniki

### Wieczna zmarzlina

- **Powierzchnia zmarzliny na półkuli północnej w 2023 r.:** **12,5 mln km²** (suma PFR × powierzchnia). Region, w którym zmarzlina w ogóle występuje, ma 20,4 mln km².

  | strefa | kryterium | powierzchnia (mln km²) |
  |---|---|---|
  | ciągła | ≥ 90 % | 7,9 |
  | nieciągła | 50–90 % | 4,6 |
  | sporadyczna | 10–50 % | 4,4 |
  | wyspowa | < 10 % | 3,4 |

- **Zanik zmarzliny.** Powierzchnia wynosiła 14,1 mln km² w 2003 r., 13,3 w 2013 r. i 12,5 w 2023 r. Trend dla lat 2003–2023 to **−0,76 mln km² na dekadę (−5,7 %/dekadę)** i jest istotny statystycznie (p < 0,001).
- **Warstwa czynna (2023, półkula północna):**
  - mediana 1,04 m (5. percentyl 0,33 m, 95. percentyl 2,85 m);
  - pogłębia się: średnio 0,97 m w 2003 r., 1,06 w 2013 r. i 1,27 w 2023 r.;
  - w latach 2003–2023 pogłębiła się na **90 % obszaru**.
- **Płytki lód jak u Phoenix** (lód 2–18 cm pod powierzchnią): ALT ≤ 0,18 m występuje tylko na 0,27 mln km² półkuli północnej.
- **Antarktyda:** PFR ≈ 100 % na całym obszarze z danymi. Trend jest praktycznie zerowy.

### Temperatura

- **Temperatura na 10 m** (MAGT), w obszarach z PFR ≥ 50 %:
  - półkula północna: mediana **−3,3 °C**, minimum −20,1 °C;
  - Antarktyda: mediana **−22,6 °C**, minimum −39,1 °C.

- **Klasy termiczne zmarzliny** (temperatura na 10 m):

  | klasa | półkula północna | Antarktyda |
  |---|---|---|
  | ciepła (−2…0 °C) | **35 %** | 3 % |
  | umiarkowana (−5…−2 °C) | 25 % | 3 % |
  | zimna (−10…−5 °C) | 26 % | 8 % |
  | bardzo zimna (−20…−10 °C) | 11 % | 24 % |
  | ekstremalna (< −20 °C) | 0 % | **61 %** |

- **Ocieplenie (2003→2023, średnia z pikseli):**
  - powierzchnia **+2,2 °C**, 1 m +1,6 °C, 10 m **+1,0 °C**;
  - obszar z temperaturą na 10 m ≤ −5 °C zmalał z 5,8 do 4,6 mln km²;
  - w 2013 r. temperatura powierzchni była prawie taka sama jak w 2003 r. (−4,8 °C), więc część skoku powierzchniowego to wyjątkowo ciepły rok 2023;
  - na 10 m temperatura rośnie równo: −4,85, −4,66 i −4,42 °C w trzech kolejnych latach pomiarowych.
- **Grunt głębiej jest zimniejszy niż powierzchnia.** Na półkuli północnej temperatura na 10 m jest średnio o 1,2 °C niższa niż na powierzchni. To ślad niedawnego ocieplenia, które nie dotarło jeszcze w głąb. W Antarktydzie różnica jest bliska 0.
- **Porównanie z Marsem.** Najzimniejszy grunt na Ziemi ma średnią roczną ok. −40 °C (Antarktyda). Temperatura powietrza przy Phoenix waha się od −85 do −28 °C. Temperatura jest więc parametrem „skrajności”: można wskazać miejsca najbardziej zbliżone do Marsa, ale żadne nie dorównuje mu wartościami.

### Sól

Zbiór **nie zawiera danych o zasoleniu**. Sól przeanalizowano przez jej fizyczny efekt: rozpuszczona sól obniża temperaturę zamarzania. Grunt poniżej 0 °C może więc zawierać niezamarzniętą solankę (tzw. *cryopeg*).

- **Ile zmarzliny półkuli północnej byłoby niezamarznięte na 10 m przy danym zasoleniu wody w porach:**

  | zasolenie wody w porach | temperatura zamarzania | % zmarzliny niezamarzniętej |
  |---|---|---|
  | 1 % | −0,6 °C | 16 % |
  | ≈ morska (3,5 % NaCl) | −2,1 °C | **39 %** |
  | solanka 10 % | −6,6 °C | 73 % |
  | solanka 15 % | −10,9 °C | 92 % |

  Duża część arktycznej zmarzliny jest więc zamarznięta tylko dlatego, że woda w niej jest słodka.
- **Wybrzeża (pas ~50 km).** Jest tam 2,4 mln km² zmarzliny, a 0,34 mln km² z niej byłoby niezamarznięte przy zasoleniu morskim. To 14 % zmarzliny przybrzeżnej wobec 45 % w głębi lądu, bo arktyczne wybrzeża są zimniejsze. Mimo to właśnie na wybrzeżach występują słone osady morskie, np. cryopegi w Utqiagvik.
- **Antarktyda:**
  - 57 % zmarzliny jest zimniejsze niż punkt eutektyczny NaCl (−21 °C), więc tam zamarza nawet nasycona solanka NaCl;
  - CaCl₂ (−50 °C) pozostaje płynny wszędzie. Zgadza się to z rzeczywistością: **Don Juan Pond** (temperatura gruntu wg CCI −28 °C) to solanka CaCl₂, która nigdy nie zamarza. To dobra kontrola poprawności danych.
- **Porównanie z Marsem.** Nadchlorany znalezione przez Phoenix (punkt eutektyczny −67…−75 °C) nigdy nie zamarzłyby w ziemskiej zmarzlinie. Na Marsie są płynne tylko chwilowo. Chemicznym analogiem są tylko miejsca, gdzie nadchloran rzeczywiście występuje: Suche Doliny McMurdo i Atakama.

### Spękania (kliny lodowe i piaskowe)

Zbiór **nie zawiera form terenu**. Reżim pękania wyznaczono więc z temperatury powierzchni gruntu według klasycznych progów:

| reżim | temperatura powierzchni | źródło progu |
|---|---|---|
| kliny lodowe nieaktywne lub reliktowe | −6…−2 °C | Péwé 1966 |
| aktywne pękanie klinów lodowych | −20…−6 °C | Péwé 1966; Romanovsky 1985 |
| pękanie zimne i suche (kliny piaskowe, poligony jak u Phoenix) | ≤ −20 °C | |

Temperatura powierzchni jest zwykle o 2–6 K wyższa niż temperatura powietrza, bo grunt ociepla śnieg. Wyniki są więc ostrożne.

| reżim (2023) | półkula północna | Antarktyda |
|---|---|---|
| reliktowe | 3,45 mln km² | 8 tys. km² |
| aktywne kliny lodowe | 2,88 mln km² (mediana ALT 0,42 m) | 57 tys. km² |
| zimne i suche, jak u Phoenix | **59 km²** | **112 tys. km²** |

- **Grunt pękający jak na Marsie jest prawie wyłącznie w Antarktydzie.** W Arktyce występuje tylko na skrawkach północnej Ellesmere i północnej Grenlandii (76,7–83°N).
- **Zmiana w czasie.** Obszar aktywnego pękania na półkuli północnej wynosił 4,95 mln km² w 2003 r., 4,56 w 2013 r. i 2,88 w 2023 r. Spadek w 2023 r. jest częściowo efektem ciepłego roku.
- **Wzór przestrzenny (półkula północna):**
  - 565 płatów; największy ma 1,35 mln km² (Jakucja, ok. 70°N, 129°E);
  - 5 największych płatów obejmuje 75 % powierzchni;
  - rozkład wielkości płatów ma ogon potęgowy, α = 1,55;
  - silna autokorelacja (Moran's I = 0,95);
  - w Antarktydzie płaty układają się wzdłuż Gór Transantarktycznych, czyli z północy na południe.

### Analogi Marsa (porównanie z Phoenix)

Policzono **wskaźnik podobieństwa do Phoenix** w skali 0–1. Ma cztery składniki o równych wagach:
- zimno,
- płytki lód (ALT bliskie 2–18 cm),
- pewność obecności zmarzliny,
- reżim pękania.

Wskaźnik opisuje **tylko podobieństwo cieplne i kriologiczne**. Nie uwzględnia suchości, chemii ani rzeźby terenu.

| miejsce | temperatura powierzchni | ALT | percentyl wskaźnika |
|---|---|---|---|
| University Valley / Beacon Valley (Suche Doliny) | −31 °C | ~0 m | **100** |
| Don Juan Pond / Taylor Valley | −28 / −24 °C | ~0 m | 98–99 |
| Axel Heiberg (Expedition Fiord) | −17 °C | 0,2 m | 96 |
| Haughton Crater (Devon Island) | −16 °C | 0,3 m | 93 |
| Eureka (Ellesmere) | −16 °C | 0,4 m | 92 |
| Utqiagvik (Alaska) | −6 °C | 0,4 m | 81 |
| Bockfjorden (Svalbard) | −2 °C | 0,5 m | 76 |

- **Znane analogi Marsa wypadają wysoko.** Mediana to 97. percentyl, a 7 z 8 miejsc mieści się w najlepszych 10 %. To częściowo efekt doboru, bo większość znanych analogów leży w strefach polarnych.
- **Mniej znani kandydaci w Arktyce:** **północna Ellesmere** (≈ 81,8°N, 77°W) i **Ziemia Peary’ego** w północnej Grenlandii (≈ 83°N, 30°W). Temperatura powierzchni wynosi tam ≈ −20,5 °C, a ALT ≈ 0–0,07 m. To najbardziej „marsjańska” zmarzlina półkuli północnej.

---

## 3. Ograniczenia

- **To wynik modelu**, a nie pomiar w otworach wiertniczych. Lokalne warunki (śnieg, roślinność, wilgotność) są uśrednione do 1 km.
- **Temperatura jest średnią roczną.** Brak amplitudy sezonowej i dobowej, a to ona napędza pękanie. Reżimy pękania są więc przybliżeniem.
- **ALT w Antarktydzie jest prawdopodobnie zaniżone.** Na 99,96 % obszaru wynosi poniżej 10 cm, podczas gdy pomiary terenowe w Suchych Dolinach podają zwykle od kilku do kilkudziesięciu cm. Dlatego wysoka ocena „płytkiego lodu” w Antarktydzie wynika częściowo z ograniczeń danych.
- **Obszar Antarktydy z danymi** (183 tys. km²) jest kilka razy większy niż szacunki powierzchni wolnej od lodu (ok. 22–45 tys. km²). Maska produktu jest więc hojna.
- **Zmiany 2003→2023** porównują pojedyncze lata. Rok 2023 był wyjątkowo ciepły, więc lepszym miernikiem trendu jest wieloletni szereg PFR i temperatura na 10 m.
- **Brak danych o zasoleniu, lodzie gruntowym (ilości) i formach terenu.** Trzeba je uzupełnić z innych źródeł: mapy lodu gruntowego IPA, ArcticDEM lub obrazów do wykrywania poligonów.
