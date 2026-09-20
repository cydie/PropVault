import { Router } from "express";
import multer from "multer";
import { mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../db.js";
import { authRequired, requireRoles } from "../middleware/auth.js";
import {
  traversePolygon,
  latLngRingToGeoJsonPolygon,
  solveAffineTransform,
  parseCoordinateCsv
} from "../services/cadastralGeometry.js";
import {
  parseGeoJsonImport,
  parseKmlCoordinates,
  csvPointsToParcels,
  featureToWkt,
  lineToWkt,
  parseDxfPolylines
} from "../services/cadastralImport.js";
import { logGisAudit, PARCEL_SELECT, rowToParcel, parcelApiProps } from "../services/cadastralDb.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const UPLOAD_ROOT = join(__dirname, "../../uploads/cadastral");
if (!existsSync(UPLOAD_ROOT)) mkdirSync(UPLOAD_ROOT, { recursive: true });
const upload = multer({
  dest: UPLOAD_ROOT,
  limits: { fileSize: 50 * 1024 * 1024 }
});

const router = Router();
router.use(authRequired);

const canEdit = requireRoles('Admin', 'Staff Assessor');

const DEFAULT_LAYERS = [
  { name: 'Satellite', layer_type: 'satellite', visible: true, z_index: 0, style: { opacity: 1 } },
  { name: 'Street Map', layer_type: 'street', visible: false, z_index: 1, style: { opacity: 0.9 } },
  { name: 'Terrain', layer_type: 'terrain', visible: false, z_index: 2, style: { opacity: 0.85 } },
  {
    name: 'Parcel Boundaries',
    layer_type: 'parcels',
    visible: true,
    z_index: 10,
    style: { color: '#1e3a8a', weight: 1.5, fillOpacity: 0.12 },
  },
  { name: 'Contour Lines', layer_type: 'contours', visible: false, z_index: 8, style: { color: '#8B4513', weight: 1 } },
  { name: 'Section Boundary', layer_type: 'section', visible: true, z_index: 12, style: { color: '#000000', weight: 1 } },
  {
    name: 'Barangay Boundary',
    layer_type: 'barangay',
    visible: true,
    z_index: 14,
    style: { color: '#000000', weight: 2, dashArray: '8 4 2 4' },
  },
  {
    name: 'Municipal Boundary',
    layer_type: 'municipality',
    visible: true,
    z_index: 16,
    style: { color: '#000000', weight: 3, dashArray: '12 4 2 4' },
  },
  { name: 'Shoreline', layer_type: 'shoreline', visible: true, z_index: 6, style: { color: '#1d4ed8', weight: 2 } },
  { name: 'River / Creek', layer_type: 'river', visible: true, z_index: 7, style: { color: '#2563eb', weight: 2 } },
  { name: 'Roads', layer_type: 'road', visible: true, z_index: 9, style: { color: '#78716c', weight: 2, dashArray: '6 4' } },
];

async function ensureDefaultLayers() {
  for (const layer of DEFAULT_LAYERS) {
    await pool.query(
      `INSERT INTO gis_map_layers (name, layer_type, visible, z_index, style)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (name) DO NOTHING`,
      [layer.name, layer.layer_type, layer.visible, layer.z_index, JSON.stringify(layer.style)],
    );
  }
}

router.get("/layers", async (req, res, next) => {
  try {
    await ensureDefaultLayers();
    const { rows } = await pool.query("SELECT * FROM gis_map_layers ORDER BY z_index");
    res.json({ layers: rows });
  } catch (err) {
    next(err);
  }
});

router.put("/layers/:id", canEdit, async (req, res, next) => {
  try {
    const { visible, z_index, style } = req.body;
    const { rows } = await pool.query(
      `UPDATE gis_map_layers SET
         visible = COALESCE($2, visible),
         z_index = COALESCE($3, z_index),
         style = COALESCE($4, style)
       WHERE id = $1 RETURNING *`,
      [req.params.id, visible, z_index, style ? JSON.stringify(style) : null]
    );
    if (!rows.length) return res.status(404).json({ error: "Layer not found" });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.get("/parcels", async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `${PARCEL_SELECT} WHERE p.geometry IS NOT NULL ORDER BY p.lot_number`
    );
    const features = rows.map((r) => ({
      type: "Feature",
      id: r.id,
      geometry: r.geojson,
      properties: parcelApiProps(r),
    }));
    res.json({ type: "FeatureCollection", features });
  } catch (err) {
    next(err);
  }
});

router.get("/parcels/search", async (req, res, next) => {
  try {
    const q = String(req.query.q ?? "").trim();
    if (!q) return res.json({ results: [] });
    const like = `%${q}%`;
    const { rows } = await pool.query(
      `${PARCEL_SELECT}
       WHERE (p.lot_number ILIKE $1 OR p.owner_name ILIKE $1
              OR p.title_number ILIKE $1 OR p.barangay ILIKE $1
              OR p.parcel_id ILIKE $1)
       ORDER BY p.lot_number LIMIT 50`,
      [like]
    );
    res.json({ results: rows.map(parcelApiProps) });
  } catch (err) {
    next(err);
  }
});

router.get("/parcels/:id", async (req, res, next) => {
  try {
    const { rows } = await pool.query(`${PARCEL_SELECT} WHERE p.id = $1`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "Parcel not found" });
    const parcel = {
      ...parcelApiProps(rows[0]),
      geojson: rows[0].geojson,
      areaSqM: rows[0].area_sq_m ?? rows[0].computed_area_sq_m,
    };
    const [vertices, surveys, adjacent, annotations] = await Promise.all([
      pool.query(
        "SELECT * FROM gis_parcel_vertices WHERE parcel_id = $1 ORDER BY sequence_no",
        [parcel.id]
      ),
      pool.query(
        "SELECT * FROM gis_survey_records WHERE parcel_id = $1 ORDER BY created_at DESC",
        [parcel.id]
      ),
      pool.query(
        `SELECT p2.id, p2.lot_number, p2.owner_name, p2.parcel_id
         FROM gis_parcels p2
         WHERE p2.id != $1
           AND ST_Touches((SELECT geometry FROM gis_parcels WHERE id = $1), p2.geometry)
         LIMIT 20`,
        [parcel.id]
      ),
      pool.query("SELECT id, parcel_id, label, annotation_type, ST_AsGeoJSON(geometry)::json AS geojson, properties, created_at FROM gis_annotations WHERE parcel_id = $1", [parcel.id])
    ]);
    res.json({
      parcel,
      vertices: vertices.rows,
      surveyHistory: surveys.rows,
      adjacentLots: adjacent.rows,
      annotations: annotations.rows
    });
  } catch (err) {
    next(err);
  }
});

