# Rejestr decyzji

Jedna linia na decyzję, najnowsze na górze. Stan obowiązujący opisuje spec `docs/superpowers/specs/2026-11-15-drilling-analog-design.md`; tu jest tylko „co i dlaczego". Decyzję odwracamy nowym wpisem, starego nie kasujemy.

## 2026-11-15 (trzecia runda: cechy zależne od warstwy)

| decyzja | dlaczego |
|---|---|
| **Cechy zależą od warstwy:** 0–1 m = temperatura letnia, suchość, goły grunt; 1–5 m = temperatura letnia + zimny grunt w głębi; > 5 m = tylko zimny grunt w głębi | test można przygotować (odwiert wcześniej, rura osłonowa, odgarnięty śnieg): pod powierzchnią warunki powierzchni to logistyka, nie analog. Zastępuje „wiertło zawsze przechodzi przez pokrywę" (suchość) i „temperatura letnia we wszystkich warstwach" |
| **Zimny grunt w głębi = cecha (zimniej = bliżej Marsa), tylko poniżej 1 m:** (−5 °C − T warstwy) / 35 K | Mars w głębi 200–208 K, każda komórka na Ziemi ≥ 27 K cieplej; przy powierzchni (gdzie Ziemia osiąga Marsa) zostaje zasada „zimniej ≠ bardziej jak Mars". W > 5 m wynik = test „samo zimno" i nie zależy od miejsca na Marsie (różni je tylko SWIM) |
| **Lodowce pokryte gruzem (GLIMS + MODIS) tylko jako informacja, nie cecha** | wskaźnik działa w Andach i Himalajach, ale nie widzi analogów w Antarktydzie (Mullins = 0): ocena karałaby brak danych, nie brak lodu |
| **Znane ograniczenie: MODIS MOD10A1 widzi śnieg na gołym dnie Suchych Dolin** (Beacon Valley: NDSI ~64, Landsat: Wright Valley 88 % dni bez śniegu) | zaniża „goły grunt" i zasięg LST w Antarktydzie; do poprawy Landsatem (kolekcje T2) |

## 2026-11-15 (druga runda: porównywalne wyniki)

| decyzja | dlaczego |
|---|---|
| **Wszystkie typy regionów oceniane na tych samych 3 cechach:** temperatura letnia, suchość, goły grunt | Andy (`pzi_only`) liczone z 2 cech miały ~0,96 i wygrywały dla każdego miejsca na Marsie; wyniki typów nie były porównywalne, a lista „per miejsce" była prawie identyczna |
| **Temperatura letnia z MODIS Aqua LST (dzień, ~13:30, bezchmurnie), uśredniona po pikselach zmarzliny (PZI ≥ 0,5, bez śniegu)**, zamiast ERA5-Land | ERA5 (9 km, wygładzona rzeźba) dawało w górach temperaturę średniej wysokości komórki; MODIS ma 1 km i działa też w Andach. ERA5 zostaje w eksporcie do porównania |
| **`ice_table` (1 − ALT/0,5 m) już nie jest cechą**, tylko filtrem ALT ≤ 0,5 m i kontekstem | ALT jest tylko w CCI (brak w `pzi_only`, ~0 m w Antarktydzie); dublował filtr |
| **Temperatura letnia zostaje we wszystkich warstwach** | wiertło i zwierciny zawsze pracują na powierzchni (jak przy suchości); temperatura w głębi jest poza zasięgiem Ziemi i zostaje filtrem |
| **Odrzucone: porównanie SWIM C z `ice_1_5`/`ice_gt5`** | to udział zmarzliny (= 1 w każdej ocenianej komórce), nie ilość lodu; SWIM C to zgodność −1..1 |
| **Model termiczny Marsa: rozbieg z resetem kolumny** do średniej temperatury powierzchni po 1. roku | 3 lata od 200 K zaniżały temperaturę w głębi do ~6 K (Amazonis 201,6 → 208,1 K); zgodne z 20-letnim przebiegiem do 0,2 K |
| **Eksport: oprócz top-1000 na typ także top-200 każdego miejsca na Marsie w każdym typie** | listy per miejsce w GUI nie mogą zależeć od komórek wybranych pod inne miejsce |
| **Typ lodu każdego miejsca na Marsie z literatury** (`ice_type` w `mars_sites.py`): lodowiec pokryty gruzem (Deuteronilus, Hellas, Phlegra, Erebus), pokrywa lodowa pod regolitem (Arcadia, Utopia), lód w porach nad zanikłym lodem (Amazonis) | lód na tych miejscach to w większości lód masywny/nadmiarowy, nie lód w porach jak w typowej zmarzlinie; na razie tylko informacja, nie cecha. Erebus: tylko mapowanie form terenu, brak pomiaru radarowego; cytat „Viola 2015, abstrakt 1011” niezweryfikowany |
| **Duvanny Yar jest kontrastem tylko w 0–1 m**; w 1–5 m i > 5 m „nie dotyczy" | stratotyp jedomy (40–50 m kompleksu lodowego, do ~80 % obj. lodu): mokra tundra na powierzchni, ale w głębi bogata w lód jak Utopia |

