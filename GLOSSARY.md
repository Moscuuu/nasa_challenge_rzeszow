# Mars Analog Finder

Finding places on Earth whose permafrost-related conditions resemble candidate Mars base sites, for the NASA Space Apps "terrestrial analogs" challenge.

## Language

### Places

**Mars Base Candidate Site**:
A location on Mars that scientists have proposed as a potential base or human landing site, taken as a small window (about 1°) around its published coordinates. The project uses 7: Arcadia Planitia, Deuteronilus Mensae, Phlegra Montes, Erebus Montes, Amazonis Planitia (Posiolova crater), Utopia Planitia, Hellas rim.
_Avoid_: Mars site (too loose), landing site, Mars twin, Reconnaissance Zone (a much larger SWIM area)

**Earth Cell** (PL: komórka):
A 0.1° patch of Earth's permafrost; the unit that is scored, ranked and handed to the app. Cells are not merged into larger areas.
_Avoid_: Earth Region, area, pixel, analog site

**Known Analog** (PL: znany analog):
An Earth place scientists already use as a Mars analog (e.g. McMurdo Dry Valleys, Devon Island). Used only to check the method; new findings do not have to score as high.
_Avoid_: benchmark, threshold

**Global Sieve** (PL: sito globalne):
A pass that scores every Earth Cell of permafrost, Antarctica included, against the Mars Base Candidate Sites. Known Analogs are not added by hand: they must score high on their own.
_Avoid_: global search, dry-permafrost filter (the sieve scores all permafrost, not only dry)

**Depth Layer** (PL: warstwa gruntu):
One of three ground depth ranges an analog is sought for: 0–1 m, 1–5 m, or deeper than 5 m. The layer decides which data and which factors count; 0–1 m comes first.
_Avoid_: depth, horizon, soil layer (too loose)

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
Comparing a parameter by where a place sits within its own planet's range (e.g. "coldest 5% of Earth" vs "coldest 5% of Mars"), used when Earth never reaches Mars values or when the two planets measure different things. Temperature is compared this way.
_Avoid_: normalized value, similarity in units

### Documents

**Dataset Analysis** (PL: analiza datasetu):
A team member's review of one dataset's potential for the project, written in Polish.
_Avoid_: report, findings
