// ============================================================
// Parkly Mobile — FreeMap (Web)
// Real interactive map powered by MapLibre GL JS + OpenFreeMap
// tiles (https://openfreemap.org). No API key required.
// ============================================================

import React, { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

export interface MapSpace {
  id: string;
  name: string;
  lat: number;
  lng: number;
  available: boolean;
  price: number;
}

interface FreeMapProps {
  center: { lat: number; lng: number };
  spaces: MapSpace[];
  onMarkerPress?: (id: string) => void;
}

export default function FreeMap({ center, spaces, onMarkerPress }: FreeMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const onMarkerPressRef = useRef(onMarkerPress);
  onMarkerPressRef.current = onMarkerPress;

  // Initialize the map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [center.lng, center.lat],
      zoom: 12,
    });
    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.addControl(new maplibregl.GeolocateControl({ trackUserLocation: true }), 'top-right');

    // "You are here" marker.
    new maplibregl.Marker({ color: '#38BDF8' })
      .setLngLat([center.lng, center.lat])
      .setPopup(new maplibregl.Popup({ offset: 16 }).setText('You are here'))
      .addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the map centered on the active search location.
  useEffect(() => {
    mapRef.current?.setCenter([center.lng, center.lat]);
  }, [center.lat, center.lng]);

  // Render / refresh parking markers whenever the result set changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    spaces.forEach((s) => {
      if (typeof s.lat !== 'number' || typeof s.lng !== 'number') return;

      const el = document.createElement('div');
      el.textContent = `₹${s.price}`;
      el.style.cssText = [
        `background:${s.available ? '#22C55E' : '#EF4444'}`,
        'color:#fff',
        'font-size:11px',
        'font-weight:700',
        'padding:3px 8px',
        'border-radius:12px',
        'cursor:pointer',
        'box-shadow:0 1px 4px rgba(0,0,0,.4)',
        'white-space:nowrap',
        'font-family:system-ui,sans-serif',
      ].join(';');
      el.onclick = () => onMarkerPressRef.current?.(s.id);

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([s.lng, s.lat])
        .setPopup(
          new maplibregl.Popup({ offset: 16 }).setHTML(
            `<strong>${s.name}</strong><br/>₹${s.price}/hr · ${s.available ? 'Available' : 'Full'}`,
          ),
        )
        .addTo(map);

      markersRef.current.push(marker);
    });
  }, [spaces]);

  return (
    <div
      ref={containerRef}
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' }}
    />
  );
}
