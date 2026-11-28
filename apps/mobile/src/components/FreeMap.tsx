// ============================================================
// Parkly Mobile — FreeMap (Native Android / iOS)
// Powered by @maplibre/maplibre-react-native + OpenFreeMap tiles
// (https://openfreemap.org). Zero Google Maps keys or billing.
// ============================================================

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  Map,
  Camera,
  Marker,
  UserLocation,
  type CameraRef,
} from '@maplibre/maplibre-react-native';
import { colors } from '../constants/theme';
import { triggerHaptic } from './Motion';

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
  onRegionChange?: (coords: { lat: number; lng: number }, userInitiated: boolean) => void;
}

const OPENFREEMAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

export default function FreeMap({
  center,
  spaces,
  selectedId,
  hasLocationPermission = false,
  onMarkerPress,
  onRegionChange,
}: FreeMapProps) {
  const cameraRef = useRef<CameraRef | null>(null);
  const hasMountedRef = useRef(false);

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    cameraRef.current?.easeTo({
      center: [center.lng, center.lat],
      zoom: 13.2,
      duration: 450,
    });
  }, [center.lat, center.lng]);

  return (
    <View style={styles.container}>
      <Map
        style={styles.map}
        mapStyle={OPENFREEMAP_STYLE}
        androidView="surface"
        logo={false}
        compass
        compassHiddenFacingNorth
        compassPosition={{ top: 12, right: 12 }}
        attribution
        attributionPosition={{ top: 12, left: 12 }}
        onRegionDidChange={(event) => {
          const [lng, lat] = event.nativeEvent.center;
          onRegionChange?.({ lat, lng }, event.nativeEvent.userInteraction);
        }}
      >
        <Camera
          ref={cameraRef}
          initialViewState={{
            center: [center.lng, center.lat],
            zoom: 12.8,
          }}
          minZoom={9}
          maxZoom={18}
        />

        {hasLocationPermission && <UserLocation animated accuracy />}

        {spaces.map((s) => {
          if (typeof s.lat !== 'number' || typeof s.lng !== 'number') return null;
          const isSelected = selectedId === s.id;
          return (
            <Marker
              key={s.id}
              id={s.id}
              lngLat={[s.lng, s.lat]}
              anchor="center"
              onPress={() => {
                triggerHaptic('selection');
                onMarkerPress?.(s.id);
              }}
            >
              <View
                style={[
                  styles.marker,
                  {
                    backgroundColor: s.available ? colors.success : colors.primary,
                    borderColor: isSelected ? colors.navy : colors.white,
                    transform: [{ scale: isSelected ? 1.12 : 1 }],
                  },
                ]}
              >
                <Text style={styles.markerText}>₹{s.price}</Text>
              </View>
            </Marker>
          );
        })}
      </Map>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ECE9DF', position: 'relative' },
  map: { flex: 1 },
  marker: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 46,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    elevation: 4,
    shadowColor: '#0B1628',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.24,
    shadowRadius: 4,
  },
  markerText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
});
