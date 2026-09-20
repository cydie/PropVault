# 05 — Roles & Permission Matrix

## 1. Roles

| Role | Code | Typical duties |
| --- | --- | --- |
| System Administrator | `SYS_ADMIN` | Tenants, users, roles, settings, backups |
| Municipal Assessor | `MUNI_ASSESSOR` | Oversight of municipal assessor ops |
| Assistant Assessor | `ASST_ASSESSOR` | Support appraisal/assessment review |
| Municipal Head Assessor | `MUNI_HEAD` | Final municipal approval + digital signature |
| Appraiser | `APPRAISER` | Land/building appraisal, FAAS draft |
| GIS Officer | `GIS_OFFICER` | Layers, spatial validation, advanced GIS |
| Tax Mapper | `TAX_MAPPER` | Tax map, PIN, control roll |
| Encoder | `ENCODER` | Data entry of FAAS/property attributes |
| Records Officer | `RECORDS` | Archive, document custody, registers |
| Receiving Clerk | `RECEIVING` | Intake, checklist, create transaction |
| Provincial Assessor | `PROV_ASSESSOR` | Provincial oversight |
| Provincial Reviewer | `PROV_REVIEWER` | Compare revisions, recommend province decision |
| Provincial Head Assessor | `PROV_HEAD` | Provincial approval + digital signature |
| Read Only User | `READ_ONLY` | View assigned modules |
| Auditor | `AUDITOR` | Audit logs, compliance reports |

---

## 2. Permission keys (examples)

```text
receiving:* | registry:* | gis:* | taxmapping:* | inspection:*
faas:* | appraisal:* | assessment:* | workflow:recommend | workflow:approve.muni
workflow:approve.prov | signature:sign.muni | signature:sign.prov
taxdeclaration:* | documents:* | print:* | sync:* | reports:*
audit:read | users:* | roles:* | settings:* | verify:public
```

CRUD is expressed as `module:create|read|update|delete|export|approve|sign`.

---

## 3. Permission matrix (R = read, W = write, A = approve/sign, X = none)

| Capability | SYS | MUNI_HEAD | MUNI_ASSESSOR | ASST | APPRAISER | GIS | TAX_MAP | ENCODER | RECORDS | RECEIVING | PROV_HEAD | PROV_REV | PROV_ASSESSOR | READ | AUDITOR |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Users/Roles/Settings | A | R | R | X | X | X | X | X | X | X | R* | X | R* | X | R |
| Receiving intake | R | R | R | R | X | X | X | R | R | W | X | X | X | R | R |
| Owner/Property registry | W | W | W | W | W | R | R | W | W | R | R | R | R | R | R |
| GIS / Tax mapping | W | R | R | R | R | W | W | R | R | X | R | R | R | R | R |
| Inspection | R | R | R | R | W | R | R | R | R | X | R | R | R | R | R |
| FAAS / Appraisal | R | R | W | W | W | R | R | W | R | X | R | R | R | R | R |
| Assessment | R | W | W | W | W | X | X | R | R | X | R | R | R | R | R |
| Municipal recommend | R | A | A | A | X | X | X | X | X | X | X | X | X | X | R |
| Municipal approve+sign | R | A | X | X | X | X | X | X | X | X | X | X | X | X | R |
| Sync to province | R | A | A | X | X | X | X | X | X | X | R | R | R | X | R |
| Province review | X | X | X | X | X | X | X | X | X | X | A | W | W | R | R |
| Province approve+sign | X | X | X | X | X | X | X | X | X | X | A | X | X | X | R |
| Tax Declaration release | R | A | W | R | X | X | X | X | W | X | R | R | R | R | R |
| Documents DMS | W | W | W | W | W | W | W | W | W | W | R | R | R | R | R |
| Print TD/FAAS | R | W | W | W | W | W | W | W | W | R | W | W | W | R | R |
| Reports | W | W | W | W | R | R | R | R | W | R | W | W | W | R | W |
| Audit logs | R | R | R | X | X | X | X | X | R | X | R | R | R | X | W |

\* Provincial admins manage provincial tenant settings only (tenant-scoped).

---

## 4. Enforcement

- API: policy handlers on endpoints (`[Authorize(Policy = "faas:update")]`)
- UI: route guards + capability hooks hide unauthorized actions
- Data: tenant filter + optional barangay/assignment scope for Encoder/Appraiser
