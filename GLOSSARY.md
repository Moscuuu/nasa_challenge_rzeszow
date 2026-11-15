# Mars Analog Finder

Finding places on Earth to test drilling into ground ice like the ice at candidate Mars base sites, for the NASA Space Apps "terrestrial analogs" challenge.

## Language

### Places

**Mars Base Candidate Site**:
A location on Mars that scientists have proposed as a potential base or human landing site, taken as a small window (about 1°) around its published coordinates. The project uses 7: Arcadia Planitia, Deuteronilus Mensae, Phlegra Montes, Erebus Montes, Amazonis Planitia (Posiolova crater), Utopia Planitia, Hellas rim.
_Avoid_: Mars site (too loose), landing site, Mars twin, Reconnaissance Zone (a much larger SWIM area)

**Earth Cell** (PL: komórka):
A 0.1° patch of Earth's permafrost; the unit that is filtered, scored and ranked. The mask is the Global Permafrost Zonation Index (PZI), and ESA Permafrost CCI in Antarctica, where PZI has no data.
_Avoid_: Earth Region, pixel, analog site

**Area** (PL: obszar):
A group of top-ranked Earth Cells no larger than 5 × 5 cells, built around its best cell; a lone cell is an Area of one. Areas are what the app lists; the best cell is the suggested drilling point.
_Avoid_: region (that is a Region Type), cluster

**Region Type** (PL: typ regionu):
One of three groups of Earth Cells that are ranked separately because different features are valid in each: northern, antarctic, pzi_only (outside CCI coverage: the Andes, other mountains, gaps on the Arctic coast).
_Avoid_: continent, zone

**Known Analog** (PL: znany analog):
An Earth place scientists already use as a Mars analog (e.g. McMurdo Dry Valleys, Devon Island). Used only to check the method; new findings do not have to score as high.
_Avoid_: benchmark, threshold

**Global Sieve** (PL: sito globalne):
A pass over every Earth Cell of permafrost, Antarctica included: Filters first, then a score against the Mars Base Candidate Sites for the cells that pass. Known Analogs are not added by hand: they must pass and score on their own.
_Avoid_: global search

**Depth Layer** (PL: warstwa gruntu):
One of three ground depth ranges an analog is sought for: 0–1 m, 1–5 m, or deeper than 5 m. The layer decides which ground temperature the Filter uses and which Mars sites count (only those where SWIM shows ice in that layer); 1–5 m is the main drilling layer.
_Avoid_: depth, horizon, soil layer (too loose)

### Method

**Filter** (PL: filtr):
A condition a cell must meet to be ranked at all: ground at or below −5 °C, summer thaw no deeper than 0.5 m, bare ground present, not a glacier. Mars sets the Filters; cold is a Filter, never a score.
_Avoid_: threshold (too loose), mask (that is the permafrost map)

**Stability** (PL: odporność):
The share of threshold and feature variants in which a cell stays in the top 10 % of its Region Type. Reported next to the rank.
_Avoid_: confidence, uncertainty

### Parameters

**Permafrost** (PL: zmarzlina):
Ground that stays at or below 0 °C for at least two consecutive years. A thermal state, defined the same way on Earth and Mars; it says nothing about how much ice is present.
_Avoid_: ground ice, frozen ground

**Ground Ice** (PL: lód gruntowy):
Water ice actually present in the ground, described by its amount and the depth at which it begins.
_Avoid_: permafrost (a temperature state, not ice)

**Dry Permafrost** (PL: sucha zmarzlina):
Permafrost that does not thaw in summer and lies under a dry cover layer. This is the kind of place the project searches for; wet, seasonally thawing tundra is not.
_Avoid_: tundra, cold desert (too loose)

**Experiment Window** (PL: okno eksperymentu):
The months and local hours in which an Earth Cell's surface temperature falls inside the daily temperature range of a given Mars Base Candidate Site over the whole Mars year. It tells when to run experiments there; it does not change the score.
_Avoid_: season, best time (too loose)

**Thermal-Contraction Polygon** (PL: pęknięcia, wzory):
A polygon in patterned ground bounded by cracks that form when frozen ground contracts in the cold, without melting.
_Avoid_: crack, pattern, mud crack, salt polygon (those are different processes)

**Rank Comparison** (PL: porównanie rankingowe):
Comparing a parameter by where a place sits within its own planet's range. **No longer used between planets** (since 2026-11-15): it reduced "closest to Mars" to "coldest on Earth". Ranks are now taken only among Earth Cells (dryness). Summer surface temperature is compared directly in kelvin.
_Avoid_: normalized value

### Documents

**Dataset Analysis** (PL: analiza datasetu):
A team member's review of one dataset's potential for the project, written in Polish.
_Avoid_: report, findings
