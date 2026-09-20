import { useEffect, useState } from 'react';
import { GeoJSON } from 'react-leaflet';
import { cadastralApi, INDEX_LAYER_STYLES } from '@/lib/cadastralApi';

export type IndexLayerToggles = {
  municipality: boolean;
  barangay: boolean;
  section: boolean;
  shoreline: boolean;
  river: boolean;
  road: boolean;
};

export const DEFAULT_INDEX_TOGGLES: IndexLayerToggles = {
  municipality: true,
  barangay: true,
  section: true,
  shoreline: true,
  river: true,
  road: true,
};

type Props = {
  toggles: IndexLayerToggles;
};

export function SectionIndexLayers({ toggles }: Props) {
  const [boundaries, setBoundaries] = useState<GeoJSON.FeatureCollection | null>(null);
  const [features, setFeatures] = useState<GeoJSON.FeatureCollection | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([cadastralApi.boundaries(), cadastralApi.mapFeatures()])
      .then(([b, f]) => {
        if (cancelled) return;
        setBoundaries(b);
        setFeatures(f);
      })
      .catch(() => {
        if (!cancelled) {
          setBoundaries({ type: 'FeatureCollection', features: [] });
          setFeatures({ type: 'FeatureCollection', features: [] });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const boundaryFeatures = (boundaries?.features || []).filter((f) => {
    const t = String(f.properties?.boundaryType || '');
    if (t === 'municipality') return toggles.municipality;
    if (t === 'barangay') return toggles.barangay;
    if (t === 'section') return toggles.section;
    return false;
  });

  const mapFeatures = (features?.features || []).filter((f) => {
    const t = String(f.properties?.featureType || '');
    if (t === 'shoreline') return toggles.shoreline;
    if (t === 'river' || t === 'creek') return toggles.river;
    if (t === 'road') return toggles.road;
    return false;
  });

  return (
    <>
      {boundaryFeatures.length > 0 && (
        <GeoJSON
          key={`bnd-${toggles.municipality}-${toggles.barangay}-${toggles.section}-${boundaryFeatures.length}`}
          data={{ type: 'FeatureCollection', features: boundaryFeatures }}
          style={(feature) => {
            const t = String(feature?.properties?.boundaryType || 'section');
            return INDEX_LAYER_STYLES[t] || INDEX_LAYER_STYLES.section;
          }}
          onEachFeature={(feature, layer) => {
            const name = feature.properties?.name;
            const code = feature.properties?.code;
            if (name) {
              layer.bindTooltip(code ? `${name} (${code})` : String(name), {
                sticky: true,
                className: 'parcel-label',
              });
            }
          }}
        />
      )}
      {mapFeatures.length > 0 && (
        <GeoJSON
          key={`feat-${toggles.shoreline}-${toggles.river}-${toggles.road}-${mapFeatures.length}`}
          data={{ type: 'FeatureCollection', features: mapFeatures }}
          style={(feature) => {
            const t = String(feature?.properties?.featureType || 'other');
            return INDEX_LAYER_STYLES[t] || { color: '#64748b', weight: 1, fillOpacity: 0 };
          }}
          onEachFeature={(feature, layer) => {
            const name = feature.properties?.name;
            if (name) layer.bindTooltip(String(name), { sticky: true });
          }}
        />
      )}
    </>
  );
}
