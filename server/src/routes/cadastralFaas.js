import { Router } from 'express';
import { pool } from '../db.js';
import { authRequired, requireRoles } from '../middleware/auth.js';
import { computeFaasValues, mapSheetRow } from '../services/faasCalculations.js';

const router = Router();
router.use(authRequired);
const canEdit = requireRoles('Admin', 'Staff Assessor');

async function loadSheetDetail(id) {
  const { rows } = await pool.query('SELECT * FROM faas_land_sheets WHERE id = $1', [id]);
  if (!rows[0]) return null;
  const land = await pool.query(
    'SELECT * FROM faas_land_appraisal_rows WHERE sheet_id = $1 ORDER BY sequence_no, id',
    [id],
  );
  const plants = await pool.query(
    'SELECT * FROM faas_plants_trees_rows WHERE sheet_id = $1 ORDER BY sequence_no, id',
    [id],
  );
  const history = await pool.query(
    'SELECT * FROM faas_assessment_history WHERE sheet_id = $1 ORDER BY created_at DESC',
    [id],
  );
  return {
    sheet: mapSheetRow(rows[0]),
    landRows: land.rows.map((r) => ({
      id: r.id,
      sequenceNo: r.sequence_no,
      classification: r.classification,
      subClass: r.sub_class,
      actualUse: r.actual_use,
      area: Number(r.area) || 0,
      unitValue: Number(r.unit_value) || 0,
      baseMarketValue: Number(r.base_market_value) || 0,
      landTypeClass: r.land_type_class || '',
      classCode: r.class_code || '',
    })),
    plantRows: plants.rows.map((r) => ({
      id: r.id,
      sequenceNo: r.sequence_no,
      kind: r.kind,
      totalCount: r.total_count,
      fruitBearing: r.fruit_bearing,
      nonFruitBearing: r.non_fruit_bearing,
      unitPrice: Number(r.unit_price) || 0,
      baseMarketValue: Number(r.base_market_value) || 0,
    })),
    history: history.rows,
  };
}

async function replaceRows(client, sheetId, landRows, plantRows) {
  await client.query('DELETE FROM faas_land_appraisal_rows WHERE sheet_id = $1', [sheetId]);
  await client.query('DELETE FROM faas_plants_trees_rows WHERE sheet_id = $1', [sheetId]);
  for (const row of landRows) {
    await client.query(
      `INSERT INTO faas_land_appraisal_rows
         (sheet_id, sequence_no, classification, sub_class, actual_use, area, unit_value, base_market_value, land_type_class, class_code)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        sheetId,
        row.sequence_no,
        row.classification ?? '',
        row.sub_class ?? row.subClass ?? '',
        row.actual_use ?? row.actualUse ?? '',
        row.area,
        row.unit_value ?? row.unitValue,
        row.base_market_value,
        row.land_type_class ?? row.landTypeClass ?? '',
        row.class_code ?? row.classCode ?? '',
      ],
    );
  }
  for (const row of plantRows) {
    await client.query(
      `INSERT INTO faas_plants_trees_rows
         (sheet_id, sequence_no, kind, total_count, fruit_bearing, non_fruit_bearing, unit_price, base_market_value)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        sheetId,
        row.sequence_no,
        row.kind ?? '',
        row.total_count ?? row.totalCount ?? 0,
        row.fruit_bearing ?? row.fruitBearing ?? 0,
        row.non_fruit_bearing ?? row.nonFruitBearing ?? 0,
        row.unit_price ?? row.unitPrice ?? 0,
        row.base_market_value,
      ],
    );
  }
}

router.get('/faas', async (req, res, next) => {
  try {
    const { pin, td, parcelId } = req.query;
    let sql = 'SELECT * FROM faas_land_sheets WHERE 1=1';
    const params = [];
    if (pin) {
      params.push(String(pin));
      sql += ` AND pin = $${params.length}`;
    }
    if (td) {
      params.push(String(td));
      sql += ` AND td_no = $${params.length}`;
    }
    if (parcelId) {
      params.push(Number(parcelId));
      sql += ` AND parcel_id = $${params.length}`;
    }
    sql += ' ORDER BY updated_at DESC LIMIT 100';
    const { rows } = await pool.query(sql, params);
    res.json({ sheets: rows.map(mapSheetRow) });
  } catch (err) {
    next(err);
  }
});

