# Analog Finder — master brief

**Dokument zbiorczy wszystkich ustaleń z rozmowy.** Źródła: wywiad (6 partii pytań), notatki z inspiracji (plik użytkownika + 2 strony ocenione później), szkic kompozycji sceny, katalog 8 kierunków wizualnych, moodboard. Styl i implementacja: decyzje poniżej są wiążące; pozycje w „Otwartych wątkach" — nie.

---

## 1. Koncepcja

Aplikacja/webowe demo: użytkownik wybiera miejsce na **Marsie**, a strona pokazuje **podobne (bliźniacze) tereny na Ziemi** — miejsca, gdzie występuje **wieczna zmarzlina** i te same formy peryglacjalne. Miejsca wykrywane przez widoczny algorytm, opisywane automatycznie. Fikcyjna narracja na realnych terenach i współrzędnych. Treści po angielsku.

### 1.1 Motyw przewodni: wieczna zmarzlina (pivot z 2026-11-14)

Główny szkielet i dodatki wybrane przez użytkownika:

- **Oś pionowa: „trzy warstwy mrozu"** (główny szkielet) — kliknięcie miejsca na Marsie „wierci" w dół przez warstwy: aktywna warstwa → zmarzlina → lód gruntowy. Puls szuka analogów warstwa po warstwie; metryki w kartach zapisane jako warstwy (temperatura, głębokość lodu, wiek).
- **Interakcja „rdzeń"** — sygnatura: wynik wyszukiwania to próbka rdzenia lodowego z warstwami-metrykami. Radarowy puls zostaje jako animacja szukania.
- **Edukacyjne mini-kolekcje form peryglacjalnych** — kilka wybranych miejsc + ładne zdjęcie dla każdej formy: wielokąty lodowe (patterned ground), pingosy, lodowce skalne, termokras, sucha zmarzlina. Nie pełny graf — lekkie kolekcje do przeglądania.
- **Realna mapa stref zmarzliny jako warstwa bazowa Ziemi** — znalezione analogi zawsze „siadają" wewnątrz realnej granicy zmarzliny (publiczne dane). Styl warstwy: cienka biała linia / półprzezroczysty overlay.
- **Subtelny akcent mrozowy** — monochrom zostaje; zamrożone elementy dostają delikatny szron: krystaliczna tekstura na kafelkach, mikro-para przy odkryciu, lekko zimny odcień bieli na lodzie.

**Realne pary analogów jako podłoże treści** (do czerpania): Phoenix 2008 (Vastitas Borealis, wielokąty patterned ground) ↔ Spitsbergen (NASA zestawiła oba na jednym zdjęciu); Utopia Planitia ↔ wybrzeża Tuktoyaktuk w Kanadzie (tysiące pingosów, Ibyuk 49 m); Doliny suche McMurdo ↔ sucha zmarzlina (jedynie miejsce na Ziemi z dry permafrost); termokras na Marsie ↔ Batagaika w Jakucji (megaslump cofający się ~12 m/rok).

## 2. Odbiorca i cel

- **Odbiorca:** społeczność space / popularnonaukowa
- **Cel:** doświadczenie i rozrywka (nie edukacja, nie portfolio)
- **Urządzenia:** desktop i mobile równolegle od startu

## 3. Przebieg doświadczenia

1. **Ekran tytułowy z wejściem** — neutralny, bez personalizacji (bez daty urodzenia, bez FOMO)
2. **Czysta eksploracja** — bez przewodnika i lektora; punkty na ciałach dostępne wg progresji
3. **Progresja:** nowe punkty odblokowują się przez odkryte pokrewne miejsca (sieć powiązań)
4. **Finał:** dopiero po odkryciu **kompletu wszystkich miejsc** — animacja-montaż odkryć
5. **Po finale:** powrót do swobodnej eksploracji
6. **Udostępnianie:** wyniki jako obraz/karta

## 4. Scena i kompozycja (wg szkicu użytkownika)

Szkic odręczny = intencja układu; docelowo **proste, cienkie linie** (nie odręczne). Układ do dopracowania, ale elementy stałe:

- **Ziemia centralna** — zdjęcie satelitarne w pełnym naturalnym kolorze, na czarnym tle, z **warstwą bazową stref zmarzliny** (realne dane: cienka biała linia granicy / delikatny półprzezroczysty overlay)
- **Mars mniejszy, z boku** (na szkicu po lewej) — główny obiekt wyszukiwania
- **Pinezka stacji** — użytkownik wskazuje miejsce; w punkcie rozchodzi się **radarowy puls** (koncentryczne cienkie białe pierścienie), a wynik pojawia się jako **próbka rdzenia** z warstwami
- **Zakreślone obszary** podobnych terenów — cienka biała linia konturu na wszystkich ciałach
- **Karty miejsc** po prawej: zdjęcie terenu + liczby (np. współrzędne/podobieństwo), nawigacja strzałką między kartami
- **Orbitująca sonda** — minimalistyczna biała, na cienkiej białej linii orbity wokół Ziemi
- Gwiazdy w tle (statyczne, nie ruchome particles)

## 5. Styl wizualny

