"""Rewrite a globe layer file (src/content/places/<layer>.md) from Google Maps data.

Inputs (pick one):
  --kml  URL or file   Google My Maps export. Share the map, then use
                       https://www.google.com/maps/d/kml?mid=<MAP_ID>&forcekml=1
  --csv  file          Google Takeout list CSV (Title, Note, URL, Comment). No coordinates,
                       so each row is geocoded with Nominatim (1 request/s, free).
  --json file          Google Takeout "Saved Places.json" (starred places, has coordinates).

Examples:
  python3 -I tools/import_places.py --layer cafes --kml "https://www.google.com/maps/d/kml?mid=XXXX&forcekml=1"
  python3 -I tools/import_places.py --layer cafes --csv ~/Downloads/Takeout/Maps/"Cafes.csv"

Keeps the file's frontmatter (label, color). Overwrites the table.
"""
import argparse
import csv
import json
import re
import sys
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

UA = "pouroverleaf-import/1.0 (site build script)"
ROOT = Path(__file__).resolve().parent.parent


def fetch(src):
    if re.match(r"^https?://", src):
        req = urllib.request.Request(src, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.read()
    return Path(src).expanduser().read_bytes()


def from_kml(src):
    ns = {"k": "http://www.opengis.net/kml/2.2"}
    root = ET.fromstring(fetch(src))
    out = []
    for pm in root.iter("{http://www.opengis.net/kml/2.2}Placemark"):
        name = (pm.findtext("k:name", default="", namespaces=ns) or "").strip()
        d = pm.find("k:description", ns)
        desc = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", "".join(d.itertext()) if d is not None else "")).strip()
        coords = pm.findtext(".//k:Point/k:coordinates", default="", namespaces=ns).strip()
        if not coords:
            continue
        lon, lat = (float(v) for v in coords.split(",")[:2])
        out.append({"name": name, "place": "", "lat": lat, "lon": lon, "note": desc})
    return out


def from_json(src):
    data = json.loads(fetch(src))
    out = []
    for f in data.get("features", []):
        lon, lat = f["geometry"]["coordinates"][:2]
        p = f.get("properties", {})
        loc = p.get("location", p.get("Location", {}))
        out.append({
            "name": p.get("Title") or loc.get("name") or loc.get("Business Name") or "",
            "place": loc.get("address") or loc.get("Address") or "",
            "lat": lat,
            "lon": lon,
            "note": p.get("Comment") or p.get("Note") or "",
        })
    return out


def geocode(q):
    url = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode({"q": q, "format": "json", "limit": 1})
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        hits = json.load(r)
    time.sleep(1.1)  # Nominatim usage policy: max 1 request per second
    return (float(hits[0]["lat"]), float(hits[0]["lon"]), hits[0].get("display_name", "")) if hits else None


def from_csv(src):
    rows = list(csv.DictReader(Path(src).expanduser().open(newline="", encoding="utf-8")))
    out = []
    for r in rows:
        title = (r.get("Title") or "").strip()
        url = r.get("URL") or ""
        note = (r.get("Note") or r.get("Comment") or "").strip()
        m = re.search(r"@(-?\d+\.\d+),(-?\d+\.\d+)", url)  # some URLs carry coordinates
        if m:
            lat, lon, place = float(m.group(1)), float(m.group(2)), ""
        else:
            hit = geocode(title)
            if not hit:
                print(f"skip (not found): {title}", file=sys.stderr)
                continue
            lat, lon, place = hit
            place = ", ".join(place.split(", ")[-3:-1])  # city, region
        out.append({"name": title, "place": place, "lat": lat, "lon": lon, "note": note})
        print(f"{title}: {lat:.4f}, {lon:.4f}", file=sys.stderr)
    return out


def write(layer, points):
    path = ROOT / "src" / "content" / "places" / f"{layer}.md"
    text = path.read_text(encoding="utf-8") if path.exists() else f"---\nlabel: {layer}\ncolor: #710318\n---\n"
    front = re.match(r"^---\n[\s\S]*?\n---\n", text)
    head = front.group(0) if front else f"---\nlabel: {layer}\ncolor: #710318\n---\n"
    esc = lambda v: str(v).replace("|", "\\|").replace("\n", " ").strip()
    lines = ["| name | place | lat | lon | note |", "|---|---|---|---|---|"]
    for p in points:
        lines.append(f"| {esc(p['name'])} | {esc(p['place'])} | {p['lat']:.4f} | {p['lon']:.4f} | {esc(p['note'])} |")
    path.write_text(head + "\nOne row per point. lat/lon in decimal degrees (north and east positive).\n\n" + "\n".join(lines) + "\n", encoding="utf-8")
    print(f"wrote {len(points)} points to {path.relative_to(ROOT)}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--layer", default="cafes")
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--kml")
    g.add_argument("--csv")
    g.add_argument("--json")
    a = ap.parse_args()
    pts = from_kml(a.kml) if a.kml else from_csv(a.csv) if a.csv else from_json(a.json)
    write(a.layer, pts)
