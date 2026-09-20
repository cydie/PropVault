const EARTH_RADIUS_M = 6371e3;
function traversePolygon(start, legs) {
  const points = [{ ...start }];
  let lat = start.lat * Math.PI / 180;
  let lng = start.lng * Math.PI / 180;
  for (const leg of legs) {
    const bearing = leg.bearingDeg * Math.PI / 180;
    const d = leg.distanceM / EARTH_RADIUS_M;
    const lat2 = Math.asin(
      Math.sin(lat) * Math.cos(d) + Math.cos(lat) * Math.sin(d) * Math.cos(bearing)
    );
    const lng2 = lng + Math.atan2(
      Math.sin(bearing) * Math.sin(d) * Math.cos(lat),
      Math.cos(d) - Math.sin(lat) * Math.sin(lat2)
    );
    lat = lat2;
    lng = lng2;
    points.push({ lat: lat2 * 180 / Math.PI, lng: lng2 * 180 / Math.PI });
  }
  return points;
}
function closeRing(coords) {
  if (coords.length < 3) throw new Error("Polygon requires at least 3 vertices");
  const ring = coords.map(([lng, lat]) => [lng, lat]);
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    ring.push([...first]);
  }
  return ring;
}
function latLngRingToGeoJsonPolygon(points) {
  const ring = closeRing(points.map((p) => [p.lng, p.lat]));
  return { type: "Polygon", coordinates: [ring] };
}
function geoJsonToWkt(geometry) {
  if (geometry.type === "Polygon") {
    const ring = geometry.coordinates[0].map(([lng, lat]) => `${lng} ${lat}`).join(", ");
    return `SRID=4326;POLYGON((${ring}))`;
  }
  if (geometry.type === "LineString") {
    const pts = geometry.coordinates.map(([lng, lat]) => `${lng} ${lat}`).join(", ");
    return `SRID=4326;LINESTRING(${pts})`;
  }
  if (geometry.type === "Point") {
    const [lng, lat] = geometry.coordinates;
    return `SRID=4326;POINT(${lng} ${lat})`;
  }
  const g = geometry;
  throw new Error(`Unsupported geometry type: ${g.type}`);
}
function approximateAreaSqM(ring) {
  if (ring.length < 3) return 0;
  const toMeters = (p) => {
    const x = (p.lng - ring[0].lng) * Math.PI / 180 * EARTH_RADIUS_M * Math.cos(ring[0].lat * Math.PI / 180);
    const y = (p.lat - ring[0].lat) * Math.PI / 180 * EARTH_RADIUS_M;
    return { x, y };
  };
  const pts = ring.map(toMeters);
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    sum += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return Math.abs(sum) / 2;
}
function parseCoordinateCsv(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const header = lines[0].toLowerCase().split(",").map((h) => h.trim());
  const latIdx = header.findIndex((h) => h === "lat" || h === "latitude" || h === "y");
  const lngIdx = header.findIndex((h) => h === "lng" || h === "lon" || h === "longitude" || h === "x");
  const lotIdx = header.findIndex((h) => h.includes("lot"));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim());
    const lat = Number(cols[latIdx]);
    const lng = Number(cols[lngIdx]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    rows.push({
      lotNumber: lotIdx >= 0 ? cols[lotIdx] : `LOT-${i}`,
      lat,
      lng
    });
  }
  return rows;
}
function solveAffineTransform(controlPoints) {
  if (controlPoints.length < 3) {
    throw new Error("At least 3 ground control points required for affine transform");
  }
  const n = controlPoints.length;
  let suu = 0, suv = 0, svv = 0, sul = 0, svl = 0, sua = 0, sva = 0;
  for (const p of controlPoints) {
    suu += p.imageX * p.imageX;
    suv += p.imageX * p.imageY;
    svv += p.imageY * p.imageY;
    sul += p.imageX * p.lng;
    svl += p.imageY * p.lng;
    sua += p.imageX * p.lat;
    sva += p.imageY * p.lat;
  }
  const det = suu * svv - suv * suv;
  const a = (sul * svv - svl * suv) / det;
  const b = (suu * svl - suv * sul) / det;
  const c = controlPoints.reduce((s, p) => s + p.lng, 0) / n - a * (controlPoints.reduce((s, p) => s + p.imageX, 0) / n) - b * (controlPoints.reduce((s, p) => s + p.imageY, 0) / n);
  const d = (sua * svv - sva * suv) / det;
  const e = (suu * sva - suv * sua) / det;
  const f = controlPoints.reduce((s, p) => s + p.lat, 0) / n - d * (controlPoints.reduce((s, p) => s + p.imageX, 0) / n) - e * (controlPoints.reduce((s, p) => s + p.imageY, 0) / n);
  return { a, b, c, d, e, f };
}
function applyAffine(t, imageX, imageY) {
  return {
    lng: t.a * imageX + t.b * imageY + t.c,
    lat: t.d * imageX + t.e * imageY + t.f
  };
}
export {
  applyAffine,
  approximateAreaSqM,
  closeRing,
  geoJsonToWkt,
  latLngRingToGeoJsonPolygon,
  parseCoordinateCsv,
  solveAffineTransform,
  traversePolygon
};