| Element | Decyzja |
|---|---|
| Baza kolorów | barwy kosmosu (ciemna), do potwierdzenia na moodboardzie |
| Akcent | **biel jako jedyny akcent** interfejsu; kolor żyje tylko w zdjęciach |
| Akcent mrozowy | subtelny: krystaliczna tekstura szronu na kafelkach zamrożonych elementów, mikro-para przy odkryciu, lekko zimny odcień bieli na lodzie — nie łamie monochromu |
| Zdjęcia satelitarne | pełny naturalny kolor — żywy kontrast wobec monochromatycznego UI |
| Typografia | geometryczny grotesk (sans) |
| Ruch | radar z epicentrum w wybranym punkcie; poza tym średnie: rysowane linie, orbitująca sonda, delikatne mikro-animacje |
| Tekstura | delikatny grain/noise |
| Światło | delikatna winieta i głębia |
| UI | **adaptacyjne** — elementy pojawiają się przy interakcji |
| Nawigacja | brak klasycznej — jedna scena; opcjonalnie dolne przyciski Moon/Mars (wzór: globaldatatracker) |
| Linie | cienkie, wyraźne, białe, 1px |

## 6. Interakcja

- **Desktop:** drag obraca, klik wybiera punkt = wiercenie (puls → rdzeń), scroll zoom
- **Mobile:** tap wybiera punkt = wiercenie, drag obraca
- Kliknięcie karty/miejsca otwiera kartę z detalami (karty **nie zasłaniają globu**)
- Karty i pinezki: proste, niskie, minimalistyczne (nie „elaborate")

## 7. Treści i dane

- **Baza:** statyczna, **10–15 miejsc** (pary Mars ↔ Ziemia w strefach zmarzliny); to samo przy każdej wizycie; plus mini-kolekcje form peryglacjalnych (kilka miejsc + zdjęcie każda)
- **Podłoże danych:** realne tereny i współrzędne + fikcyjna narracja; realne pary analogów z badań (Phoenix ↔ Spitsbergen, Utopia Planitia ↔ Tuktoyaktuk, Doliny suche, Batagaika)
- **Opis miejsca:** metryki jako warstwy rdzenia (priorytet: dane fizyczne terenu — wysokość, temperatura, głębokość/ilość lodu gruntowego) + **jedna ciekawostka** w języku dostępnym, popularnonaukowym, bez stylizacji
- **Algorytm widoczny:** pokazuje „jak wykryto" i metryki
- **Język:** angielski
- **Dźwięk:** subtelny ambient z łatwym wyłącznikiem

## 8. Analiza inspiracji — synteza

**Wzorce „+" (szukamy):**
- Realistyczne materiały na kosmicznym tle: zdjęcia satelitarne terenu, wideo, pojedyncze linie nad planetą jak satelity (endurosat — „amazing": typografia, zoom w teren 3D ze zdjęciem satelitarnym, subtelna siatka, winieta, hologram/blueprint)
- Warstwy informacji na obrazie: textbox z blur, miejsca z białą obwódką, półprzezroczyste kolorowe overlaye, cienkie białe linie (geolava)
- Sterowalny centralny element z etykietami wskazującymi miejsca (mazehq)
- Klik na kraj/miejsce otwiera kartę; dolna nawigacja z przyciskami (globaldatatracker)
- Layout z where-is-paul
- Delikatne mikro-animacje: kometa, glitch bez zmiany koloru; przejście „czarna ramka → większa ramka" jak przez okno
- Małe fakty z liczbami, klimatyczna muzyka, status badges, czysta nawigacja, przezroczystość w boxach
- Neon retrofuturism na pierwszym ekranie (theunknown.tv — kolor do dalszej dyskusji, baza to barwy kosmosu)

**Wzorce „−" (czerwone linie):**
- Chaos animacji: tekst bounce bez kierunku, gradienty na białym tekście, tło płynące do użytkownika
- Fonty nie w klimacie: serif, pixel; kliszowana „tech paleta" black+cyan
- Wydajność i mobile: wolne ładowanie (globaldatatracker, thecosmicstage), broken mobile, elementy nieskalujące się
- Przerost: automatyczne karuzele, za dużo kontroli/FOMO, szybki spin planety, szybkie orbit mikroanimacje
- Kolorowe blury jako obramowania, ruchome gwiazdy-particles, kolorowy tekst
- Karty zasłaniające glob, zbyt ozdobne karty i wysokie pinezki, stylizowana tekstura globu

## 9. Otwarte wątki

1. **Rola Księżyca po pivocie** — fokus to Mars ↔ Ziemia; czy Księżyc zostaje (np. lód w kraterach wiecznie zacienionych jako bonus), czy wypada z demo — decyzja przed implementacją; łączy się z pytaniem o dolne przyciski Moon/Mars (wzór: globaldatatracker)
2. **Nazwa projektu** — do wymyślenia razem
3. **Układ sceny** — dopracowanie proporcji i rozmieszczenia (szkic ≠ finalny layout)
4. **Właścicielski moodboard** — użytkownik dorzuci własny; baza kolorów do potwierdzenia po nim

## 10. Materiały towarzyszące

- **Katalog 8 kierunków wizualnych** (osobny dokument): opisy, hasła, prompty obrazowe, linki — wybrany kierunek: **PULSE (#8)** rozwinięty o ustalenia stylu
- **Moodboard wygenerowany:** plansza nastroju + kluczowy ekran (radarowy puls, kafelki z metrykami)
- **Szkic kompozycji** — użytkownika (powyższa sekcja 4)
- **Notatki z inspiracji** — plik użytkownika z ocenami stron

## 11. Techniczne (robocze)

- Stack jak w prototypie SOLSTICE: React + three.js / react-three-fiber
- Budżet wydajności: szybkie ładowanie to twardy wymóg (wolny glob = odrzucone)
- Zdjęcia satelitarne z lazy-loadingiem; gwiazdy statyczne; radar i puls w CSS/WebGL shaderach
