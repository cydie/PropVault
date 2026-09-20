# 26 — GIS Analytics Dashboard

## Executive widgets

- Property Count
- Property Classification
- Land Use Distribution
- Ownership Distribution
- Assessment Statistics
- Pending Verification
- Pending GIS Validation
- Pending Inspection
- Pending Approval
- Recently Updated Properties
- Recently Added Parcels
- Spatial Conflict Count
- Subdivision Statistics
- Consolidation Statistics
- Top Barangays by Property Count
- Top Barangays by Assessed Value

## Interactive maps / heatmaps

| Map | Design |
| --- | --- |
| Property Density Heatmap | Kernel density or hexbin of centroids |
| Land Classification Heatmap | Classified choropleth / heat by class weight |
| Assessment Value Heatmap | Weighted by assessed value |
| Inspection Activity Heatmap | Inspection points last N days |
| Vacant Land Map | Filter classification/use |
| Agricultural / Commercial / Residential / Public | Layer toggles |

### Heatmap design notes

- Server aggregates to hex grid (`ST_HexagonGrid` or precomputed bins) for scale
- Client OpenLayers Heatmap / WebGL points for < threshold counts
- Time slider for monthly trends

## Charts

Monthly Property Registration · Monthly Inspection · Assessment Trends · Ownership Changes · Land Classification Trends · GIS Validation Trends

## Wireframe

```text
┌─────────────────────────────────────────────────────────────────────┐
│ GIS Executive Dashboard                     [PDF] [Excel] [GeoJSON] │
├──────────┬──────────┬──────────┬──────────┬──────────┬──────────────┤
│ Props    │ Pending  │ Pending  │ Conflicts│ Subdiv   │ Consol       │
│ 128,402  │ GIS 214  │ Insp 89  │ 37       │ 12 Mo    │ 4 Mo         │
├──────────┴──────────┴──────────┴──────────┴──────────┴──────────────┤
│ [Density Heatmap Map Canvas ________________________] Filters ▾     │
├──────────────────────────────┬──────────────────────────────────────┤
│ Classification pie           │ Top Barangays bar (count / AV)       │
├──────────────────────────────┴──────────────────────────────────────┤
│ Trends line: Registration / Inspection / Assessment                 │
└─────────────────────────────────────────────────────────────────────┘
```

## Exports

PDF · Excel · Spatial Data · GeoJSON · Shapefile (server-side ogr/GDAL or NetTopologySuite export job)