router.post("/parcels", canEdit, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const userId = req.user?.id ?? null;
    const {
      parcelId,
      lotNumber,
      titleNumber,
      ownerName,
      barangay,
      municipality,
      province,
      status,
      taxDeclarationNo,
      geometry,
      vertices,
      surveyPlanId,
      sectionNo,
      blkNo,
      octNo,
      arpNo,
      pin,
      surveyNo,
      boundNorth,
      boundEast,
      boundSouth,
      boundWest,
      street,
    } = req.body;
    if (!lotNumber || !geometry) {
      return res.status(400).json({ error: "lotNumber and geometry are required" });
    }
    const wkt = featureToWkt(geometry);
    const pid = parcelId ?? `P-${lotNumber}-${Date.now()}`;
    await client.query("BEGIN");
    const { rows } = await client.query(
      `INSERT INTO gis_parcels
         (parcel_id, lot_number, title_number, owner_name, barangay, municipality,
          province, status, tax_declaration_no, geometry, area_sq_m,
          survey_plan_id, section_no, blk_no, oct_no, arp_no, pin, survey_no,
          bound_north, bound_east, bound_south, bound_west, street)
       VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8,'active'),$9, ST_GeomFromText($10, 4326),
               ST_Area(ST_GeomFromText($10, 4326)::geography),
               $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
       RETURNING id`,
      [
        pid,
        lotNumber,
        titleNumber ?? "",
        ownerName ?? "",
        barangay ?? "",
        municipality ?? "Jose P. Rizal",
        province ?? "Palawan",
        status,
        taxDeclarationNo ?? "",
        wkt,
        surveyPlanId ?? null,
        sectionNo ?? "",
        blkNo ?? "",
        octNo ?? "",
        arpNo ?? "",
        pin ?? "",
        surveyNo ?? "",
        boundNorth ?? "",
        boundEast ?? "",
        boundSouth ?? "",
        boundWest ?? "",
        street ?? "",
      ]
    );
    const parcelDbId = rows[0].id;
    if (vertices?.length) {
      for (let i = 0; i < vertices.length; i++) {
        const v = vertices[i];
        await client.query(
          `INSERT INTO gis_parcel_vertices
             (parcel_id, sequence_no, latitude, longitude, bearing, distance_m, label)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [parcelDbId, i + 1, v.lat, v.lng, v.bearing ?? null, v.distanceM ?? null, v.label ?? ""]
        );
      }
    } else if (geometry.coordinates[0]) {
      const ring = geometry.coordinates[0];
      for (let i = 0; i < ring.length - 1; i++) {
        const [lng, lat] = ring[i];
        await client.query(
          `INSERT INTO gis_parcel_vertices (parcel_id, sequence_no, latitude, longitude, label)
           VALUES ($1,$2,$3,$4,$5)`,
          [parcelDbId, i + 1, lat, lng, `P${i + 1}`]
        );
      }
    }
    await logGisAudit(client, {
      userId,
      action: "create",
      entityType: "parcel",
      entityId: parcelDbId,
      detail: { lotNumber, parcelId: pid }
    });
    await client.query("COMMIT");
    const detail = await pool.query(`${PARCEL_SELECT} WHERE p.id = $1`, [parcelDbId]);
    res.status(201).json(rowToParcel(detail.rows[0]));
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
});

router.put("/parcels/:id", canEdit, async (req, res, next) => {
  try {
    const { lotNumber, titleNumber, ownerName, barangay, municipality, province, status, taxDeclarationNo, geometry, vertices,
      surveyPlanId, sectionNo, blkNo, octNo, arpNo, pin, surveyNo,
      boundNorth, boundEast, boundSouth, boundWest, street } = req.body;
    const sets = ["updated_at = now()"];
    const vals = [req.params.id];
    let idx = 2;
    const add = (col, val) => {
      sets.push(`${col} = $${idx++}`);
      vals.push(val);
    };
    if (lotNumber != null) add("lot_number", lotNumber);
    if (titleNumber != null) add("title_number", titleNumber);
    if (ownerName != null) add("owner_name", ownerName);
    if (barangay != null) add("barangay", barangay);
    if (municipality != null) add("municipality", municipality);
    if (province != null) add("province", province);
    if (status != null) add("status", status);
    if (taxDeclarationNo != null) add("tax_declaration_no", taxDeclarationNo);
    if (surveyPlanId !== undefined) add("survey_plan_id", surveyPlanId);
    if (sectionNo != null) add("section_no", sectionNo);
    if (blkNo != null) add("blk_no", blkNo);
    if (octNo != null) add("oct_no", octNo);
    if (arpNo != null) add("arp_no", arpNo);
    if (pin != null) add("pin", pin);
    if (surveyNo != null) add("survey_no", surveyNo);
    if (boundNorth != null) add("bound_north", boundNorth);
    if (boundEast != null) add("bound_east", boundEast);
    if (boundSouth != null) add("bound_south", boundSouth);
    if (boundWest != null) add("bound_west", boundWest);
    if (street != null) add("street", street);
    if (geometry) {
      const wkt = featureToWkt(geometry);
      sets.push(`geometry = ST_GeomFromText($${idx++}, 4326)`);
      vals.push(wkt);
      sets.push(`area_sq_m = ST_Area(ST_GeomFromText($${idx - 1}, 4326)::geography)`);
    }
    const { rows } = await pool.query(
      `UPDATE gis_parcels SET ${sets.join(", ")} WHERE id = $1 RETURNING id`,
      vals
    );
    if (!rows.length) return res.status(404).json({ error: "Parcel not found" });
    if (vertices && Array.isArray(vertices)) {
      await pool.query("DELETE FROM gis_parcel_vertices WHERE parcel_id = $1", [req.params.id]);
      for (let i = 0; i < vertices.length; i++) {
        const v = vertices[i];
        await pool.query(
          `INSERT INTO gis_parcel_vertices (parcel_id, sequence_no, latitude, longitude, bearing, distance_m, label)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [req.params.id, i + 1, v.lat, v.lng, v.bearing ?? null, v.distanceM ?? null, v.label ?? ""]
        );
      }
    }
    const detail = await pool.query(`${PARCEL_SELECT} WHERE p.id = $1`, [req.params.id]);
    res.json(rowToParcel(detail.rows[0]));
  } catch (err) {
    next(err);
  }
});

