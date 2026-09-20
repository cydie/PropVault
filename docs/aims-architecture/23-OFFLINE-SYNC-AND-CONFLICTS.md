# 23 — Offline Sync & Conflicts

## Offline GIS Inspection capabilities

Inspectors can download assigned inspections and, offline:

| Capability | Notes |
| --- | --- |
| View property information | Cached JSON pack |
| View parcel map | Offline vector tiles / GeoJSON pack |
| Capture GPS | lat/lon/accuracy |
| Capture Compass Direction | degrees |
| Capture Elevation | meters |
| Take Photos | local encrypted store |
| Record Notes | text |
| Draw Sketch | GeoJSON sketch layer |
| Update Boundary (optional) | proposed geometry locally |
| Collect Signatures | stroke paths + metadata |
| Attach Supporting Documents | queued uploads |
| Save Offline | local revision queue |

## Offline synchronization flow

```mermaid
sequenceDiagram
  participant Device
  participant Local as EncryptedLocalStore
  participant API
  participant Domain

  Device->>API: GET /offline/packs/{assignmentId}
  API-->>Device: Property + parcel + basemap pack
  Device->>Local: Save pack
  Note over Device: Work offline
  Device->>Local: Queue mutations + media
  Device->>API: Network restored → POST /offline/sync-batch
  API->>Domain: Create new revisions
  alt no conflict
    Domain-->>Device: Applied revisions
  else both modified
    Domain-->>Device: 409 + comparison payload
    Device->>Device: User resolves
    Device->>API: POST /offline/resolve-conflict
    Domain-->>Device: New revision committed
  end
```

## Conflict resolution flow

```mermaid
flowchart TD
  Sync[Sync batch] --> Check{Same property revised on server?}
  Check -->|No| Apply[Apply as new revision]
  Check -->|Yes| Comp[Generate comparison]
  Comp -->|Ask user| Resolve{Resolution}
  Resolve -->|Keep server| DiscardLocal[Archive local as abandoned]
  Resolve -->|Keep local| ApplyLocal[Commit local as new revision]
  Resolve -->|Merge manual| Merge[User merge → new revision]
  Apply --> Never[Never auto-overwrite]
  DiscardLocal --> Never
  ApplyLocal --> Never
  Merge --> Never
```

**Rules:** Never overwrite automatically. Every synchronization creates a **new revision**.
