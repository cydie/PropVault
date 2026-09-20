/** FAAS Form 1-A value calculations — market value adjustments and assessed value. */

/**
 * @param {Array<{ area?: number, unit_value?: number, base_market_value?: number }>} landRows
 * @param {Array<{ total_count?: number, unit_price?: number, base_market_value?: number, fruit_bearing?: number, non_fruit_bearing?: number }>} plantRows
 * @param {{
 *   adj_road_frontage_pct?: number,
 *   adj_distance_road_pct?: number,
 *   adj_distance_market_pct?: number,
 *   assessment_level_pct?: number,
 * }} adjustments
 */
export function computeFaasValues(landRows = [], plantRows = [], adjustments = {}) {
  const normalizedLand = landRows.map((row, i) => {
    const area = Number(row.area) || 0;
    const unitValue = Number(row.unit_value) || 0;
    const base = row.base_market_value != null && row.base_market_value !== ''
      ? Number(row.base_market_value)
      : area * unitValue;
    return {
      ...row,
      sequence_no: row.sequence_no ?? i + 1,
      area,
      unit_value: unitValue,
      base_market_value: round2(base),
    };
  });

  const normalizedPlants = plantRows.map((row, i) => {
    const fruit = Number(row.fruit_bearing) || 0;
    const nonFruit = Number(row.non_fruit_bearing) || 0;
    const total = Number(row.total_count) || fruit + nonFruit;
    const unitPrice = Number(row.unit_price) || 0;
    const base = row.base_market_value != null && row.base_market_value !== ''
      ? Number(row.base_market_value)
      : total * unitPrice;
    return {
      ...row,
      sequence_no: row.sequence_no ?? i + 1,
      fruit_bearing: fruit,
      non_fruit_bearing: nonFruit,
      total_count: total,
      unit_price: unitPrice,
      base_market_value: round2(base),
    };
  });

  const landMv = normalizedLand.reduce((s, r) => s + (Number(r.base_market_value) || 0), 0);
  const plantsMv = normalizedPlants.reduce((s, r) => s + (Number(r.base_market_value) || 0), 0);
  const baseMarketValue = round2(landMv + plantsMv);

  const roadFrontage = Number(adjustments.adj_road_frontage_pct) || 0;
  const distRoadPct = Number(adjustments.adj_distance_road_pct) || 0;
  const distMarketPct = Number(adjustments.adj_distance_market_pct) || 0;
  const totalAdjustmentsPct = round2(roadFrontage + distRoadPct + distMarketPct);

  const adjustedMarketValue = round2(baseMarketValue * (1 + totalAdjustmentsPct / 100));
  const assessmentLevelPct = Number(adjustments.assessment_level_pct) || 20;
  const assessedValue = round2(adjustedMarketValue * (assessmentLevelPct / 100));

  return {
    landRows: normalizedLand,
    plantRows: normalizedPlants,
    base_market_value: baseMarketValue,
    total_adjustments_pct: totalAdjustmentsPct,
    adjusted_market_value: adjustedMarketValue,
    assessment_level_pct: assessmentLevelPct,
    assessed_value: assessedValue,
  };
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function mapSheetRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    parcelId: row.parcel_id,
    landPropertyId: row.land_property_id,
    tdNo: row.td_no,
    pin: row.pin,
    arpNo: row.arp_no,
    octNo: row.oct_no,
    surveyNo: row.survey_no,
    lotNo: row.lot_no,
    blkNo: row.blk_no,
    entryDate: row.entry_date,
    ownerName: row.owner_name,
    ownerAddress: row.owner_address,
    ownerPhone: row.owner_phone,
    adminName: row.admin_name,
    adminAddress: row.admin_address,
    adminPhone: row.admin_phone,
    street: row.street,
    barangay: row.barangay,
    municipality: row.municipality,
    province: row.province,
    boundNorth: row.bound_north,
    boundEast: row.bound_east,
    boundSouth: row.bound_south,
    boundWest: row.bound_west,
    baseMarketValue: Number(row.base_market_value) || 0,
    adjRoadFrontagePct: Number(row.adj_road_frontage_pct) || 0,
    adjDistanceRoadKm: Number(row.adj_distance_road_km) || 0,
    adjDistanceRoadPct: Number(row.adj_distance_road_pct) || 0,
    adjDistanceMarketKm: Number(row.adj_distance_market_km) || 0,
    adjDistanceMarketPct: Number(row.adj_distance_market_pct) || 0,
    totalAdjustmentsPct: Number(row.total_adjustments_pct) || 0,
    adjustedMarketValue: Number(row.adjusted_market_value) || 0,
    assessmentLevelPct: Number(row.assessment_level_pct) || 20,
    assessedValue: Number(row.assessed_value) || 0,
    taxStatus: row.tax_status,
    actualUse: row.actual_use,
    appraisedBy: row.appraised_by,
    appraisedDate: row.appraised_date,
    recommendingApproval: row.recommending_approval,
    recommendingDate: row.recommending_date,
    approvedBy: row.approved_by,
    approvedDate: row.approved_date,
    memoranda: row.memoranda,
    prevAssessedValue: row.prev_assessed_value != null ? Number(row.prev_assessed_value) : null,
    prevOwner: row.prev_owner,
    effectivityDate: row.effectivity_date,
    recordedBy: row.recorded_by,
    backTaxAssessedValue: row.back_tax_assessed_value != null ? Number(row.back_tax_assessed_value) : null,
    backTaxYearFrom: row.back_tax_year_from,
    backTaxYearTo: row.back_tax_year_to,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
