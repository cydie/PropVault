# 09 — Sequence Diagrams

## 1. Receiving → Transaction creation

```mermaid
sequenceDiagram
  actor Clerk as ReceivingClerk
  participant UI as Aims.Web
  participant API as Aims.Api
  participant App as ReceivingHandlers
  participant DMS as Documents
  participant DB as PostgreSQL

  Clerk->>UI: Register visitor + upload docs
  UI->>API: POST /api/receiving/packets
  API->>App: CreateReceivingPacketCommand
  App->>DMS: Store files + checksum + version
  DMS->>DB: Insert DocumentObject versions
  App->>DB: Insert AssessorTransaction Received
  App-->>API: TransactionNo
  API-->>UI: 201 Created
```

---

## 2. FAAS draft → Municipal signature

```mermaid
sequenceDiagram
  actor Appraiser
  actor Head as MunicipalHead
  participant API
  participant FAAS as AppraisalFaas
  participant WF as WorkflowApprovals
  participant Sign as SignatureService
  participant Audit

  Appraiser->>API: POST /api/faas (rev 1)
  API->>FAAS: CreateFaasDraft
  FAAS-->>API: FaasSheet Rev1
  Appraiser->>API: POST /api/assessment/compute
  Appraiser->>API: POST /api/workflow/recommend
  Head->>API: POST /api/workflow/muni-approve
  API->>WF: ApproveMunicipal
  Head->>API: POST /api/signatures/muni
  API->>Sign: SignApprovalPacket
  Sign->>Audit: Append Signature + Approval events
```

---

## 3. Municipal sync → Province approve → Sync back → TD

```mermaid
sequenceDiagram
  participant M as MunicipalAPI
  participant Out as Outbox
  participant P as ProvincialAPI
  actor Rev as ProvincialReviewer
  actor PH as ProvincialHead
  participant TD as TaxDeclaration
  participant Print as Printing

  M->>Out: SyncEnvelope Rev N
  Out->>P: Push envelope
  P-->>Rev: Notify New Revision Available
  Rev->>P: GET diff N vs N-1
  PH->>P: POST province-approve + sign
  P->>Out: SyncBack ApprovalPacket
  Out->>M: Apply approval
  M->>TD: GenerateFinalTaxDeclaration
  TD->>Print: Render PDF + QR + watermark
  M-->>M: Status Released / Archive
```

---

## 4. Document upload with versioning

```mermaid
sequenceDiagram
  actor User
  participant API
  participant DMS
  participant S3 as ObjectStorage
  participant DB

  User->>API: POST multipart /api/documents
  API->>DMS: Validate type PDF/JPG/PNG/DOCX/DWG/ZIP
  DMS->>DMS: Compute SHA-256
  DMS->>S3: PutObject versioned key
  DMS->>DB: Insert DocumentObject Version+1
  DMS->>DB: Soft-supersede previous current
  API-->>User: documentId + version + qr
```

---

## 5. QR verification (public/internal)

```mermaid
sequenceDiagram
  actor Citizen
  participant Verify as /api/verify
  participant DB

  Citizen->>Verify: GET /api/verify/{code}
  Verify->>DB: Lookup signature or TD print
  Verify-->>Citizen: Valid/Invalid + metadata (no PII beyond allowed)
```

---

## 6. Offline inspection sync

```mermaid
sequenceDiagram
  actor Field as AppraiserOffline
  participant App as MobileOrDesktopPack
  participant API
  participant Insp as Inspection

  Field->>App: Capture findings offline
  App->>App: Local encrypted queue
  Field->>API: POST /api/inspection/sync-batch
  API->>Insp: Apply with baseRevision check
  alt conflict
    Insp-->>API: 409 Conflict
    API-->>App: Merge required
  else ok
    Insp-->>API: New revision
  end
```
