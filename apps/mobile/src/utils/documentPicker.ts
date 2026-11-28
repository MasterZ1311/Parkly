import { Alert, Platform } from 'react-native';

export interface PickedDocumentAsset {
  id: string;
  label: string;
  uri: string;
  fileName: string;
  source: 'camera' | 'gallery' | 'sample';
  capturedAt: string;
}

function makeAsset(
  uri: string,
  fileName: string,
  label: string,
  source: PickedDocumentAsset['source'],
): PickedDocumentAsset {
  return {
    id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    label,
    uri,
    fileName,
    source,
    capturedAt: new Date().toISOString(),
  };
}

/**
 * Safely opens native camera or photo gallery via expo-image-picker when available,
 * with a clean simulated scan option when running in Demo Mode or without permissions.
 */
export async function pickDocumentPhoto(
  mode: 'camera' | 'gallery' | 'sample',
  label: string,
): Promise<PickedDocumentAsset | null> {
  if (mode === 'sample') {
    const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return makeAsset(
      `sample://parkly-kyc/${slug}-${Date.now()}.jpg`,
      `${slug || 'document'}-scan.jpg`,
      label,
      'sample',
    );
  }

  let ImagePicker: any = null;
  try {
    // Dynamic require prevents crashes in Jest/Web or unlinked dev binaries
    ImagePicker = require('expo-image-picker');
  } catch {
    ImagePicker = null;
  }

  if (!ImagePicker || Platform.OS === 'web') {
    return pickDocumentPhoto('sample', label);
  }

  try {
    if (mode === 'camera') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm?.granted) {
        Alert.alert(
          'Camera Permission Needed',
          'Grant camera access in Settings or use Gallery / Sample Scan to attach this document.',
        );
        return null;
      }
      const res = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.72,
      });
      if (res?.canceled || !res?.assets?.[0]?.uri) return null;
      const asset = res.assets[0];
      const name = asset.fileName || `${label.toLowerCase().replace(/\s+/g, '-')}.jpg`;
      return makeAsset(asset.uri, name, label, 'camera');
    }

    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm?.granted) {
      Alert.alert(
        'Photo Access Needed',
        'Allow photo library access to upload KYC documents and parking plot images.',
      );
      return null;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.72,
    });
    if (res?.canceled || !res?.assets?.[0]?.uri) return null;
    const asset = res.assets[0];
    const name = asset.fileName || `${label.toLowerCase().replace(/\s+/g, '-')}.jpg`;
    return makeAsset(asset.uri, name, label, 'gallery');
  } catch {
    Alert.alert(
      'Picker Unavailable on This Build',
      'Attaching a verified placeholder scan reference instead. Rebuild native APK to enable direct camera/gallery access.',
    );
    return pickDocumentPhoto('sample', label);
  }
}
