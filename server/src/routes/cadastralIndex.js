import { Router } from 'express';
import { pool } from '../db.js';
import { authRequired, requireRoles } from '../middleware/auth.js';

const router = Router();
router.use(authRequired);
const canEdit = requireRoles('Admin', 'Staff Assessor');

function toFeatureCollection(rows, propsFn) {
  return {
    type: 'FeatureCollection',
    features: rows.map((r) => ({
      type: 'Feature',
      id: r.id,
      geometry: r.geojson,
      properties: propsFn(r),
    })),
  };
}

router.get('/boundaries', async (req, res, next) => {
  try {
    const type = req.query.type ? String(req.query.type) : null;
    const params = [];
    let sql = `SELECT id, boundary_type, name, code, parent_name, barangay, municipality, province,
                      ST_AsGeoJSON(geometry)::json AS geojson, properties
               FROM gis_admin_boundaries`;
    if (type) {
      params.push(type);
      sql += ` WHERE boundary_type = $1`;
    }
    sql += ' ORDER BY boundary_type, name';
    const { rows } = await pool.query(sql, params);
    res.json(
      toFeatureCollection(rows, (r) => ({
        id: r.id,
        boundaryType: r.boundary_type,
        name: r.name,
        code: r.code,
        parentName: r.parent_name,
        barangay: r.barangay,
        municipality: r.municipality,
        province: r.province,
        ...(r.properties || {}),
      })),
    );
  } catch (err) {
    next(err);
  }
});

router.post('/boundaries', canEdit, async (req, res, next) => {
  try {
    const { boundaryType, name, code, parentName, barangay, municipality, province, geometry, properties } =
      req.body;
    if (!boundaryType || !name || !geometry) {
      return res.status(400).json({ error: 'boundaryType, name, and geometry are required' });
    }
    const geo =
      geometry.type === 'Polygon'
        ? { type: 'MultiPolygon', coordinates: [geometry.coordinates] }
        : geometry;
    const { rows } = await pool.query(
      `INSERT INTO gis_admin_boundaries
         (boundary_type, name, code, parent_name, barangay, municipality, province, geometry, properties)
       VALUES ($1,$2,$3,$4,$5,$6,$7, ST_SetSRID(ST_GeomFromGeoJSON($8), 4326), $9)
       RETURNING id`,
      [
        boundaryType,
        name,
        code ?? '',
        parentName ?? '',
        barangay ?? '',
        municipality ?? 'Jose P. Rizal',
        province ?? 'Palawan',
        JSON.stringify(geo),
        JSON.stringify(properties ?? {}),
      ],
    );
    res.status(201).json({ id: rows[0].id });
  } catch (err) {
    next(err);
  }
});

router.get('/map-features', async (req, res, next) => {
  try {
    const type = req.query.type ? String(req.query.type) : null;
    const params = [];
    let sql = `SELECT id, feature_type, name, barangay,
                      ST_AsGeoJSON(geometry)::json AS geojson, properties
               FROM gis_map_features`;
    if (type) {
      params.push(type);
      sql += ` WHERE feature_type = $1`;
    }
    sql += ' ORDER BY feature_type, name';
    const { rows } = await pool.query(sql, params);
    res.json(
      toFeatureCollection(rows, (r) => ({
        id: r.id,
        featureType: r.feature_type,
        name: r.name,
        barangay: r.barangay,
        ...(r.properties || {}),
      })),
    );
  } catch (err) {
    next(err);
  }
});

router.post('/map-features', canEdit, async (req, res, next) => {
  try {
    const { featureType, name, barangay, geometry, properties } = req.body;
    if (!featureType || !geometry) {
      return res.status(400).json({ error: 'featureType and geometry are required' });
    }
    const { rows } = await pool.query(
      `INSERT INTO gis_map_features (feature_type, name, barangay, geometry, properties)
       VALUES ($1,$2,$3, ST_SetSRID(ST_GeomFromGeoJSON($4), 4326), $5)
       RETURNING id`,
      [featureType, name ?? '', barangay ?? '', JSON.stringify(geometry), JSON.stringify(properties ?? {})],
    );
    res.status(201).json({ id: rows[0].id });
  } catch (err) {
    next(err);
  }
});

router.get('/search-index', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) return res.json({ results: [] });
    const like = `%${q}%`;
    const { rows } = await pool.query(
      `${`SELECT p.id, p.parcel_id, p.lot_number, p.pin, p.section_no, p.blk_no, p.owner_name, p.barangay,
                ST_Y(ST_Centroid(p.geometry)) AS lat, ST_X(ST_Centroid(p.geometry)) AS lng
         FROM gis_parcels p
         WHERE p.geometry IS NOT NULL
           AND (p.lot_number ILIKE $1 OR p.pin ILIKE $1 OR p.section_no ILIKE $1
                OR p.parcel_id ILIKE $1 OR p.owner_name ILIKE $1 OR p.tax_declaration_no ILIKE $1)
         ORDER BY p.lot_number LIMIT 30`}`,
      [like],
    );
    res.json({
      results: rows.map((r) => ({
        id: r.id,
        parcelId: r.parcel_id,
        lotNumber: r.lot_number,
        pin: r.pin,
        sectionNo: r.section_no,
        blkNo: r.blk_no,
        ownerName: r.owner_name,
        barangay: r.barangay,
        lat: r.lat != null ? Number(r.lat) : null,
        lng: r.lng != null ? Number(r.lng) : null,
      })),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
