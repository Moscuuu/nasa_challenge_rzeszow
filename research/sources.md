# Sources

## Planet colour textures (`app/public/textures/`, built by `scripts/fetch_textures.py`)

- **Earth** - NASA Earth Observatory Blue Marble Next Generation (Reto Stöckli), served via NASA GIBS.
  Layer `BlueMarble_NextGeneration`, WMS 1.3.0, EPSG:4326, BBOX=-90,-180,90,180, 4096x2048 JPEG:
  https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=BlueMarble_NextGeneration&STYLES=&CRS=EPSG:4326&BBOX=-90,-180,90,180&WIDTH=4096&HEIGHT=2048&FORMAT=image/jpeg
  (eoimages.gsfc.nasa.gov original was unreachable at build time.)
- **Mars** - NASA/USGS Viking MDIM 2.1 colour mosaic via NASA Trek, layer `Mars_Viking_MDIM21_ClrMosaic_global_232m`, zoom 3 (16x8 tiles of 256 px):
  https://trek.nasa.gov/tiles/Mars/EQ/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0/default/default028mm/3/<row>/<col>.jpg