router.get('/faas/by-parcel/:parcelId', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM faas_land_sheets WHERE parcel_id = $1 ORDER BY updated_at DESC LIMIT 1`,
      [Number(req.params.parcelId)],
    );
    if (!rows[0]) return res.json({ sheet: null, landRows: [], plantRows: [], history: [] });
    res.json(await loadSheetDetail(rows[0].id));
  } catch (err) {
    next(err);
  }
});

router.post('/faas/compute', canEdit, async (req, res) => {
  const calc = computeFaasValues(req.body.landRows || [], req.body.plantRows || [], {
    adj_road_frontage_pct: req.body.adjRoadFrontagePct,
    adj_distance_road_pct: req.body.adjDistanceRoadPct,
    adj_distance_market_pct: req.body.adjDistanceMarketPct,
    assessment_level_pct: req.body.assessmentLevelPct,
  });
  res.json(calc);
});

router.get('/faas/:id', async (req, res, next) => {
  try {
    const detail = await loadSheetDetail(Number(req.params.id));
    if (!detail) return res.status(404).json({ error: 'FAAS sheet not found' });
    res.json(detail);
  } catch (err) {
    next(err);
  }
});

router.post('/faas', canEdit, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const b = req.body || {};
    const landIn = b.landRows || [];
    const plantIn = b.plantRows || [];
    const calc = computeFaasValues(landIn, plantIn, {
      adj_road_frontage_pct: b.adjRoadFrontagePct ?? b.adj_road_frontage_pct,
      adj_distance_road_pct: b.adjDistanceRoadPct ?? b.adj_distance_road_pct,
      adj_distance_market_pct: b.adjDistanceMarketPct ?? b.adj_distance_market_pct,
      assessment_level_pct: b.assessmentLevelPct ?? b.assessment_level_pct,
    });

    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO faas_land_sheets (
         parcel_id, land_property_id, td_no, pin, arp_no, oct_no, survey_no, lot_no, blk_no, entry_date,
         owner_name, owner_address, owner_phone, admin_name, admin_address, admin_phone,
         street, barangay, municipality, province,
         bound_north, bound_east, bound_south, bound_west,
         base_market_value, adj_road_frontage_pct, adj_distance_road_km, adj_distance_road_pct,
         adj_distance_market_km, adj_distance_market_pct, total_adjustments_pct,
         adjusted_market_value, assessment_level_pct, assessed_value, tax_status, actual_use,
         appraised_by, appraised_date, recommending_approval, recommending_date,
         approved_by, approved_date, memoranda,
         prev_assessed_value, prev_owner, effectivity_date, recorded_by,
         back_tax_assessed_value, back_tax_year_from, back_tax_year_to, status, created_by
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
         $11,$12,$13,$14,$15,$16,
         $17,$18,$19,$20,
         $21,$22,$23,$24,
         $25,$26,$27,$28,
         $29,$30,$31,
         $32,$33,$34,$35,$36,
         $37,$38,$39,$40,
         $41,$42,$43,
         $44,$45,$46,$47,
         $48,$49,$50,$51,$52
       ) RETURNING id`,
      [
        b.parcelId ?? b.parcel_id ?? null,
        b.landPropertyId ?? b.land_property_id ?? null,
        b.tdNo ?? b.td_no ?? '',
        b.pin ?? '',
        b.arpNo ?? b.arp_no ?? '',
        b.octNo ?? b.oct_no ?? '',
        b.surveyNo ?? b.survey_no ?? '',
        b.lotNo ?? b.lot_no ?? '',
        b.blkNo ?? b.blk_no ?? '',
        b.entryDate ?? b.entry_date ?? null,
        b.ownerName ?? b.owner_name ?? '',
        b.ownerAddress ?? b.owner_address ?? '',
        b.ownerPhone ?? b.owner_phone ?? '',
        b.adminName ?? b.admin_name ?? '',
        b.adminAddress ?? b.admin_address ?? '',
        b.adminPhone ?? b.admin_phone ?? '',
        b.street ?? '',
        b.barangay ?? '',
        b.municipality ?? 'Jose P. Rizal',
        b.province ?? 'Palawan',
        b.boundNorth ?? b.bound_north ?? '',
        b.boundEast ?? b.bound_east ?? '',
        b.boundSouth ?? b.bound_south ?? '',
        b.boundWest ?? b.bound_west ?? '',
        calc.base_market_value,
        Number(b.adjRoadFrontagePct ?? b.adj_road_frontage_pct) || 0,
        Number(b.adjDistanceRoadKm ?? b.adj_distance_road_km) || 0,
        Number(b.adjDistanceRoadPct ?? b.adj_distance_road_pct) || 0,
        Number(b.adjDistanceMarketKm ?? b.adj_distance_market_km) || 0,
        Number(b.adjDistanceMarketPct ?? b.adj_distance_market_pct) || 0,
        calc.total_adjustments_pct,
        calc.adjusted_market_value,
        calc.assessment_level_pct,
        calc.assessed_value,
        b.taxStatus ?? b.tax_status ?? 'taxable',
        b.actualUse ?? b.actual_use ?? '',
        b.appraisedBy ?? b.appraised_by ?? '',
        b.appraisedDate ?? b.appraised_date ?? null,
        b.recommendingApproval ?? b.recommending_approval ?? '',
        b.recommendingDate ?? b.recommending_date ?? null,
        b.approvedBy ?? b.approved_by ?? '',
        b.approvedDate ?? b.approved_date ?? null,
        b.memoranda ?? '',
        b.prevAssessedValue ?? b.prev_assessed_value ?? null,
        b.prevOwner ?? b.prev_owner ?? '',
        b.effectivityDate ?? b.effectivity_date ?? null,
        b.recordedBy ?? b.recorded_by ?? '',
        b.backTaxAssessedValue ?? b.back_tax_assessed_value ?? null,
        b.backTaxYearFrom ?? b.back_tax_year_from ?? null,
        b.backTaxYearTo ?? b.back_tax_year_to ?? null,
        b.status ?? 'draft',
        req.user?.id ?? null,
      ],
    );
    const sheetId = rows[0].id;
    await replaceRows(client, sheetId, calc.landRows, calc.plantRows);
    await client.query('COMMIT');
    res.status(201).json(await loadSheetDetail(sheetId));
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

