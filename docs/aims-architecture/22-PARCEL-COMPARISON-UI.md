# 22 — Interactive Parcel Comparison UI

## Purpose

Side-by-side comparison of **Old Geometry** vs **New Geometry** before applying parcel changes.

## Layout wireframe

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ Parcel Comparison · PIN 123-45-001 · Proposed Rev 12        [Reject][Approve] │
├─────────────────────────────┬────────────────────────────────────────────┤
│ OLD (Rev 11)                │ NEW (Proposed)                             │
│ ┌─────────────────────────┐ │ ┌─────────────────────────┐               │
│ │   Synchronized Map A    │ │ │   Synchronized Map B    │               │
│ │   (OpenLayers)          │ │ │   (OpenLayers)          │               │
│ └─────────────────────────┘ │ └─────────────────────────┘               │
│ Transparency ════════○──    │ Overlay mode [ ]  Modified vertices ●     │
├─────────────────────────────┴────────────────────────────────────────────┤
│ Change Summary                                                           │
│ Area Δ: +42.15 m² (3.2%)   Perimeter Δ: -8.1 m                           │
│ Added Area (green) · Removed Area (red) · Changed Boundary (amber)       │
│ Coordinate Diff: 14 vertices moved · 2 added · 1 removed                 │
│ Updated Coordinates table…                                               │
│ Reason: [________________________________]  Documents: [Attach]          │
└──────────────────────────────────────────────────────────────────────────┘
```

## Metrics displayed

| Metric | Computation |
| --- | --- |
| Area Difference | area(new) − area(old) |
| Perimeter Difference | peri(new) − peri(old) |
| Coordinate Difference | vertex-level diff |
| Added Area | `ST_Difference(new, old)` |
| Removed Area | `ST_Difference(old, new)` |
| Changed Boundary | symmetric difference boundary |
| Updated Coordinates | paired vertex deltas |

## Interaction

- Two **synchronized** maps (pan/zoom linked)
- **Transparency slider** on new layer
- **Overlay mode** (single map, both layers)
- Highlight **modified vertices**
- Generate **Change Summary** (persisted)
- **Require approval** before apply
- Previous geometry version **archived permanently**
