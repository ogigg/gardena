# Regenerates tests/fixtures/spa-reference.json (NREL SPA via pvlib, local->UTC via zoneinfo).
# Usage: python -I scripts/reference-data/make_spa_reference.py tests/fixtures/spa-reference.json  (needs: pip install pvlib pandas)
import json, sys
import pandas as pd
from pvlib import solarposition
from datetime import datetime
from zoneinfo import ZoneInfo
locs = {
 "Krakow": (50.0614, 19.9366, "Europe/Warsaw"),
 "Gdansk": (54.3520, 18.6466, "Europe/Warsaw"),
 "Sydney": (-33.8688, 151.2093, "Australia/Sydney"),
 "Reykjavik": (64.1466, -21.9426, "Atlantic/Reykjavik"),
 "Quito": (-0.1807, -78.4678, "America/Guayaquil"),
 "NewYork": (40.7128, -74.0060, "America/New_York"),
}
local_times = ["2026-03-20T09:00","2026-06-21T12:00","2026-06-21T18:30","2026-09-22T15:00","2026-12-21T11:00","2026-07-15T07:15"]
rows=[]
for name,(lat,lon,tz) in locs.items():
    for lt in local_times:
        dt = datetime.fromisoformat(lt).replace(tzinfo=ZoneInfo(tz))
        utc = pd.Timestamp(dt).tz_convert("UTC")
        sp = solarposition.spa_python(pd.DatetimeIndex([utc]), lat, lon, altitude=0, pressure=101325, temperature=12)
        rows.append(dict(name=name, lat=lat, lon=lon, tz=tz, local=lt, utc=utc.isoformat(), offsetMinutes=int(dt.utcoffset().total_seconds()//60),
             azimuth=float(sp["azimuth"].iloc[0]), apparentElevation=float(sp["apparent_elevation"].iloc[0]), elevation=float(sp["elevation"].iloc[0])))
json.dump({"generator":"pvlib %s solarposition.spa_python (NREL SPA), local->UTC via Python zoneinfo" % __import__('pvlib').__version__, "rows":rows}, open(sys.argv[1],"w"), indent=1)
print(len(rows))
