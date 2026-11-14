# Ocena łączna (Ziemia ↔ Mars) — pierwsza wersja

Data: 2026-11-14
Skrypt: `analysis/combine/combine_score.py`. Wyniki w `data/combine/` (poza gitem).

## Jak to działa (po ludzku)

1. Ziemia jest podzielona na kratki 0,1° (~10 km). Bierzemy tylko kratki, w których jest choć trochę zmarzliny (CCI).
2. Każda kratka dostaje **5 ocen od 0 do 1**:

   | ocena | skąd | co znaczy 1 |
   |---|---|---|
   | `s_cold` | CCI, temperatura gruntu | najzimniej na Ziemi |
   | `s_dry` | ERA5 opady + MODIS zieleń | najsuszej i najbardziej goło |
   | `s_ice` | CCI udział zmarzliny × GGD318 ilość lodu | tyle lodu, co w miejscu na Marsie |
   | `s_depth` | CCI grubość warstwy rozmarzającej | lód na tej samej głębokości co na Marsie |
   | `s_crack` | CCI temperatura → reżim pękania | pęka tak, jak na Marsie (mapa poligonów SWIM) |

3. Oceny łączymy **średnią geometryczną**: jedna zła ocena ciągnie całość w dół.
4. Robimy to dla każdego miejsca na Marsie (`data/swim/mars_sites.csv`). Najlepsze dopasowanie to **bliźniak na Marsie**.
5. Wszystkie oceny mają na razie **równą wagę**.

## Sprawdzenie na znanych miejscach

| miejsce | rodzaj | percentyl oceny | percentyl „tylko zimno” |
|---|---|---|---|
| Suche Doliny (4 miejsca) | znany analog | 99,3–99,7 | 98,5–99,9 |
| Axel Heiberg / Eureka / Haughton | znany analog | 91–98 | 94–96 |
| Utqiagvik, Tuktoyaktuk, Duvanny Yar (mokra tundra) | kontrola | 77–85 | 72–78 |
| Adventdalen, Beiluhe (ciepła zmarzlina) | kontrola | 58–68 | 57–63 |

- Znane analogi: mediana **99. percentyl**. Kontrole: mediana **77**. Każdy znany analog jest wyżej niż każda kontrola.
- **Uczciwie: sama ocena „zimno” też je rozdziela** (na tym małym zestawie). Na razie nie udowodniliśmy, że reszta ocen coś dokłada. Pomaga trochę w środku stawki (mokra tundra spada niżej), ale to trzeba policzyć porządniej.
- Próg = ocena, którą osiąga 80 % znanych analogów = **0,878**.

## Wyniki: 257 obszarów nad progiem

- **Arktyka (134 obszary):** głównie **północno-zachodnia Grenlandia, ~81–82°N, 46–60°W** (rejon Hall Land / Washington Land) i **wschodnia Ellesmere (~80°N, 62–72°W)**. GST ≈ −15…−16 °C, warstwa rozmarzająca ~0,3 m, opady ~120–180 mm. Bliźniak: **Erebus Montes**.
- **Antarktyda (123 obszary):** Góry Transantarktyczne (z Suchymi Dolinami), ale też mniej znane: **Góry Księcia Karola (~73°S, 67°E)** i **Góry Shackletona (~80,5°S, 20°W)**. Bliźniak: **Phoenix**.
- Wcześniejsi kandydaci z CCI (północna Ellesmere, Ziemia Peary’ego) są blisko, ale ranking wskazuje raczej NW Grenlandię.

## Ograniczenia

- **Antarktyczne ALT ≈ 0 jest zaniżone** (patrz CCI). Przez to `s_depth` dla Phoenix (lód na 5 cm) jest tam zbyt optymistyczne.
- CCI obejmuje tylko 25–85°N i Antarktydę: **brak Andów** (Ojos del Salado) i miejsc >85°N.
- Miejsca na Marsie mają przybliżone współrzędne (okno ±1°). Wygrywają tylko 2 z 6 bliźniaków (Phoenix i Erebus), bo pozostałe mają podobne profile.
- Brak soli i rzeźby terenu. Poligony to tylko klasa z temperatury, nie pomiar.
- Wagi równe. Następny krok: nauczyć wagi na znanych analogach (z pominięciem jednego naraz) i porównać z „tylko zimno”.

## Uruchomienie

```
python analysis/dryness/dryness_fetch.py         # Earth Engine, ~15 min
python analysis/permafrost_cci/cci_grid.py       # CEDA, ~1,2 GB transferu, surowe pliki kasowane
python analysis/swim/swim_sites.py               # SWIM, ~280 MB
python analysis/nsidc_ggd318/ggd318_analyze.py   # jeśli brak grid_0p1deg.csv.gz
python analysis/combine/combine_score.py
```
