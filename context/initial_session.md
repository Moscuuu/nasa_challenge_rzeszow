# **Summary: Using Terrestrial Permafrost as an Analogue for Martian Subsurface Ice**

## **1. Project concept**

The goal is to identify locations on Earth that can serve as analogues for subsurface ice conditions on Mars, using open-access datasets from NASA, ESA, and other scientific institutions.

Rather than comparing only climate or weather conditions, the project focuses on **permafrost and subsurface ice**.

On Earth, permafrost is defined as ground that remains at or below 0°C for at least two consecutive years.

Mars does not have permafrost in exactly the same sense as Earth. The relevant subject of comparison is **ground containing water ice beneath the surface**.

Three main dimensions of similarity should be considered:

1. **Thermal similarity** – ground temperature at different depths and its seasonal variability.
2. **Cryological similarity** – ice content, depth at which ice occurs, and its distribution beneath the surface.
3. **Geomorphological similarity** – landforms associated with ground ice, such as patterned ground, ice wedges, and polygonal structures.

An important distinction: similar ground temperatures do not necessarily mean similar ice content. Likewise, polygonal landforms on Mars do not automatically indicate the same formation processes as similar structures on Earth.

The project should therefore evaluate thermal, cryological, and geomorphological similarity separately before combining the results into an overall ranking of potential analogues.

## **2. Potential applications of terrestrial analogues**

### **Thermal analogues**

- Modelling ground temperature and its variation with depth and season.
- Assessing the stability of subsurface ice.
- Studying freeze–thaw cycles.
- Supporting mission planning and evaluating the temperature-related constraints of scientific instruments.

### **Geological and cryological analogues**

- Studying ground structures and ice-related landforms.
- Determining whether ice occurs in layers, lenses, cracks, or ice wedges.
- Understanding how sediment type and porosity affect ice preservation.
- Identifying evidence of past water-related processes.
- Selecting locations for investigating potential biosignatures.

The presence of ice does not, by itself, indicate the presence of life.

### **Shared applications**

- Identifying potential water-ice resources for future missions.
- Selecting landing sites, sampling locations, and potential base locations.
- Assessing ground stability and potential risks for rovers and landers.

**Recommendation:** Start with thermal and cryological comparisons. Use geomorphology as an additional validation layer.

## **3. Parameters to compare**

| Parameter                              | What it tells us                                          |
| -------------------------------------- | --------------------------------------------------------- |
| Mean annual ground temperature         | Overall thermal conditions                                |
| Ground temperature at different depths | How temperature changes below the surface                 |
| Seasonal temperature variation         | The magnitude of seasonal changes                         |
| Active layer thickness                 | Maximum depth of seasonal thaw above permafrost           |
| Ground ice content                     | Amount of ice present in the ground                       |
| Ice table depth                        | Depth at which ground ice begins to occur                 |
| Soil moisture                          | Water content in the soil                                 |
| Porosity                               | How much empty space exists between soil particles        |
| Soil type and texture                  | Properties of the material surrounding the ice            |
| Geomorphological features              | Surface structures potentially associated with ground ice |

For Mars, additional indirect indicators may be useful:

- **Water-equivalent hydrogen (WEH)** – an estimate of the amount of hydrogen, expressed as an equivalent quantity of water. It can indicate the presence of water ice, but does not necessarily prove that all detected hydrogen is in the form of ice.
- Radar reflections from subsurface layers.
- Maps showing the probability of subsurface ice.

Missing measurements must not be treated as zero. Differences in measurement methods and uncertainty should also be taken into account.

## **4. Mars datasets**

### **SWIM – Subsurface Water Ice Mapping**

Main source for identifying potential subsurface ice locations

