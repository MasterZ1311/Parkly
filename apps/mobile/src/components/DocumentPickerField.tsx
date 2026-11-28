import React from 'react';
import { Alert, Image, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/theme';
import { PressScale, triggerHaptic } from './Motion';
import { pickDocumentPhoto, type PickedDocumentAsset } from '../utils/documentPicker';

interface DocumentPickerFieldProps {
  label: string;
  hint?: string;
  required?: boolean;
  value?: string;
  onChange: (uri: string | undefined) => void;
}

/**
 * Reusable photo/document upload row with Camera, Gallery, and Demo Sample Scan options.
 */
export function DocumentPickerField({
  label,
  hint,
  required,
  value,
  onChange,
}: DocumentPickerFieldProps) {
  const handleSelect = (mode: 'camera' | 'gallery' | 'sample') => {
    triggerHaptic('selection');
    pickDocumentPhoto(mode, label).then((picked: PickedDocumentAsset | null) => {
      if (picked) {
        triggerHaptic('success');
        onChange(picked.uri);
      }
    });
  };

  const openChooser = () => {
    Alert.alert(label, 'Choose how to attach this document or plot picture:', [
      { text: 'Take Photo (Camera)', onPress: () => handleSelect('camera') },
      { text: 'Choose from Gallery', onPress: () => handleSelect('gallery') },
      { text: 'Attach Verified Sample Scan', onPress: () => handleSelect('sample') },
      ...(value
        ? [{ text: 'Remove Attachment', style: 'destructive' as const, onPress: () => onChange(undefined) }]
        : []),
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const isLocalImage = Boolean(value && (value.startsWith('file://') || value.startsWith('content://') || value.startsWith('https://')));

  return (
    <View style={styles.wrap}>
      <View style={styles.topRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>
            {label} {required ? <Text style={{ color: colors.danger }}>*</Text> : null}
          </Text>
          {hint ? <Text style={styles.hint}>{hint}</Text> : null}
        </View>
        {value ? (
          <View style={styles.attachedPill}>
            <Ionicons name="checkmark-circle" size={14} color={colors.success} />
            <Text style={styles.attachedText}>Stored</Text>
          </View>
        ) : (
          <View style={styles.missingPill}>
            <Text style={styles.missingText}>{required ? 'Required' : 'Optional'}</Text>
          </View>
        )}
      </View>

      {value ? (
        <View style={styles.previewRow}>
          {isLocalImage ? (
            <Image source={{ uri: value }} style={styles.thumb} />
          ) : (
            <View style={styles.sampleThumb}>
              <Ionicons name="document-attach-outline" size={22} color={colors.navy} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.fileText} numberOfLines={1}>
              {value.split('/').pop() || value}
            </Text>
            <Text style={styles.fileSub}>Ready for Verification Team review</Text>
          </View>
          <PressScale
            style={styles.changeBtn}
            contentStyle={styles.changeBtnInner}
            onPress={openChooser}
          >
            <Text style={styles.changeBtnText}>Replace</Text>
          </PressScale>
        </View>
      ) : (
        <View style={styles.btnRow}>
          <PressScale
            style={styles.pickBtn}
            contentStyle={styles.pickBtnInner}
            onPress={() => handleSelect('camera')}
          >
            <Ionicons name="camera-outline" size={16} color={colors.navy} />
            <Text style={styles.pickBtnText}>Camera</Text>
          </PressScale>
          <PressScale
            style={styles.pickBtn}
            contentStyle={styles.pickBtnInner}
            onPress={() => handleSelect('gallery')}
          >
            <Ionicons name="images-outline" size={16} color={colors.navy} />
            <Text style={styles.pickBtnText}>Gallery</Text>
          </PressScale>
          <PressScale
            style={styles.sampleBtn}
            contentStyle={styles.pickBtnInner}
            onPress={() => handleSelect('sample')}
          >
            <Ionicons name="scan-outline" size={16} color={colors.primary} />
            <Text style={styles.sampleBtnText}>Sample Scan</Text>
          </PressScale>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.cardElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 10,
  },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  label: { color: colors.navy, fontSize: 13, fontWeight: '800' },
  hint: { color: colors.textMuted, fontSize: 11.5, marginTop: 2, lineHeight: 16 },
  attachedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.successLight,
    borderWidth: 1,
    borderColor: colors.successBorder,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  attachedText: { color: colors.success, fontSize: 11, fontWeight: '800' },
  missingPill: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  missingText: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },
  btnRow: { flexDirection: 'row', gap: 8 },
  pickBtn: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    overflow: 'hidden',
  },
  sampleBtn: {
    flex: 1.2,
    backgroundColor: colors.primaryLight,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    overflow: 'hidden',
  },
  pickBtnInner: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 8,
  },
  pickBtnText: { color: colors.navy, fontSize: 12, fontWeight: '700' },
  sampleBtnText: { color: colors.primary, fontSize: 12, fontWeight: '800' },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 8,
  },
  thumb: { width: 44, height: 44, borderRadius: 8, backgroundColor: colors.cardElevated },
  sampleThumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: colors.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileText: { color: colors.navy, fontSize: 12.5, fontWeight: '700' },
  fileSub: { color: colors.textMuted, fontSize: 11, marginTop: 1 },
  changeBtn: {
    backgroundColor: colors.cardElevated,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    overflow: 'hidden',
  },
  changeBtnInner: { minHeight: 36, paddingHorizontal: 10, justifyContent: 'center', alignItems: 'center' },
  changeBtnText: { color: colors.navy, fontSize: 12, fontWeight: '700' },
});
