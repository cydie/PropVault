import { pool } from '../db.js';

export const PLAN_SELECT = `
  SELECT sp.*,
         (SELECT COUNT(*)::int FROM gis_parcels p WHERE p.survey_plan_id = sp.id) AS lot_count
  FROM gis_survey_plans sp
`;

export function mapPlanRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    planTitle: row.plan_title,
    cadastreNo: row.cadastre_no,
    surveyNo: row.survey_no,
    projectNo: row.project_no,
    sheetNo: row.sheet_no,
    totalSheets: row.total_sheets,
    scale: row.scale,
    barangay: row.barangay,
    municipality: row.municipality,
    province: row.province,
    island: row.island,
    totalAreaSqM: row.total_area_sq_m != null ? Number(row.total_area_sq_m) : null,
    surveyDateStart: row.survey_date_start,
    surveyDateEnd: row.survey_date_end,
    surveyor: row.surveyor,
    surveyingOffice: row.surveying_office,
    coordinateSystem: row.coordinate_system,
    notes: row.notes,
    planFilePath: row.plan_file_path,
    planMimeType: row.plan_mime_type,
    georefTransform: row.georef_transform,
    controlPoints: row.control_points,
    approvalStatus: row.approval_status,
    submittedAt: row.submitted_at,
    verifiedBy: row.verified_by,
    verifiedAt: row.verified_at,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    lotCount: row.lot_count != null ? Number(row.lot_count) : 0,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listSurveyPlans() {
  const { rows } = await pool.query(`${PLAN_SELECT} ORDER BY sp.updated_at DESC`);
  return rows.map(mapPlanRow);
}

export async function getSurveyPlan(id) {
  const { rows } = await pool.query(`${PLAN_SELECT} WHERE sp.id = $1`, [id]);
  if (!rows[0]) return null;
  const plan = mapPlanRow(rows[0]);
  const sheets = await pool.query(
    'SELECT * FROM gis_survey_sheets WHERE survey_plan_id = $1 ORDER BY id',
    [id],
  );
  const lots = await pool.query(
    `SELECT id, parcel_id, lot_number, pin, section_no, blk_no, owner_name, area_sq_m, barangay
     FROM gis_parcels WHERE survey_plan_id = $1 ORDER BY lot_number`,
    [id],
  );
  return {
    ...plan,
    sheets: sheets.rows,
    lots: lots.rows.map((r) => ({
      id: r.id,
      parcelId: r.parcel_id,
      lotNumber: r.lot_number,
      pin: r.pin,
      sectionNo: r.section_no,
      blkNo: r.blk_no,
      ownerName: r.owner_name,
      areaSqM: r.area_sq_m != null ? Number(r.area_sq_m) : null,
      barangay: r.barangay,
    })),
  };
}

export async function createSurveyPlan(body, userId) {
  const { rows } = await pool.query(
    `INSERT INTO gis_survey_plans (
       plan_title, cadastre_no, survey_no, project_no, sheet_no, total_sheets, scale,
       barangay, municipality, province, island, total_area_sq_m,
       survey_date_start, survey_date_end, surveyor, surveying_office,
       coordinate_system, notes, created_by
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
     RETURNING id`,
    [
      body.planTitle ?? body.plan_title ?? '',
      body.cadastreNo ?? body.cadastre_no ?? '',
      body.surveyNo ?? body.survey_no ?? '',
      body.projectNo ?? body.project_no ?? '',
      body.sheetNo ?? body.sheet_no ?? '1',
      body.totalSheets ?? body.total_sheets ?? 1,
      body.scale ?? '1:4000',
      body.barangay ?? '',
      body.municipality ?? 'Jose P. Rizal',
      body.province ?? 'Palawan',
      body.island ?? 'Palawan',
      body.totalAreaSqM ?? body.total_area_sq_m ?? null,
      body.surveyDateStart ?? body.survey_date_start ?? null,
      body.surveyDateEnd ?? body.survey_date_end ?? null,
      body.surveyor ?? '',
      body.surveyingOffice ?? body.surveying_office ?? '',
      body.coordinateSystem ?? body.coordinate_system ?? 'PRS92 / EPSG:3123',
      body.notes ?? '',
      userId,
    ],
  );
  return getSurveyPlan(rows[0].id);
}

export async function updateSurveyPlan(id, body) {
  const fields = [];
  const vals = [id];
  const map = {
    planTitle: 'plan_title',
    cadastreNo: 'cadastre_no',
    surveyNo: 'survey_no',
    projectNo: 'project_no',
    sheetNo: 'sheet_no',
    totalSheets: 'total_sheets',
    scale: 'scale',
    barangay: 'barangay',
    municipality: 'municipality',
    province: 'province',
    island: 'island',
    totalAreaSqM: 'total_area_sq_m',
    surveyDateStart: 'survey_date_start',
    surveyDateEnd: 'survey_date_end',
    surveyor: 'surveyor',
    surveyingOffice: 'surveying_office',
    coordinateSystem: 'coordinate_system',
    notes: 'notes',
    approvalStatus: 'approval_status',
    verifiedBy: 'verified_by',
    approvedBy: 'approved_by',
  };

  for (const [camel, col] of Object.entries(map)) {
    if (body[camel] !== undefined || body[col] !== undefined) {
      vals.push(body[camel] ?? body[col]);
      fields.push(`${col} = $${vals.length}`);
    }
  }

  if (body.approvalStatus === 'submitted' || body.approval_status === 'submitted') {
    fields.push('submitted_at = COALESCE(submitted_at, now())');
  }
  if (body.approvalStatus === 'verified' || body.approval_status === 'verified') {
    fields.push('verified_at = now()');
  }
  if (body.approvalStatus === 'approved' || body.approval_status === 'approved') {
    fields.push('approved_at = now()');
  }

  if (!fields.length) return getSurveyPlan(id);

  fields.push('updated_at = now()');
  await pool.query(`UPDATE gis_survey_plans SET ${fields.join(', ')} WHERE id = $1`, vals);
  return getSurveyPlan(id);
}

export async function attachParcelToPlan(parcelId, surveyPlanId) {
  await pool.query(
    'UPDATE gis_parcels SET survey_plan_id = $2, updated_at = now() WHERE id = $1',
    [parcelId, surveyPlanId],
  );
}