- Website: [https://swim.psi.edu/](https://swim.psi.edu/?utm_source=chatgpt.com)
- Combines multiple observations to estimate the probability of subsurface ice on Mars.
- Uses information from instruments and datasets such as SHARAD, MONS, TES, and CTX.
- It is not a direct image of underground ice, but rather an integration of several independent indicators.

### **SHARAD – Shallow Radar**

- Instrument aboard the Mars Reconnaissance Orbiter (MRO).
- Uses ground-penetrating radar to investigate subsurface structures.
- Provides information about reflections from underground layers, potentially helping to identify their structure and depth.
- Data access: [https://pds.nasa.gov/](https://pds.nasa.gov/?utm_source=chatgpt.com)

### **MONS – Mars Odyssey Neutron Spectrometer**

- Measures hydrogen abundance in shallow subsurface layers.
- Hydrogen can indicate the presence of water or ice, although it does not necessarily correspond exclusively to pure water ice.

### **TES – Thermal Emission Spectrometer**

- Provides information about surface temperature and thermal properties.
- Useful for analysing the thermal environment of Mars.

### **HiRISE**

- High-resolution images of the Martian surface.
- Useful for identifying and analysing geomorphological structures, including polygonal terrain and other potentially ice-related features.
- Website: [https://hirise.lpl.arizona.edu/](https://hirise.lpl.arizona.edu/?utm_source=chatgpt.com)

### **MEDA – Mars Environmental Dynamics Analyzer**

- Instrument suite aboard the Perseverance rover in Jezero crater.
- Measures atmospheric temperature, pressure, wind, relative humidity, dust, and radiation.
- Provides valuable information about surface environmental conditions.
- **Important limitation:** MEDA mainly measures atmospheric and near-surface conditions. It does not directly provide a ground-temperature profile at multiple depths.

### **Phoenix lander**

- The robotic arm exposed subsurface ice during the mission.
- Provided measurements related to ground temperature, thermal properties, and soil composition.
- Operated in the Martian polar region, not in Jezero crater.
- NASA: [https://science.nasa.gov/mission/phoenix/](https://science.nasa.gov/mission/phoenix/?utm_source=chatgpt.com)

## **5. Earth datasets**

### **ESA Permafrost CCI**

Recommended starting point

- Website: [https://climate.esa.int/en/projects/permafrost/](https://climate.esa.int/en/projects/permafrost/?utm_source=chatgpt.com)
- Produced as part of the European Space Agency's Climate Change Initiative.
- Covers approximately 1997–2023, depending on the product.
- Spatial resolution: approximately 1 km.
- Data format: NetCDF (`.nc`).

Important variables include:

| Variable                              | Description                                                                                                        |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Mean Annual Ground Temperature (MAGT) | Mean annual ground temperature, available at different depths, including 0, 1, 2, 5, and 10 m in relevant products |
| Permafrost Extent                     | Spatial distribution or estimated extent of permafrost                                                             |
| Active Layer Thickness (ALT)          | Maximum seasonal thaw depth above permafrost                                                                       |

This is the best starting point for analysing ground temperature at different depths, permafrost distribution, and active layer thickness.

The exact variables and available depths depend on the selected product, so individual datasets and their versions should be checked before analysis.

### **NASA SMAP**

- Website: [https://nsidc.org/data/smap](https://nsidc.org/data/smap?utm_source=chatgpt.com)
- Relevant product: **SPL3FTP_E – SMAP L3 Radiometer Global Daily Freeze/Thaw State**.
- Spatial resolution: approximately 9 km.
- Temporal resolution: daily.
- Available from 2015 onwards.
- Data format: HDF5 (`.h5`).

Relevant variables include:

- **Freeze/Thaw State** – indicates whether the ground is frozen or thawed.
- **Transition Direction / Transition State** – describes transitions between frozen and thawed conditions.
- **Quality Flags** – provide information about observation quality.

**Important limitation:** SMAP detects surface freeze–thaw conditions. It cannot independently confirm the presence of multi-year permafrost or deep subsurface ice.

### **NASA ABoVE – Arctic-Boreal Vulnerability Experiment**

- Website: [https://above.nasa.gov/](https://above.nasa.gov/?utm_source=chatgpt.com)
- Data archive: [https://daac.ornl.gov/](https://daac.ornl.gov/?utm_source=chatgpt.com)

ABoVE covers Arctic and boreal regions, particularly Alaska and Canada. It combines satellite observations with field measurements.

Depending on the selected dataset, available variables may include:

- Active Layer Thickness.
- Ground temperature.
- Soil moisture.
- Soil properties.
- Field measurements and ground-temperature profiles.

For example, datasets containing active layer thickness measurements in Alaska may be useful for validating broader satellite-based observations.

ABoVE is particularly valuable for supplementing satellite data with field measurements.

### **NSIDC – National Snow and Ice Data Center**

\- Website: [https://nsidc.org/data](https://nsidc.org/data?utm_source=chatgpt.com)

NSIDC is a data repository rather than a single dataset. It provides access to numerous datasets related to snow, ice, frozen ground, and permafrost.

Useful search terms include:

- `Permafrost extent`
- `Ground temperature`
- `Ground ice content`
- `Active layer thickness`

When selecting a dataset, check its spatial resolution, temporal coverage, measurement methodology, and data source. Not all datasets available through NSIDC are produced by NASA.

## **6. Potential terrestrial analogue locations**

[Сухие долины Мак-Мердо — Рувики: Интернет-энциклопедия](https://images.openai.com/static-rsc-4/F1xjk36zqQQqKWixKZs9TT-MGOtEsm_l6pNDvyW-WOoj1p3k8RVt1MEnoqya2ei3ihSZhtKrh6MPs03w_AcusDsbBQVYV4LRjRSw1we17tf2KsTVCuo5mxdVIainslpfLMUMvVgxYi43BoXOy-F7BWsk308bcz-p9_fnxo3mIqo?purpose=inline)

**McMurdo Dry Valleys, Antarctica**

- Extremely cold and dry environment.
- Frozen ground and distinctive patterned-ground structures.
- Potentially interesting analogue for cold, dry Martian environments.

[Aerial of polygons on the tundra](https://images.openai.com/static-rsc-4/QK0qLaRDjDyJbuNM8MnipAzX9XUxda7EC4TP2jUBfhZ0pKXYppaO3v5AgkOygIK8QE1d-W_R7xPXIsKAjJUj3GSeOp3QPOpi9yGwOFlzsX0UaWShnHAb_V98mVQNYJ8VJ1ZU44GXZ9DJkX9rN3O5I6xxbrvy84_L7OU_FppWZ4mPUVbkOXTEJw3JtTzorrU1?purpose=inline)

**Alaska**

- Extensive permafrost regions.
- Availability of field measurements through ABoVE.
- Useful for studying active layer thickness and ground temperature.

[Wet Tundra Landscape, Siberia](https://images.openai.com/static-rsc-4/FX5em4qHKhvz1xhaiHkmlWvOw1P27wrqmldKrL2FzELTqHF5LV4V3QIeHvwOr2ONskX9Qii1-yNFlt1n_6IT7ewTcJMWhTqcLiNzDpFxhfFZaxnPWCH_OZhTsE92lWmsP9taL1ljM5DD4Q_JlbqfcbOHY7UosMsh4zHsfltLWSW4D9k6XVgjOz_xKfbBVQkY?purpose=inline)

**Siberia**

- Extensive permafrost areas.
- Different types of ground ice and ice-wedge structures.
- Useful for studying the relationship between ground ice and surface morphology.

[IGEO | Welche Gefahren bergen industrielle Altlasten im Permafrost?](https://images.openai.com/static-rsc-4/6HBhny66GsEq2E0x3T1_UYIebhzngLS9y4YYuX8QvFjHCfXzgZEoIAAGC7RqIXE3RStocoYM31UVYyNbt1uYvI5q8g4qX0R7vBf8KPV3GFKVPavdp1aJAlp1rR4uN5oqU0N9CfDC3at57AJwbIRzFsrt6iThu5ji6s9reXjlLfU?purpose=inline)

**Arctic Canada**

- Diverse permafrost conditions.
- Polygonal terrain and other ice-related landforms.
- Potential for combining satellite observations with field data.

These locations should be treated as candidates, not confirmed analogues. Their suitability depends on which Martian properties are being compared.

## **7. Proposed methodology**

1. **Define the Martian study area.** Start with Jezero crater and extract relevant characteristics from SWIM, instrument observations, and scientific publications.
2. **Identify potential terrestrial analogues.** Use ESA Permafrost CCI to locate regions with comparable ground temperatures, permafrost extent, and active layer thickness.
3. **Supplement the data.**
   - Use SMAP for daily surface freeze–thaw information.
   - Use ABoVE and NSIDC for field measurements, ground-temperature profiles, soil properties, and ground ice content where available.
4. **Standardise the datasets.**
   - Convert measurements to consistent units.
   - Align depth intervals and temporal coverage.
   - Account for differences in spatial resolution.
   - Consider aggregating Earth data to a spatial scale comparable to the available Mars observations.
5. **Calculate separate similarity rankings.**
   - Thermal similarity.
   - Cryological similarity.
   - Geomorphological similarity.
6. **Combine the results.** Produce an overall ranking of terrestrial analogues, explaining which characteristics are similar and where the evidence is uncertain.
7. **Validate geomorphological similarities.** Use HiRISE images for Mars and satellite imagery or field observations for Earth.

## **8. Suggested initial project scope**

For a first implementation, I recommend the following setup:

| Component                | Suggested choice               | Purpose                                                       |
| ------------------------ | ------------------------------ | ------------------------------------------------------------- |
| Martian study area       | Jezero crater                  | Target environment                                            |
| Main Mars dataset        | SWIM                           | Subsurface ice probability                                    |
| Additional Mars data     | SHARAD, MONS, TES              | Subsurface and thermal indicators                             |
| Main Earth dataset       | ESA Permafrost CCI             | Ground temperature, permafrost extent, active layer thickness |
| Additional Earth dataset | NASA SMAP                      | Surface freeze–thaw dynamics                                  |
| Field data               | ABoVE                          | Ground measurements and validation                            |
| Candidate locations      | McMurdo, Alaska, Arctic Canada | Potential terrestrial analogues                               |

### **Suggested Python tools**

```
pip install xarray netCDF4 h5py rasterio rioxarray matplotlib
```

For reading NetCDF files:

```
import xarray as xrds = xr.open_dataset("permafrost_data.nc")print(ds)print(list(ds.data_vars))
```

For reading HDF5 files:

```
import h5pywith h5py.File("smap_data.h5", "r") as f:    print(list(f.keys()))
```

HDF5 files may contain nested groups, so you may need to explore their internal structure to find the relevant variables.

**Key recommendation:** Build the first version around ESA Permafrost CCI and SWIM. This gives you a manageable starting point for comparing terrestrial ground-temperature and permafrost conditions with the estimated distribution of subsurface ice on Mars. Add SMAP and ABoVE once the initial comparison pipeline is working.
