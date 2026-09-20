# 25 — Smart Search

## Search dimensions

| Criterion | Implementation |
| --- | --- |
| PIN | exact / prefix B-tree |
| Owner | trigram / full-text |
| Tax Declaration | exact / prefix |
| Lot Number | text |
| Title Number | text |
| Coordinates | point-in-parcel / nearest |
| Barangay | FK / code |
| Survey Number | text |
| Property Classification | enum/code |
| Land Use | enum/code |
| Area Range | numeric between |
| Assessment Value | numeric between |
| Polygon Selection | `ST_Intersects` drawn polygon |
| Map Click | `ST_Contains` identify |
| QR Code | verify code → entity |
| Barcode | print artifact code → entity |

## API

`GET /search/smart` with query DTO combining filters.  
`POST /search/spatial` with GeoJSON polygon / point.

## Ranking

Exact PIN/TD > Owner exact > Trigram > Spatial intersect. Results include property id, PIN, owner, TD, barangay, map thumbnail extent.
