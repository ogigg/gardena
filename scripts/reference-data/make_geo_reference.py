# Regenerates tests/fixtures/geo-reference.json (pyproj EPSG:2180 + geodesics, pvlib sunrise/sunset, zoneinfo DST cases).
# Usage: python -I scripts/reference-data/make_geo_reference.py tests/fixtures/geo-reference.json  (needs: pip install pvlib pandas pyproj)
import json, sys
import pandas as pd
from pvlib import solarposition
from pyproj import Transformer
from datetime import datetime
from zoneinfo import ZoneInfo
out = {"generator": "pyproj (EPSG:4326->2180), pvlib sun_rise_set_transit_spa, Python zoneinfo"}
t = Transformer.from_crs("EPSG:4326", "EPSG:2180", always_xy=True)
pts = {"Warsaw PKiN": (21.0067, 52.2319), "Krakow Rynek": (19.9373, 50.0617), "Gdansk": (18.6466, 54.3520), "Szczecin": (14.5528, 53.4285), "Przemysl": (22.7678, 49.7838)}
out["puwg1992"] = [dict(name=k, lon=v[0], lat=v[1], easting=t.transform(*v)[0], northing=t.transform(*v)[1]) for k, v in pts.items()]
rs = []
for name, lat, lon, tz, d in [("Krakow", 50.0614, 19.9366, "Europe/Warsaw", "2026-06-21"), ("Krakow", 50.0614, 19.9366, "Europe/Warsaw", "2026-12-21"), ("Sydney", -33.8688, 151.2093, "Australia/Sydney", "2026-12-21"), ("NewYork", 40.7128, -74.006, "America/New_York", "2026-03-20")]:
    day = pd.DatetimeIndex([pd.Timestamp(d + " 00:00", tz=tz)])
    r = solarposition.sun_rise_set_transit_spa(day, lat, lon)
    f = lambda ts: ts.tz_convert(tz).hour * 60 + ts.tz_convert(tz).minute + ts.tz_convert(tz).second / 60
    rs.append(dict(name=name, lat=lat, lon=lon, tz=tz, date=d, sunriseMin=f(r["sunrise"].iloc[0]), sunsetMin=f(r["sunset"].iloc[0]), transitMin=f(r["transit"].iloc[0])))
out["sunTimes"] = rs
dst = []
for tz, d, hh, mm in [("Europe/Warsaw","2026-03-29",2,30),("Europe/Warsaw","2026-10-25",2,30),("Europe/Warsaw","2026-03-29",3,30),("Europe/Warsaw","2026-10-25",3,30),("Australia/Sydney","2026-04-05",2,30),("Australia/Sydney","2026-10-04",2,30),("America/New_York","2026-03-08",2,30),("America/New_York","2026-11-01",1,30),("Asia/Kathmandu","2026-06-01",12,0)]:
    y, m, dd = map(int, d.split("-"))
    dt0 = datetime(y, m, dd, hh, mm, tzinfo=ZoneInfo(tz), fold=0)
    # zoneinfo: nonexistent times map with fold=0 using pre-transition offset
    utc = dt0.astimezone(ZoneInfo("UTC"))
    back = utc.astimezone(ZoneInfo(tz))
    dst.append(dict(tz=tz, date=d, minutes=hh*60+mm, utc=utc.isoformat(), wallBack=back.strftime("%H:%M"), offsetMinutes=int(back.utcoffset().total_seconds()//60)))
out["dst"] = dst
json.dump(out, open(sys.argv[1], "w"), indent=1)
print(json.dumps(out, indent=1)[:2500])

# Geodesic reference (WGS84, Karney via pyproj.Geod) for local-frame scale checks
from pyproj import Geod
g = Geod(ellps="WGS84")
geo_rows = []
for lat0 in (50.0614, 54.352, -33.8688, 64.1466):
    for az in (0, 90, 45, 200):
        for d in (10, 50, 200):
            lon, lat, _ = g.fwd(19.9366, lat0, az, d)
            geo_rows.append(dict(lon0=19.9366, lat0=lat0, azimuth=az, distance=d, lon=lon, lat=lat))
out["geodesic"] = geo_rows
json.dump(out, open(sys.argv[1], "w"), indent=1)
