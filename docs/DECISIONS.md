# Rejestr decyzji

Jedna linia na decyzję, najnowsze na górze. Stan obowiązujący opisuje spec `docs/superpowers/specs/2026-11-15-drilling-analog-design.md`; tu jest tylko „co i dlaczego". Decyzję odwracamy nowym wpisem, starego nie kasujemy.

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