router.delete("/parcels/:id", canEdit, async (req, res, next) => {
  try {
    const { rowCount } = await pool.query(
      "DELETE FROM gis_parcels WHERE id = $1",
      [req.params.id]
    );
    if (!rowCount) return res.status(404).json({ error: "Parcel not found" });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

router.post("/parcels/merge", canEdit, async (req, res, next) => {
  try {
    const { parcelIds, lotNumber, ownerName } = req.body;
    if (!parcelIds?.length || parcelIds.length < 2) {
      return res.status(400).json({ error: "At least 2 parcel IDs required" });
    }
    const { rows } = await pool.query(
      `WITH merged AS (
         SELECT ST_Union(geometry) AS geom FROM gis_parcels
         WHERE id = ANY($1::int[])
       )
       INSERT INTO gis_parcels (parcel_id, lot_number, owner_name, geometry, area_sq_m)
       SELECT $2, $3, COALESCE($4,''), geom, ST_Area(geom::geography)
       FROM merged
       RETURNING id`,
      [parcelIds, `M-${lotNumber}-${Date.now()}`, lotNumber, ownerName ?? ""]
    );
    await pool.query(
      "UPDATE gis_parcels SET status = $2 WHERE id = ANY($1::int[])",
      [parcelIds, "archived"]
    );
    const detail = await pool.query(`${PARCEL_SELECT} WHERE p.id = $1`, [rows[0].id]);
    res.status(201).json(rowToParcel(detail.rows[0]));
  } catch (err) {
    next(err);
  }
});

router.post("/parcels/:id/split", canEdit, async (req, res, next) => {
  try {
    const { newParcels } = req.body;
    if (!newParcels?.length) return res.status(400).json({ error: "newParcels required" });
    await pool.query(
      "UPDATE gis_parcels SET status = $2 WHERE id = $1",
      [req.params.id, "archived"]
    );
    const created = [];
    for (const np of newParcels) {
      const wkt = featureToWkt(np.geometry);
      const { rows } = await pool.query(
        `INSERT INTO gis_parcels (parcel_id, lot_number, owner_name, geometry, area_sq_m)
         VALUES ($1,$2,$3, ST_GeomFromText($4,4326), ST_Area(ST_GeomFromText($4,4326)::geography))
         RETURNING id`,
        [`S-${np.lotNumber}-${Date.now()}`, np.lotNumber, np.ownerName ?? "", wkt]
      );
      const detail = await pool.query(`${PARCEL_SELECT} WHERE p.id = $1`, [rows[0].id]);
      created.push(rowToParcel(detail.rows[0]));
    }
    res.status(201).json({ parcels: created });
  } catch (err) {
    next(err);
  }
});

router.post("/parcels/from-bearings", canEdit, async (req, res, next) => {
  try {
    const { start, legs, lotNumber, ownerName, barangay, municipality, province, titleNumber } = req.body;
    const points = traversePolygon(start, legs);
    const geometry = latLngRingToGeoJsonPolygon(points);
    const wkt = featureToWkt(geometry);
    const { rows } = await pool.query(
      `INSERT INTO gis_parcels (parcel_id, lot_number, title_number, owner_name,
         barangay, municipality, province, geometry, area_sq_m)
       VALUES ($1,$2,$3,$4,$5,$6,$7, ST_GeomFromText($8,4326), ST_Area(ST_GeomFromText($8,4326)::geography))
       RETURNING id`,
      [
        `B-${lotNumber}-${Date.now()}`,
        lotNumber,
        titleNumber ?? "",
        ownerName ?? "",
        barangay ?? "",
        municipality ?? "",
        province ?? "",
        wkt
      ]
    );
    for (let i = 0; i < points.length; i++) {
      const leg = legs[i - 1];
      await pool.query(
        `INSERT INTO gis_parcel_vertices (parcel_id, sequence_no, latitude, longitude, bearing, distance_m, label)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          rows[0].id,
          i + 1,
          points[i].lat,
          points[i].lng,
          leg?.bearingDeg != null ? `${leg.bearingDeg}\xB0` : null,
          leg?.distanceM ?? null,
          `P${i + 1}`
        ]
      );
    }
    const detail = await pool.query(`${PARCEL_SELECT} WHERE p.id = $1`, [rows[0].id]);
    res.status(201).json(rowToParcel(detail.rows[0]));
  } catch (err) {
    next(err);
  }
});

router.post("/import/geojson", canEdit, async (req, res, next) => {
  try {
    const userId = req.user?.id ?? null;
    const features = parseGeoJsonImport(req.body);
    const imported = await importFeatures(features, userId);
    res.json({ imported: imported.length, parcels: imported });
  } catch (err) {
    next(err);
  }
});

router.post("/import/csv", canEdit, upload.single("file"), async (req, res, next) => {
  try {
    const userId = req.user?.id ?? null;
    const text = req.file ? await (await import("node:fs/promises")).readFile(req.file.path, "utf8") : String(req.body.text ?? "");
    const rows = parseCoordinateCsv(text);
    const features = csvPointsToParcels(rows);
    const imported = await importFeatures(features, userId);
    res.json({ imported: imported.length, parcels: imported });
  } catch (err) {
    next(err);
  }
});

router.post("/import/kml", canEdit, upload.single("file"), async (req, res, next) => {
  try {
    const userId = req.user?.id ?? null;
    const text = req.file ? await (await import("node:fs/promises")).readFile(req.file.path, "utf8") : String(req.body.text ?? "");
    const coordBlocks = [...text.matchAll(/<coordinates>([\s\S]*?)<\/coordinates>/gi)];
    const features = coordBlocks.map((m, i) => {
      const pts = parseKmlCoordinates(m[1]);
      return {
        lotNumber: `KML-${i + 1}`,
        geometry: latLngRingToGeoJsonPolygon(pts)
      };
    });
    const imported = await importFeatures(features, userId);
    res.json({ imported: imported.length, parcels: imported });
  } catch (err) {
    next(err);
  }
});

router.post("/import/dxf", canEdit, upload.single("file"), async (req, res, next) => {
  try {
    const userId = req.user?.id ?? null;
    if (!req.file) return res.status(400).json({ error: "DXF file required" });
    const text = await (await import("node:fs/promises")).readFile(req.file.path, "utf8");
    const polygons = parseDxfPolylines(text);
    if (!polygons.length) {
      return res.status(400).json({
        error: "No polylines found. Export from QGIS/CAD as GeoJSON or Shapefile for best results."
      });
    }
    const features = polygons.map((geometry, i) => ({
      lotNumber: `DXF-${i + 1}`,
      geometry
    }));
    const imported = await importFeatures(features, userId);
    res.json({ imported: imported.length, parcels: imported });
  } catch (err) {
    next(err);
  }
});

async function importFeatures(features, userId) {
  const imported = [];
  for (const f of features) {
    const wkt = featureToWkt(f.geometry);
    const { rows } = await pool.query(
      `INSERT INTO gis_parcels (parcel_id, lot_number, title_number, owner_name,
         barangay, municipality, province, tax_declaration_no, geometry, area_sq_m, properties)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8, ST_GeomFromText($9,4326),
               ST_Area(ST_GeomFromText($9,4326)::geography), $10)
       ON CONFLICT (parcel_id) DO UPDATE SET
         geometry = EXCLUDED.geometry,
         area_sq_m = EXCLUDED.area_sq_m,
         updated_at = now()
       RETURNING id`,
      [
        `IMP-${f.lotNumber}`,
        f.lotNumber,
        f.titleNumber ?? "",
        f.ownerName ?? "",
        f.barangay ?? "",
        f.municipality ?? "",
        f.province ?? "",
        f.taxDeclarationNo ?? "",
        wkt,
        JSON.stringify(f.properties ?? {})
      ]
    );
    await pool.query(
      `INSERT INTO gis_audit_log (user_id, action, entity_type, entity_id, detail)
       VALUES ($1,'import','parcel',$2,$3)`,
      [userId, rows[0].id, JSON.stringify({ lotNumber: f.lotNumber })]
    );
    const detail = await pool.query(`${PARCEL_SELECT} WHERE p.id = $1`, [rows[0].id]);
    imported.push(rowToParcel(detail.rows[0]));
  }
  return imported;
}

router.get("/contours", async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, elevation_m, interval_m, ST_AsGeoJSON(geometry)::json AS geojson
       FROM gis_contour_lines`
    );
    res.json({
      type: "FeatureCollection",
      features: rows.map((r) => ({
        type: "Feature",
        id: r.id,
        geometry: r.geojson,
        properties: { elevationM: r.elevation_m, intervalM: r.interval_m }
      }))
    });
  } catch (err) {
    next(err);
  }
});

router.post("/contours/import", canEdit, async (req, res, next) => {
  try {
    const { features } = req.body;
    let count = 0;
    for (const f of features ?? []) {
      const wkt = lineToWkt(f.geometry);
      await pool.query(
        `INSERT INTO gis_contour_lines (elevation_m, interval_m, geometry)
         VALUES ($1,$2, ST_GeomFromText($3,4326))`,
        [f.elevationM, f.intervalM ?? 5, wkt]
      );
      count++;
    }
    res.json({ imported: count });
  } catch (err) {
    next(err);
  }
});

router.post("/survey-records", canEdit, upload.single("plan"), async (req, res, next) => {
  try {
    const userId = req.user?.id ?? null;
    const { surveyNo, surveyor, surveyDate, notes, parcelId } = req.body;
    const planPath = req.file?.path ?? "";
    const { rows } = await pool.query(
      `INSERT INTO gis_survey_records
         (parcel_id, survey_no, surveyor, survey_date, plan_file_path, plan_mime_type, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [
        parcelId ? Number(parcelId) : null,
        surveyNo ?? "",
        surveyor ?? "",
        surveyDate || null,
        planPath,
        req.file?.mimetype ?? "",
        notes ?? "",
        userId
      ]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.put("/survey-records/:id/georef", canEdit, async (req, res, next) => {
  try {
    const { controlPoints, coordinateSystem } = req.body;
    const transform = solveAffineTransform(controlPoints);
    const { rows } = await pool.query(
      `UPDATE gis_survey_records SET
         control_points = $2,
         georef_transform = $3,
         coordinate_system = COALESCE($4, coordinate_system),
         workflow_step = 'georeference',
         updated_at = now()
       WHERE id = $1 RETURNING *`,
      [req.params.id, JSON.stringify(controlPoints), JSON.stringify(transform), coordinateSystem]
    );
    if (!rows.length) return res.status(404).json({ error: "Survey record not found" });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.get("/reports/parcel/:id", async (req, res, next) => {
  try {
    const detail = await pool.query(`${PARCEL_SELECT} WHERE p.id = $1`, [req.params.id]);
    if (!detail.rows.length) return res.status(404).json({ error: "Parcel not found" });
    const parcel = rowToParcel(detail.rows[0]);
    const vertices = await pool.query(
      "SELECT * FROM gis_parcel_vertices WHERE parcel_id = $1 ORDER BY sequence_no",
      [parcel.id]
    );
    const surveys = await pool.query(
      "SELECT * FROM gis_survey_records WHERE parcel_id = $1 ORDER BY survey_date DESC NULLS LAST",
      [parcel.id]
    );
    res.json({
      generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      title: `Cadastral Survey Report \u2014 Lot ${parcel.lot_number}`,
      parcel,
      vertices: vertices.rows,
      surveyHistory: surveys.rows,
      mapExtent: parcel.geojson
    });
  } catch (err) {
    next(err);
  }
});

router.get("/inspect", async (req, res, next) => {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ error: "lat and lng required" });
    }
    const { rows } = await pool.query(
      `${PARCEL_SELECT}
       WHERE ST_Contains(p.geometry, ST_SetSRID(ST_MakePoint($2,$1),4326))
       LIMIT 5`,
      [lat, lng]
    );
    res.json({ parcels: rows.map(parcelApiProps) });
  } catch (err) {
    next(err);
  }
});

router.get("/audit", requireRoles(), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM gis_audit_log ORDER BY created_at DESC LIMIT 100"
    );
    res.json({ logs: rows });
  } catch (err) {
    next(err);
  }
});

export default router;
