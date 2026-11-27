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
  selectedId?: string | null;
  hasLocationPermission?: boolean;
  onMarkerPress?: (id: string) => void;
}

export default function FreeMap({
  center,
  spaces,
  selectedId,
  onMarkerPress,
}: FreeMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const onMarkerPressRef = useRef(onMarkerPress);
  onMarkerPressRef.current = onMarkerPress;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [center.lng, center.lat],
      zoom: 12.6,
    });
    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.addControl(new maplibregl.GeolocateControl({ trackUserLocation: true }), 'top-right');

    const userMarker = new maplibregl.Marker({ color: '#0B1628' })
      .setLngLat([center.lng, center.lat])
      .setPopup(new maplibregl.Popup({ offset: 16 }).setText('Current Map Center'))
      .addTo(map);

    mapRef.current = map;
    userMarkerRef.current = userMarker;

    return () => {
      map.remove();
      mapRef.current = null;
      userMarkerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    mapRef.current?.easeTo({ center: [center.lng, center.lat], duration: 450 });
    userMarkerRef.current?.setLngLat([center.lng, center.lat]);
  }, [center.lat, center.lng]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    spaces.forEach((s) => {
      if (typeof s.lat !== 'number' || typeof s.lng !== 'number') return;

      const isSelected = selectedId === s.id;
      const el = document.createElement('div');
      el.textContent = `₹${s.price}`;
      el.style.cssText = [
        `background:${s.available ? '#0F766E' : '#D90410'}`,
        'color:#FFFFFF',
        'font-size:12px',
        'font-weight:800',
        'padding:5px 10px',
        'border-radius:10px',
        `border:2px solid ${isSelected ? '#0B1628' : '#FFFFFF'}`,
        `transform:${isSelected ? 'scale(1.12)' : 'scale(1)'}`,
        'cursor:pointer',
        'box-shadow:0 2px 6px rgba(11,22,40,0.28)',
        'white-space:nowrap',
        'font-family:system-ui,-apple-system,sans-serif',
      ].join(';');
      el.onclick = () => onMarkerPressRef.current?.(s.id);

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([s.lng, s.lat])
        .setPopup(
          new maplibregl.Popup({ offset: 16 }).setHTML(
            `<strong>${s.name}</strong><br/>₹${s.price}/hr · ${s.available ? 'Available' : 'Full'}`
          )
        )
        .addTo(map);

      markersRef.current.push(marker);
    });
  }, [spaces, selectedId]);

  return (
    <div
      ref={containerRef}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
    />
  );
}
