export async function logGisAudit(client, opts) {
  await client.query(
    `INSERT INTO gis_audit_log (user_id, action, entity_type, entity_id, detail)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      opts.userId,
      opts.action,
      opts.entityType,
      opts.entityId ?? null,
      JSON.stringify(opts.detail ?? {}),
    ],
  );
}

export function rowToParcel(row) {
  return {
    id: Number(row.id),
    parcel_id: String(row.parcel_id),
    lot_number: String(row.lot_number),
    title_number: String(row.title_number ?? ''),
    owner_id: row.owner_id != null ? Number(row.owner_id) : null,
    owner_name: String(row.owner_name ?? ''),
    area_sq_m: row.area_sq_m != null ? Number(row.area_sq_m) : null,
    barangay: String(row.barangay ?? ''),
    municipality: String(row.municipality ?? ''),
    province: String(row.province ?? ''),
    status: String(row.status),
    tax_declaration_no: String(row.tax_declaration_no ?? ''),
    survey_plan_id: row.survey_plan_id != null ? Number(row.survey_plan_id) : null,
    section_no: String(row.section_no ?? ''),
    blk_no: String(row.blk_no ?? ''),
    oct_no: String(row.oct_no ?? ''),
    arp_no: String(row.arp_no ?? ''),
    pin: String(row.pin ?? ''),
    survey_no: String(row.survey_no ?? ''),
    assessor_lot_no: String(row.assessor_lot_no ?? ''),
    survey_lot_no: String(row.survey_lot_no ?? ''),
    land_type_class: String(row.land_type_class ?? ''),
    class_code: String(row.class_code ?? ''),
    kind_code: String(row.kind_code ?? '0001'),
    barangay_index: String(row.barangay_index ?? ''),
    remarks: String(row.remarks ?? ''),
    bound_north: String(row.bound_north ?? ''),
    bound_east: String(row.bound_east ?? ''),
    bound_south: String(row.bound_south ?? ''),
    bound_west: String(row.bound_west ?? ''),
    street: String(row.street ?? ''),
    properties: row.properties ?? {},
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    geojson: row.geojson,
  };
}

export function parcelApiProps(r) {
  return {
    id: r.id,
    parcelId: r.parcel_id,
    lotNumber: r.lot_number,
    titleNumber: r.title_number,
    ownerName: r.owner_name,
    areaSqM: r.area_sq_m ?? r.computed_area_sq_m,
    barangay: r.barangay,
    municipality: r.municipality,
    province: r.province,
    status: r.status,
    taxDeclarationNo: r.tax_declaration_no,
    surveyPlanId: r.survey_plan_id,
    sectionNo: r.section_no ?? '',
    blkNo: r.blk_no ?? '',
    octNo: r.oct_no ?? '',
    arpNo: r.arp_no ?? '',
    pin: r.pin ?? '',
    surveyNo: r.survey_no ?? '',
    assessorLotNo: r.assessor_lot_no ?? '',
    surveyLotNo: r.survey_lot_no ?? '',
    landTypeClass: r.land_type_class ?? '',
    classCode: r.class_code ?? '',
    kindCode: r.kind_code ?? '0001',
    barangayIndex: r.barangay_index ?? '',
    remarks: r.remarks ?? '',
    boundNorth: r.bound_north ?? '',
    boundEast: r.bound_east ?? '',
    boundSouth: r.bound_south ?? '',
    boundWest: r.bound_west ?? '',
    street: r.street ?? '',
  };
}

export const PARCEL_SELECT = `
  SELECT p.*,
         ST_AsGeoJSON(p.geometry)::json AS geojson,
         ST_Area(p.geometry::geography) AS computed_area_sq_m
  FROM gis_parcels p
`;
