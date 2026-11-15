"""Every threshold and list the scoring uses, in one place.

Changing a value here changes the result; the robustness variants in score.py vary the ones marked (varied).
Spec: docs/superpowers/specs/2026-11-15-drilling-analog-design.md
"""
RES = 0.1  # Earth Cell size [deg]; grid is 1800 x 3600, row 0 = 90 N, col 0 = -180
NY, NX = 1800, 3600

# --- mask -----------------------------------------------------------------------------------------------
PZI_PIXEL_MIN = 0.5      # a 1 km PZI pixel counts as permafrost at or above this index
PERMAFROST_SHARE_MIN = 0.10  # cell is an Earth Cell of permafrost if this share of it is permafrost
PZI_SOUTH_LIMIT = -60.0  # the PZI map ends here; south of it the mask comes from ESA Permafrost CCI
MAAT_TO_GROUND_K = 2.0   # assumed ground-minus-air offset where only PZI's air temperature exists

# --- filters (a cell must pass all of them to be ranked) ------------------------------------------------
T_GROUND_MAX_K = 268.15      # ground temperature of the Depth Layer <= -5 C (varied: -10 C)
ALT_MAX_M = 0.5              # summer thaw no deeper than this, where ALT is known (varied: 1.0 m)
SNOW_FREE_MIN = 0.10         # at least this share of summer observations snow-free: bare ground exists
ICE_FRACTION_MAX = 0.5       # at most this share of the cell is glacier / ice sheet (not used in Antarctica)

# --- features -------------------------------------------------------------------------------------------
SUMMER_T_SCALE_K = 20.0      # summer_temperature = 1 - |Earth - Mars| / this, in kelvin (not ranks)
SWIM_ICE_MIN = 0.10          # a Mars site counts in a Depth Layer only if its SWIM C there is above this

LAYERS = ("0-1m", "1-5m", "gt5m")
LAYER_TEMP = {"0-1m": "gst", "1-5m": "t_1_5", "gt5m": "t_gt5"}  # earth_grid variable used by the filter

SURFACE_FEATURES = ("summer_temperature", "dryness", "bare_ground")
FEATURES = SURFACE_FEATURES + ("ground_cold",)  # every feature any layer uses
REGION_TYPES = ("northern", "antarctic", "pzi_only")
GROUND_COLD_SCALE_K = 35.0   # ground_cold = (T_GROUND_MAX_K - T at the layer depth) / this: -5 C = 0, 233 K = 1
# Features per Depth Layer (2026-11-15, third pass). The same for every region type, so scores are comparable
# across types; they differ by depth because the test can be prepared (pre-drilled hole, casing, snow
# cleared): below the surface the surface conditions are logistics, not the analog.
#   0-1 m  the experiment is at the surface: summer surface temperature, dryness of the cover, bare ground
#   1-5 m  the seasonal wave still reaches 2-3 m on Earth: summer surface temperature + cold ground at depth
#   > 5 m  only the ground at depth: cold ground. Mars at depth is 200-208 K and every Earth cell is >= 27 K
#          warmer, so colder = closer to Mars here (unlike at the surface). Site-independent: in this layer
#          the Mars sites differ only by SWIM ice (which sites count). Equals the "cold only" check baseline.
#   ice_table (1 - ALT / 0.5 m) is not scored: ALT exists only in CCI and is already the ALT filter.
#   massive_ice (debris-covered glaciers, fetch_debris_ice.py) is context only: it cannot see the Antarctic
#   analogs (MODIS snow product and GLIMS outlines fail in the Dry Valleys), so scoring it would penalise
#   missing data, not missing ice.
LAYER_FEATURES = {
    "0-1m": SURFACE_FEATURES,
    "1-5m": ("summer_temperature", "ground_cold"),
    "gt5m": ("ground_cold",),
}

# --- outputs --------------------------------------------------------------------------------------------
TOP_PER_TYPE = 1000          # exported cells per region type and Depth Layer (by best-site score)
TOP_PER_SITE = 200           # plus each Mars site's own top cells per region type, so per-site lists are complete
AREA_MAX_CELLS = 5           # an area spans at most this many cells in each direction (5 x 5)
STABLE_PERCENTILE = 0.90     # robustness: share of variants in which the cell is in the top 10 % of its type

# --- method check ---------------------------------------------------------------------------------------
CHECK_BOXES = [  # name, role, (lon0, lat0, lon1, lat1)
    ("McMurdo Dry Valleys", "known_analog", (160.5, -78.0, 163.0, -77.2)),
    ("Haughton Crater (Devon Island)", "known_analog", (-91.0, 74.9, -88.0, 76.0)),
    ("Alaska North Slope", "contrast", (-160.0, 69.0, -145.0, 71.0)),
]
CHECK_POINTS = [  # name, role, lat, lon  (from analysis/combine)
    ("University Valley", "known_analog", -77.86, 160.72),
    ("Beacon Valley", "known_analog", -77.83, 160.65),
    ("Don Juan Pond", "known_analog", -77.56, 161.19),
    ("Taylor Valley", "known_analog", -77.61, 163.15),
    ("Axel Heiberg (Expedition Fiord)", "known_analog", 79.40, -90.80),
    ("Haughton Crater", "known_analog", 75.38, -89.68),
    ("Eureka (Ellesmere)", "known_analog", 79.99, -85.93),
    ("Utqiagvik (Alaska)", "contrast", 71.29, -156.79),
    ("Tuktoyaktuk", "contrast", 69.44, -133.03),
    ("Duvanny Yar", "contrast", 68.63, 159.15),
    ("Adventdalen (Svalbard)", "contrast", 78.20, 15.85),
    ("Beiluhe (Tibet)", "contrast", 34.82, 92.92),
]
# Contrasts that only hold near the surface: Duvanny Yar is the Yedoma stratotype (40-50 m Ice Complex, up to
# ~80 vol % ice), wet tundra at the surface but ice-rich at depth, like the buried ice sheet of Utopia.
# In 1-5 m and > 5 m it is reported as not applicable instead of as a failure.
CONTRAST_SURFACE_ONLY = ("Duvanny Yar",)
