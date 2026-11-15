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

FEATURES = ("summer_temperature", "dryness", "bare_ground")
REGION_TYPES = ("northern", "antarctic", "pzi_only")
# Features that are ranked on, per region type. Since 2026-11-15 (second pass) every type uses the same
# three, so scores are comparable across types and one ranking per Mars site is meaningful:
#   summer_temperature  MODIS Aqua daytime LST over the cell's permafrost pixels (fetch_lst.py), available in
#                       mountains too (ERA5-Land skin temperature was wrong there: smoothed orography)
#   ice_table           no longer scored: ALT exists only in CCI (not in pzi_only, ~0 m in Antarctica), and
#                       "summer thaw stays in the cover" is already the ALT <= ALT_MAX_M filter. Kept as context.
TYPE_FEATURES = {
    "northern": FEATURES,
    "antarctic": FEATURES,
    "pzi_only": FEATURES,
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
