import { Router } from 'express';
import { pool } from '../db.js';
import { requireRoles } from '../middleware/auth.js';
import { getAssessorRuntime } from '../assessorConfig.js';
import { LAND_TYPE_CLASSES, ACTUAL_USE_CLASSES } from '../assessorIndex.js';

const router = Router();
const canEdit = requireRoles('Admin', 'Staff Assessor');

router.get('/assessor/meta', async (_req, res, next) => {
  try {
    const rt = await getAssessorRuntime();
    res.json({
      province: rt.province,
      municipality: rt.municipality,
      barangays: rt.barangays,
      propertyKinds: rt.propertyKinds,
      landTypeClasses: rt.landTypeClasses || LAND_TYPE_CLASSES,
      actualUseClasses: rt.actualUseClasses || ACTUAL_USE_CLASSES,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/assessor/build-pin', canEdit, async (req, res, next) => {
  try {
    const rt = await getAssessorRuntime();
    const pin = rt.buildPin(req.body || {});
    res.json({ pin, barangayIndex: rt.barangayCode(req.body?.barangay) });
  } catch (err) {
    next(err);
  }
});

/** Tax Map Control Roll — all barangays or one */
router.get('/assessor/tax-map-control-roll', async (req, res, next) => {
  try {
    const rt = await getAssessorRuntime();
    const { barangayCode, kindByCode } = rt;
    const barangay = req.query.barangay ? String(req.query.barangay) : null;
    const params = [];
    let where = 'WHERE 1=1';
    if (barangay && barangay !== 'all') {
      params.push(barangay);
      where += ` AND p.barangay = $${params.length}`;
    }

    const { rows } = await pool.query(
      `SELECT
         p.id,
         p.assessor_lot_no,
         COALESCE(NULLIF(p.survey_lot_no,''), p.survey_no, p.lot_number) AS survey_lot_no,
         p.title_number,
         COALESCE(NULLIF(p.title_area,''), p.area_sq_m::text) AS area,
         COALESCE(NULLIF(p.class_code,''), p.land_type_class) AS class_code,
         p.land_type_class,
         p.owner_name,
         p.arp_no,
         p.tax_declaration_no AS td_no,
         p.pin,
         p.barangay,
         p.barangay_index,
         p.section_no,
         p.kind_code,
         p.has_building,
         p.has_machinery,
         p.has_plants,
         p.has_special,
         p.remarks,
         f.assessed_value,
         f.tax_status,
         f.actual_use
       FROM gis_parcels p
       LEFT JOIN LATERAL (
         SELECT assessed_value, tax_status, actual_use
         FROM faas_land_sheets s
         WHERE s.parcel_id = p.id
         ORDER BY s.updated_at DESC
         LIMIT 1
       ) f ON true
       ${where}
       ORDER BY p.barangay, p.section_no, p.assessor_lot_no, p.lot_number`,
      params,
    );

    const byBarangay = {};
    for (const r of rows) {
      const b = r.barangay || 'Unassigned';
      if (!byBarangay[b]) byBarangay[b] = [];
      const kind = kindByCode(r.kind_code);
      byBarangay[b].push({
        id: r.id,
        assessorLotNo: r.assessor_lot_no || '',
        surveyLotNo: r.survey_lot_no || '',
        titleNo: r.title_number || '',
        area: r.area || '',
        classCode: r.class_code || r.land_type_class || '',
        landTypeClass: r.land_type_class || '',
        ownerName: r.owner_name || '',
        arpNo: r.arp_no || '',
        tdNo: r.td_no || '',
        pin: r.pin || '',
        barangay: r.barangay || '',
        barangayIndex: r.barangay_index || barangayCode(r.barangay),
        sectionNo: r.section_no || '',
        kindCode: r.kind_code || '0001',
        kindLabel: kind?.short || 'Land',
        building: r.has_building || r.kind_code === '1001',
        machinery: r.has_machinery || r.kind_code === '2001',
        plants: r.has_plants || r.kind_code === '4001',
        special: r.has_special || r.kind_code === '3001',
        othersIdentify: [
          r.has_building || r.kind_code === '1001' ? '1001-Bldg' : null,
          r.has_machinery || r.kind_code === '2001' ? '2001-Machinery' : null,
          r.has_special || r.kind_code === '3001' ? '3001-Special' : null,
          r.has_plants || r.kind_code === '4001' ? '4001-Plants/Trees' : null,
        ]
          .filter(Boolean)
          .join(', '),
        remarks: r.remarks || '',
        assessedValue: r.assessed_value != null ? Number(r.assessed_value) : null,
        taxStatus: r.tax_status || '',
        actualUse: r.actual_use || '',
      });
    }

    res.json({
      header: {
        province: rt.province.name,
        provinceCode: rt.province.code,
        municipality: rt.municipality.name,
        municipalityCode: rt.municipality.code,
        barangay: barangay && barangay !== 'all' ? barangay : 'ALL',
        barangayIndex:
          barangay && barangay !== 'all' ? barangayCode(barangay) : '',
        datePrepared: new Date().toISOString().slice(0, 10),
      },
      barangayOrder: rt.barangays.map((b) => b.name),
      groups: byBarangay,
      totalRows: rows.length,
    });
  } catch (err) {
    next(err);
  }
});

/** Assessment Roll — Taxable Properties (Attachment 6 style) */
router.get('/assessor/assessment-roll', async (req, res, next) => {
  try {
    const rt = await getAssessorRuntime();
    const { barangayCode, kindByCode } = rt;
    const barangay = req.query.barangay ? String(req.query.barangay) : null;
    const taxStatus = req.query.taxStatus ? String(req.query.taxStatus) : 'taxable';
    const params = [];
    let where = 'WHERE 1=1';

    if (barangay && barangay !== 'all') {
      params.push(barangay);
      where += ` AND COALESCE(o.barangay, p.barangay) = $${params.length}`;
    }
    if (taxStatus && taxStatus !== 'all') {
      params.push(taxStatus);
      where += ` AND COALESCE(o.tax_status, f.tax_status, 'taxable') = $${params.length}`;
    }

    const { rows } = await pool.query(
      `SELECT
         COALESCE(o.arp_no, p.arp_no, f.arp_no) AS arp_no,
         COALESCE(o.td_no, p.tax_declaration_no, f.td_no) AS td_no,
         COALESCE(o.pin, p.pin, f.pin) AS pin,
         COALESCE(p.lot_number, '') AS lot_no,
         COALESCE(p.blk_no, '') AS blk_no,
         COALESCE(o.owner_name, p.owner_name, f.owner_name) AS owner_name,
         COALESCE(o.owner_address, f.owner_address, p.street) AS owner_address,
         COALESCE(o.kind_code, p.kind_code, f.kind_code, '0001') AS kind_code,
         COALESCE(o.classification, f.actual_use, '') AS classification,
         COALESCE(o.land_type_class, p.land_type_class, f.land_type_class, '') AS land_type_class,
         COALESCE(o.assessed_value, f.assessed_value, 0) AS assessed_value,
         COALESCE(o.previous_arp, f.previous_arp, '') AS previous_arp,
         COALESCE(NULLIF(o.previous_td,''), NULLIF(f.previous_td,''), 'NEW') AS previous_td,
         COALESCE(o.effectivity_year, f.effectivity_year, EXTRACT(YEAR FROM CURRENT_DATE)::int) AS effectivity_year,
         COALESCE(o.remarks, p.remarks, '') AS remarks,
         COALESCE(o.barangay, p.barangay, f.barangay) AS barangay,
         COALESCE(o.barangay_index, p.barangay_index) AS barangay_index,
         COALESCE(o.section_no, p.section_no) AS section_no,
         COALESCE(o.tax_status, f.tax_status, 'taxable') AS tax_status,
         p.id AS parcel_id
       FROM gis_parcels p
       LEFT JOIN LATERAL (
         SELECT * FROM faas_land_sheets s WHERE s.parcel_id = p.id ORDER BY s.updated_at DESC LIMIT 1
       ) f ON true
       LEFT JOIN LATERAL (
         SELECT * FROM assessor_ownership_records r WHERE r.parcel_id = p.id ORDER BY r.updated_at DESC LIMIT 1
       ) o ON true
       ${where}
       ORDER BY COALESCE(o.barangay, p.barangay), COALESCE(o.section_no, p.section_no), COALESCE(o.pin, p.pin)`,
      params,
    );

    const mapped = rows.map((r) => {
      const kind = kindByCode(r.kind_code);
      return {
        arpNo: r.arp_no || '',
        tdNo: r.td_no || '',
        pin: r.pin || '',
        pinPrefix: `${rt.province.code}-${rt.municipality.code}`,
        lotBlockNo: [r.lot_no, r.blk_no].filter(Boolean).join(' / '),
        ownerName: r.owner_name || '',
        ownerAddress: r.owner_address || '',
        kind: kind?.short || r.kind_code || 'Land',
        kindCode: r.kind_code,
        classification: r.classification || '',
        landTypeClass: r.land_type_class || '',
        assessedValue: Number(r.assessed_value) || 0,
        previousArp: r.previous_arp || '',
        previousTd: r.previous_td || 'NEW',
        effectivity: r.effectivity_year,
        remarks: r.remarks || '',
        barangay: r.barangay || '',
        barangayIndex: r.barangay_index || barangayCode(r.barangay),
        sectionNo: r.section_no || '',
        taxStatus: r.tax_status || 'taxable',
        parcelId: r.parcel_id,
      };
    });

    const totalAssessed = mapped.reduce((s, r) => s + r.assessedValue, 0);

    res.json({
      header: {
        title: 'ASSESSMENT ROLL — Taxable Properties',
        province: rt.province.name,
        provinceCode: rt.province.code,
        municipality: rt.municipality.name,
        municipalityCode: rt.municipality.code,
        barangay: barangay && barangay !== 'all' ? barangay : 'ALL',
        section: '',
        datePrepared: new Date().toISOString().slice(0, 10),
        attachment: 'Attachment 6',
      },
      rows: mapped,
      totalAssessed,
    });
  } catch (err) {
    next(err);
  }
});

/** Sync / upsert ownership record from parcel + FAAS */
router.post('/assessor/ownership-records/sync', canEdit, async (req, res, next) => {
  try {
    const rt = await getAssessorRuntime();
    const { barangayByName, buildPin } = rt;
    const parcelId = Number(req.body.parcelId);
    if (!parcelId) return res.status(400).json({ error: 'parcelId required' });

    const { rows: parcels } = await pool.query('SELECT * FROM gis_parcels WHERE id = $1', [parcelId]);
    if (!parcels[0]) return res.status(404).json({ error: 'Parcel not found' });
    const p = parcels[0];

    const { rows: faasRows } = await pool.query(
      'SELECT * FROM faas_land_sheets WHERE parcel_id = $1 ORDER BY updated_at DESC LIMIT 1',
      [parcelId],
    );
    const f = faasRows[0] || {};

    const brgy = p.barangay || f.barangay || '';
    const brgyMeta = barangayByName(brgy);
    const kindCode = p.kind_code || f.kind_code || '0001';
    const assessorLot = p.assessor_lot_no || p.lot_number || '';
    const pin =
      p.pin ||
      buildPin({
        barangay: brgy,
        sectionNo: p.section_no,
        assessorLotNo: assessorLot,
        kindCode: kindCode !== '0001' ? kindCode : '',
      });

    await pool.query('DELETE FROM assessor_ownership_records WHERE parcel_id = $1', [parcelId]);
    const { rows } = await pool.query(
      `INSERT INTO assessor_ownership_records (
         parcel_id, faas_sheet_id, pin, arp_no, td_no, assessor_lot_no, survey_lot_no,
         owner_name, owner_address, barangay, barangay_index, section_no, kind_code,
         classification, land_type_class, assessed_value, tax_status, effectivity_year,
         previous_arp, previous_td, remarks
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
       RETURNING *`,
      [
        parcelId,
        f.id || null,
        pin,
        p.arp_no || f.arp_no || '',
        p.tax_declaration_no || f.td_no || '',
        assessorLot,
        p.survey_lot_no || p.survey_no || p.lot_number || '',
        p.owner_name || f.owner_name || '',
        f.owner_address || p.street || '',
        brgy,
        p.barangay_index || brgyMeta?.code || '',
        p.section_no || '',
        kindCode,
        f.actual_use || '',
        p.land_type_class || f.land_type_class || '',
        f.assessed_value || 0,
        f.tax_status || 'taxable',
        f.effectivity_year || new Date().getFullYear(),
        f.previous_arp || '',
        f.previous_td || 'NEW',
        p.remarks || '',
      ],
    );

    await pool.query(
      `UPDATE gis_parcels SET pin = $2, barangay_index = $3,
         assessor_lot_no = COALESCE(NULLIF(assessor_lot_no,''), $4), updated_at = now()
       WHERE id = $1`,
      [parcelId, pin, brgyMeta?.code || '', assessorLot],
    );
    res.json({ record: rows[0], pin });
  } catch (err) {
    next(err);
  }
});

router.get('/assessor/ownership-records', async (req, res, next) => {
  try {
    const rt = await getAssessorRuntime();
    const { kindByCode } = rt;
    const barangay = req.query.barangay ? String(req.query.barangay) : null;
    const params = [];
    let sql = 'SELECT * FROM assessor_ownership_records WHERE 1=1';
    if (barangay && barangay !== 'all') {
      params.push(barangay);
      sql += ` AND barangay = $${params.length}`;
    }
    sql += ' ORDER BY barangay_index, section_no, assessor_lot_no, pin';
    const { rows } = await pool.query(sql, params);
    res.json({
      records: rows.map((r) => ({
        id: r.id,
        parcelId: r.parcel_id,
        pin: r.pin,
        arpNo: r.arp_no,
        tdNo: r.td_no,
        assessorLotNo: r.assessor_lot_no,
        surveyLotNo: r.survey_lot_no,
        ownerName: r.owner_name,
        ownerAddress: r.owner_address,
        barangay: r.barangay,
        barangayIndex: r.barangay_index,
        sectionNo: r.section_no,
        kindCode: r.kind_code,
        kindLabel: kindByCode(r.kind_code)?.label || r.kind_code,
        classification: r.classification,
        landTypeClass: r.land_type_class,
        assessedValue: Number(r.assessed_value) || 0,
        taxStatus: r.tax_status,
        effectivityYear: r.effectivity_year,
        previousArp: r.previous_arp,
        previousTd: r.previous_td,
        remarks: r.remarks,
      })),
    });
  } catch (err) {
    next(err);
  }
});

/** Update parcel assessor identity fields */
router.patch('/assessor/parcels/:id', canEdit, async (req, res, next) => {
  try {
    const rt = await getAssessorRuntime();
    const { barangayByName, barangayCode, buildPin } = rt;
    const id = Number(req.params.id);
    const b = req.body || {};
    const brgy = b.barangay;
    const brgyMeta = brgy ? barangayByName(brgy) : null;

    const fields = [];
    const vals = [id];
    const add = (col, val) => {
      vals.push(val);
      fields.push(`${col} = $${vals.length}`);
    };

    if (b.assessorLotNo != null) add('assessor_lot_no', b.assessorLotNo);
    if (b.surveyLotNo != null) add('survey_lot_no', b.surveyLotNo);
    if (b.landTypeClass != null) add('land_type_class', b.landTypeClass);
    if (b.classCode != null) add('class_code', b.classCode);
    if (b.kindCode != null) add('kind_code', b.kindCode);
    if (b.sectionNo != null) add('section_no', b.sectionNo);
    if (b.barangay != null) {
      add('barangay', b.barangay);
      add('barangay_index', brgyMeta?.code || barangayCode(b.barangay));
    }
    if (b.hasBuilding != null) add('has_building', !!b.hasBuilding);
    if (b.hasMachinery != null) add('has_machinery', !!b.hasMachinery);
    if (b.hasPlants != null) add('has_plants', !!b.hasPlants);
    if (b.hasSpecial != null) add('has_special', !!b.hasSpecial);
    if (b.remarks != null) add('remarks', b.remarks);
    if (b.titleArea != null) add('title_area', b.titleArea);

    if (b.rebuildPin || b.assessorLotNo != null || b.kindCode != null || b.sectionNo != null || b.barangay != null) {
      const { rows: cur } = await pool.query('SELECT * FROM gis_parcels WHERE id = $1', [id]);
      if (!cur[0]) return res.status(404).json({ error: 'Parcel not found' });
      const p = cur[0];
      const pin = buildPin({
        barangay: b.barangay ?? p.barangay,
        sectionNo: b.sectionNo ?? p.section_no,
        assessorLotNo: b.assessorLotNo ?? p.assessor_lot_no ?? p.lot_number,
        kindCode: (b.kindCode ?? p.kind_code) !== '0001' ? b.kindCode ?? p.kind_code : '',
      });
      add('pin', pin);
    }

    if (!fields.length) return res.status(400).json({ error: 'No fields to update' });
    fields.push('updated_at = now()');
    const { rows } = await pool.query(
      `UPDATE gis_parcels SET ${fields.join(', ')} WHERE id = $1 RETURNING *`,
      vals,
    );
    if (!rows.length) return res.status(404).json({ error: 'Parcel not found' });
    res.json({ parcel: rows[0] });
  } catch (err) {
    next(err);
  }
});

export default router;
