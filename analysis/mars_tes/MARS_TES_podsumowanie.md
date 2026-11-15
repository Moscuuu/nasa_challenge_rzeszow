# Mars: model termiczny z albedo i bezwładnością cieplną TES – kontrola

## Dane i wybory
- Albedo (TES, Christensen 2001) i bezwładność cieplna (TES, Putzig i Mellon 2007) – średnia z okna ±0,5° wokół punktu (`pipeline/tes.py`).
- Referencja: Mars Climate Database **v6.2** (serwer www-mars.lmd.jussieu.fr; zapytania w v6.1 nie były dostępne), scenariusz pyłowy: klimatologia (`dust=1`, średnie Słońce), wysokość 10 m nad powierzchnią, zmienna `tsurf`.
- „Lato lokalne”: Ls 90–180 (N) / 270–360 (S), próbkowane w Ls 105, 135, 165 (N) lub 285, 315, 345 (S). Maksimum dobowe = maks. po czasie lokalnym (co 1 h), średnia z trzech Ls. Surowe odpowiedzi w `mcd_raw/`, wartości w `mcd_summer_tmax.csv`.
- Model bez strojenia: różnice są wynikiem, nie celem; brak progu zaliczenia.

## Phoenix (68,22°N, 125,75°W; TES: TI 122, albedo 0,202)
Okno misji Ls 77–148 (149 sol): model, temperatura **powierzchni**, średnia dobowych maksimów: **257,5 K**. Czujniki MET (powietrze 1 m, pełne sole): **245,6 K**. Różnica +11,9 K, zgodnie z oczekiwaniem (powierzchnia w dzień cieplejsza od powietrza). To tylko dolna granica: MET nie mierzy powierzchni. Szeregu temperatury gruntu z TECP (PDS Geosciences, MECA) nie pobrano w limicie czasu – igły TECP działały krótkimi sesjami po wsunięciu w grunt, nie dają ciągłego maksimum dobowego, więc porównanie 1:1 nie było możliwe.

## Model vs MCD (lato, maks. dobowe temperatury powierzchni, K)
| punkt | albedo | TI | model | MCD | Δ |
|---|---|---|---|---|---|
| Arcadia Planitia | 0,243 | 195,8 | 264,5 | 270,6 | -6,1 |
| Deuteronilus Mensae | 0,147 | 257,4 | 274,5 | 276,2 | -1,7 |
| Phlegra Montes | 0,263 | 162,0 | 268,9 | 277,1 | -8,2 |
| Erebus Montes | 0,244 | 132,9 | 273,6 | 277,7 | -4,1 |
| Amazonis (Posiolova) | 0,243 | 80,8 | 280,3 | 283,5 | -3,2 |
| Utopia Planitia | 0,129 | 341,2 | 268,4 | 272,2 | -3,8 |
| Hellas (brzeg) | 0,177 | 228,2 | 284,8 | 289,7 | -4,9 |
| Phoenix | 0,202 | 122,0 | 251,1 | 246,0 | +5,1 |

Δ = model − MCD: min -8,2 K, maks +5,1 K, średnia -3,4 K.

## Wnioski
Dla 7 miejsc analogowych model jest konsekwentnie chłodniejszy od MCD o 2–8 K (średnio ok. -4,6 K); to skala błędu `summer_tmax`. W porównaniu z progiem skali dopasowania (SUMMER_T_SCALE_K = 20 K) jest to błąd niewielki, a systematyczny, więc ranking miejsc zmienia się mało. Phoenix wypada odwrotnie (+5 K), ale MCD dla niego (246 K) leży blisko temperatury powietrza z MET, więc różnica zależy też od tego, że MCD nie jest pomiarem. Wartości `summer_tmax` należy traktować jako dokładne do kilku kelwinów, nie lepiej.
