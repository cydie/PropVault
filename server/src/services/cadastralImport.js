import {
  closeRing,
  geoJsonToWkt,
  latLngRingToGeoJsonPolygon
} from "./cadastralGeometry.js";
function polygonFromCoords(coords) {
  return { type: "Polygon", coordinates: coords };
}
function parseGeoJsonImport(body) {
  const features = [];
  const root = body;
  const list = root.type === "FeatureCollection" && root.features ? root.features : [{ geometry: root.geometry, properties: root.properties, id: root.id }];
  for (const f of list) {
    if (!f.geometry) continue;
    let geometry = null;
    const g = f.geometry;
    if (g.type === "Polygon") geometry = g;
    if (g.type === "MultiPolygon" && Array.isArray(g.coordinates) && g.coordinates.length) {
      geometry = { type: "Polygon", coordinates: g.coordinates };
    }
    if (!geometry) continue;
    const props = f.properties ?? {};
    features.push({
      lotNumber: String(props.lot_number ?? props.lotNumber ?? props.LOT_NO ?? f.id ?? `LOT-${features.length + 1}`),
      titleNumber: String(props.title_number ?? props.titleNumber ?? props.TCT ?? ""),
      ownerName: String(props.owner_name ?? props.ownerName ?? props.OWNER ?? ""),
      barangay: String(props.barangay ?? props.BRGY ?? ""),
      municipality: String(props.municipality ?? props.MUN ?? ""),
      province: String(props.province ?? props.PROV ?? ""),
      taxDeclarationNo: String(props.tax_declaration_no ?? props.taxDeclaration ?? ""),
      geometry,
      properties: props
    });
  }
  return features;
}
function parseKmlCoordinates(coordText) {
  const points = [];
  const tuples = coordText.trim().split(/\s+/);
  for (const tuple of tuples) {
    const [lng, lat] = tuple.split(",").map(Number);
    if (Number.isFinite(lat) && Number.isFinite(lng)) points.push({ lat, lng });
  }
  return points;
}
function csvPointsToParcels(rows, bufferM = 5) {
  const deg = bufferM / 111e3;
  return rows.map((row) => {
    const ring = [
      { lat: row.lat - deg, lng: row.lng - deg },
      { lat: row.lat - deg, lng: row.lng + deg },
      { lat: row.lat + deg, lng: row.lng + deg },
      { lat: row.lat + deg, lng: row.lng - deg },
      { lat: row.lat - deg, lng: row.lng - deg }
    ];
    return {
      lotNumber: row.lotNumber,
      geometry: latLngRingToGeoJsonPolygon(ring)
    };
  });
}
function featureToWkt(geometry) {
  const ring = closeRing(geometry.coordinates[0]);
  return geoJsonToWkt({ type: "Polygon", coordinates: [ring] });
}
function lineToWkt(geometry) {
  return geoJsonToWkt(geometry);
}
function parseDxfPolylines(text) {
  const lines = text.split(/\r?\n/);
  const polygons = [];
  let current = [];
  let inPolyline = false;
  for (let i = 0; i < lines.length - 1; i++) {
    const code = lines[i].trim();
    const value = lines[i + 1]?.trim() ?? "";
    if (code === "0" && value === "POLYLINE") {
      inPolyline = true;
      current = [];
    } else if (code === "10" && inPolyline) {
      const x = Number(value);
      const y = Number(lines[i + 3]?.trim() ?? "0");
      if (Number.isFinite(x) && Number.isFinite(y)) current.push([x, y]);
    } else if (code === "0" && value === "SEQEND" && inPolyline) {
      inPolyline = false;
      if (current.length >= 3) {
        polygons.push(polygonFromCoords([closeRing(current)]));
      }
      current = [];
    }
  }
  return polygons;
}
export {
  csvPointsToParcels,
  featureToWkt,
  lineToWkt,
  parseDxfPolylines,
  parseGeoJsonImport,
  parseKmlCoordinates
};
