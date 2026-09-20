# 07 — Sync & Versioning

## 1. Ownership rules

| Concern | Owner |
| --- | --- |
| Draft content (FAAS, appraisal, assessment working set) | **Municipality** |
| Final approval authority for covered transactions | **Province** (per LGU rules; configurable) |
| Edit while `PendingProvincialReview` | **Municipality allowed** |
| Record overwrite | **Forbidden** — always new revision |

---

## 2. Revision model

Every save of a versioned aggregate creates:

| Field | Description |
| --- | --- |
| `RevisionNumber` | Monotonic integer per aggregate (1, 2, 3…) |
| `RevisionId` | UUID of this immutable snapshot |
| `EditedBy` | UserId |
| `EditedAt` | UTC timestamp |
| `ChangeSummary` | Optional human summary |
| `ContentHash` | SHA-256 of canonical JSON/payload |
| `DigitalSignature` | Present when signed stage applies |
| `SupersedesRevisionId` | Previous revision |

**Never overwrite.** Current pointer (`IsCurrent = true`) moves; old rows remain archived.

---

## 3. Sync protocol

```mermaid
sequenceDiagram
  participant M as Municipal AIMS
  participant O as Outbox
  participant P as Provincial AIMS
  participant N as Notifications

  M->>M: Save creates Revision N
  M->>O: Enqueue SyncEnvelope
  O->>P: HTTPS mTLS Push Revision N
  P->>P: Store immutable revision
  P->>N: New Revision Available
  Note over P: Reviewer diffs N vs N-1
  P->>P: Approve latest revision K
  P->>O: Push Approval + Signature
  O->>M: Sync Back
  M->>M: Lock content; generate TD
```

### SyncEnvelope (logical)

```json
{
  "envelopeId": "uuid",
  "tenantMunicipalId": "uuid",
  "tenantProvincialId": "uuid",
  "transactionId": "uuid",
  "aggregateType": "FaasSheet|AssessmentRecord|ApprovalPacket",
  "revisionNumber": 3,
  "revisionId": "uuid",
  "contentHash": "sha256",
  "payload": { },
  "idempotencyKey": "uuid",
  "sentAt": "UTC"
}
```

### Province behavior

1. Receive notification: **New Revision Available**
2. Compare changes (field-level diff UI)
3. Approve **latest** revision only
4. Retain all prior revisions archived
5. Reject/return creates workflow event; does not delete history

---

## 4. Version control (global policy)

Applies to: FAAS, Assessment, Documents, Tax Declarations, Approvals, GIS parcel edits (attribute + geometry snapshots).

Each edit creates:

- New Version / Revision
- New Timestamp
- New Editor
- New Digital Signature (when at signed gates)
- Complete History
- Rollback capability (create new revision from historical snapshot; never silent mutate)

---

## 5. Conflict rules

| Scenario | Resolution |
| --- | --- |
| Municipality saves Rev N+1 while province reviewing Rev N | Allowed; province notified; review target becomes N+1 |
| Province approves Rev N after N+1 exists | Rejected by server; must refresh to latest |
| Offline encoder syncs stale base | Server returns conflict; client merges or forks new revision |
| Dual municipal editors | Optimistic concurrency via `RevisionNumber` / row version |

---

## 6. Idempotency & durability

- Sync push/pull uses `idempotencyKey`
- Outbox pattern with at-least-once delivery + provincial dedupe on `revisionId`
- Audit every sync attempt (success/fail/retry)