router.put('/faas/:id', canEdit, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const id = Number(req.params.id);
    const existing = await loadSheetDetail(id);
    if (!existing) return res.status(404).json({ error: 'FAAS sheet not found' });

    const b = { ...existing.sheet, ...req.body };
    const landIn = req.body.landRows ?? existing.landRows;
    const plantIn = req.body.plantRows ?? existing.plantRows;
    const calc = computeFaasValues(
      landIn.map((r) => ({
        ...r,
        area: r.area,
        unit_value: r.unitValue ?? r.unit_value,
        base_market_value: r.baseMarketValue ?? r.base_market_value,
        classification: r.classification,
        sub_class: r.subClass ?? r.sub_class,
        actual_use: r.actualUse ?? r.actual_use,
        sequence_no: r.sequenceNo ?? r.sequence_no,
        land_type_class: r.landTypeClass ?? r.land_type_class,
        class_code: r.classCode ?? r.class_code,
      })),
      plantIn.map((r) => ({
        ...r,
        kind: r.kind,
        total_count: r.totalCount ?? r.total_count,
        fruit_bearing: r.fruitBearing ?? r.fruit_bearing,
        non_fruit_bearing: r.nonFruitBearing ?? r.non_fruit_bearing,
        unit_price: r.unitPrice ?? r.unit_price,
        base_market_value: r.baseMarketValue ?? r.base_market_value,
        sequence_no: r.sequenceNo ?? r.sequence_no,
      })),
      {
        adj_road_frontage_pct: b.adjRoadFrontagePct ?? b.adj_road_frontage_pct,
        adj_distance_road_pct: b.adjDistanceRoadPct ?? b.adj_distance_road_pct,
        adj_distance_market_pct: b.adjDistanceMarketPct ?? b.adj_distance_market_pct,
        assessment_level_pct: b.assessmentLevelPct ?? b.assessment_level_pct,
      },
    );

    await client.query('BEGIN');
    await client.query(
      `UPDATE faas_land_sheets SET
         parcel_id = $2, land_property_id = $3, td_no = $4, pin = $5, arp_no = $6, oct_no = $7,
         survey_no = $8, lot_no = $9, blk_no = $10, entry_date = $11,
         owner_name = $12, owner_address = $13, owner_phone = $14,
         admin_name = $15, admin_address = $16, admin_phone = $17,
         street = $18, barangay = $19, municipality = $20, province = $21,
         bound_north = $22, bound_east = $23, bound_south = $24, bound_west = $25,
         base_market_value = $26, adj_road_frontage_pct = $27, adj_distance_road_km = $28,
         adj_distance_road_pct = $29, adj_distance_market_km = $30, adj_distance_market_pct = $31,
         total_adjustments_pct = $32, adjusted_market_value = $33, assessment_level_pct = $34,
         assessed_value = $35, tax_status = $36, actual_use = $37,
         appraised_by = $38, appraised_date = $39, recommending_approval = $40, recommending_date = $41,
         approved_by = $42, approved_date = $43, memoranda = $44,
         prev_assessed_value = $45, prev_owner = $46, effectivity_date = $47, recorded_by = $48,
         back_tax_assessed_value = $49, back_tax_year_from = $50, back_tax_year_to = $51,
         status = $52, updated_at = now()
       WHERE id = $1`,
      [
        id,
        b.parcelId ?? b.parcel_id ?? null,
        b.landPropertyId ?? b.land_property_id ?? null,
        b.tdNo ?? b.td_no ?? '',
        b.pin ?? '',
        b.arpNo ?? b.arp_no ?? '',
        b.octNo ?? b.oct_no ?? '',
        b.surveyNo ?? b.survey_no ?? '',
        b.lotNo ?? b.lot_no ?? '',
        b.blkNo ?? b.blk_no ?? '',
        b.entryDate ?? b.entry_date ?? null,
        b.ownerName ?? b.owner_name ?? '',
        b.ownerAddress ?? b.owner_address ?? '',
        b.ownerPhone ?? b.owner_phone ?? '',
        b.adminName ?? b.admin_name ?? '',
        b.adminAddress ?? b.admin_address ?? '',
        b.adminPhone ?? b.admin_phone ?? '',
        b.street ?? '',
        b.barangay ?? '',
        b.municipality ?? 'Jose P. Rizal',
        b.province ?? 'Palawan',
        b.boundNorth ?? b.bound_north ?? '',
        b.boundEast ?? b.bound_east ?? '',
        b.boundSouth ?? b.bound_south ?? '',
        b.boundWest ?? b.bound_west ?? '',
        calc.base_market_value,
        Number(b.adjRoadFrontagePct ?? b.adj_road_frontage_pct) || 0,
        Number(b.adjDistanceRoadKm ?? b.adj_distance_road_km) || 0,
        Number(b.adjDistanceRoadPct ?? b.adj_distance_road_pct) || 0,
        Number(b.adjDistanceMarketKm ?? b.adj_distance_market_km) || 0,
        Number(b.adjDistanceMarketPct ?? b.adj_distance_market_pct) || 0,
        calc.total_adjustments_pct,
        calc.adjusted_market_value,
        calc.assessment_level_pct,
        calc.assessed_value,
        b.taxStatus ?? b.tax_status ?? 'taxable',
        b.actualUse ?? b.actual_use ?? '',
        b.appraisedBy ?? b.appraised_by ?? '',
        b.appraisedDate ?? b.appraised_date ?? null,
        b.recommendingApproval ?? b.recommending_approval ?? '',
        b.recommendingDate ?? b.recommending_date ?? null,
        b.approvedBy ?? b.approved_by ?? '',
        b.approvedDate ?? b.approved_date ?? null,
        b.memoranda ?? '',
        b.prevAssessedValue ?? b.prev_assessed_value ?? null,
        b.prevOwner ?? b.prev_owner ?? '',
        b.effectivityDate ?? b.effectivity_date ?? null,
        b.recordedBy ?? b.recorded_by ?? '',
        b.backTaxAssessedValue ?? b.back_tax_assessed_value ?? null,
        b.backTaxYearFrom ?? b.back_tax_year_from ?? null,
        b.backTaxYearTo ?? b.back_tax_year_to ?? null,
        b.status ?? 'draft',
      ],
    );
    await replaceRows(client, id, calc.landRows, calc.plantRows);
    await client.query('COMMIT');
    res.json(await loadSheetDetail(id));
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

export default router;