## 2026-11-15

| decyzja | dlaczego |
|---|---|
| **Teza:** miejsca na Ziemi do testów wiercenia w lodzie jak w wybranych miejscach na Marsie | zespół |
| **Pipeline zostaje szkieletem** (ocena per miejsce, kontrakt, eksport); z analizy ML bierzemy logikę filtrów, nie jej wynik | wynik „pod odwierty" nie miał żadnego wejścia z Marsa |
| **Temperatura gruntu i ALT to filtry**, nie cechy; zimno nie wchodzi do oceny | Mars w głębi (200–203 K) jest poza zasięgiem Ziemi (min. 234 K) |
| **Usunięte z oceny:** amplituda dobowa, spękania, dopasowanie percentyli lodu, lód > 5 m | duplikaty temperatury; percentyl lodu 1–5 m nagradzał słabszą zmarzlinę |
| **Miejsca na Marsie różni letnie maksimum temperatury powierzchni**, porównywane w kelwinach | jedyna temperatura, którą Ziemia osiąga |
| **Miejsce liczy się w warstwie tylko przy lodzie SWIM (C > 0,1)** | Erebus i Amazonis nie mają lodu > 5 m |
| **Maska: PZI** (Gruber 2012); Antarktyda z CCI | zespół; PZI kończy się na 60°S |
| **Siatka 0,1° zostaje** | zespół |
| **Pokrywa śnieżna (MODIS) jako filtr i cecha „goły grunt"** | odcina lodowce i lądolód; nie odróżnia mokrej tundry |
| **Ciśnienie pominięte** | zespół; Mars 6–8 hPa poza zasięgiem Ziemi |
| **Ranking w obrębie typu regionu, na cechach ważnych dla całego typu**; braków nie zerujemy i nie pomijamy | wcześniej zasada braków przestawiała czołówkę między kontynentami |
| **Odporność (20 wariantów) jako druga liczba obok rankingu** | zespół: do rozpatrzenia |
| **Obszary do 5 × 5 komórek, samotna komórka = obszar** | zespół: nie za duże, nic nie wypada |
| **Test metody: percentyl wśród komórek po filtrach, w typie; obok „samo zimno"; 3 pudełka + 12 punktów** | percentyl wśród całej zmarzliny był pusty (każda komórka po filtrach > 80) |
| **Testów jednostkowych pipeline'u nie piszemy** | zespół |
| **Model ilości lodu (ML) poza oceną** | uczy się mapy GGD318 z 1997 r.; poza półkulą N to ekstrapolacja |
| **ML „komórki podobne do baz" jako klasyfikator: nie** | brak etykiet na Ziemi; cechy planet w różnych zakresach |
| **GUI nie jest zmieniane w tej gałęzi** | zespół |

## 2026-11-14 (historia, szczegóły w starym specu §5a–5g)

| decyzja | stan |
|---|---|
| Brak danych w cesze = 0 (kara) | **zastąpione** 2026-11-15 (ranking w typie) |
| Braki pomijamy, nie zerujemy | zastąpione tego samego dnia |
| Porównanie rankingowe temperatury i percentylowe lodu | **zastąpione** 2026-11-15 |
| Suchość (SMAP + opad) tylko w 0–1 m | **zmienione**: we wszystkich warstwach (wiertło zawsze przechodzi przez pokrywę) |
| Spękania z temperatury gruntu jako cecha | **usunięte** |
| GGD318 usunięte z pipeline'u (stara mapa) | obowiązuje |
| Sól i zasolenie poza projektem | obowiązuje |
| Antarktyda zostaje w wynikach | obowiązuje (osobny typ) |
| 7 miejsc na Marsie, okno 1°; Phoenix nieużywany | obowiązuje |
