"""Download all Phoenix MET RML (512-s averaged) reduced files + inventory into OUT dir."""
import csv, io, os, sys, urllib.request
from concurrent.futures import ThreadPoolExecutor

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
UA = {"User-Agent": "Mozilla/5.0 (research script)"}
INV = "https://atmos.nmsu.edu/data_and_services/atmospheres_data/phoenix/Phoenix_met_data_reduced.csv"
BASE = "https://atmos.nmsu.edu/PDS/data/PDS4/PHX/met_bundle/data_reduced/RDR/"


def get(u):
    return urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=120).read()


inv = get(INV)
open(os.path.join(OUT, "inventory.csv"), "wb").write(inv)
rows = [r for r in csv.DictReader(io.StringIO(inv.decode())) if "RML_" in r["FILE_NAME"]]


def dl(r):
    fn = r["FILE_NAME"]
    p = os.path.join(OUT, fn)
    if not os.path.exists(p):
        open(p, "wb").write(get(BASE + fn[:5] + "/" + fn))
    return fn


with ThreadPoolExecutor(6) as ex:
    done = list(ex.map(dl, rows))
print("downloaded", len(done), "RML files")
