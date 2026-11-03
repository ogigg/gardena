import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ISSUE_TEXT, type BoundaryValidation } from '../../../domain/geometry/polygon';
import type { GardenStats } from '../../../domain/garden/types';
import { Button } from '../../../shared/ui/Button';
import { Segmented } from '../../../shared/ui/Segmented';
import { colors, space, type } from '../../../shared/ui/theme';
import type { Snapshot } from '../hooks/useBoundaryDraft';

export type DrawMode = 'pan' | 'draw';

export function drawingHelpText(mode: DrawMode, snap: Snapshot, validation: BoundaryValidation | null): string {
  if (mode === 'pan') {
    return snap.points.length === 0
      ? 'Find your garden, zoom in close, then switch to “Draw outline”.'
      : 'Map unlocked. Pan and zoom, then switch back to “Draw outline” to edit.';
  }
  if (!snap.closed) {
    return snap.points.length < 3
      ? 'Tap each corner of your garden boundary. The map is locked while drawing.'
      : 'Keep tapping corners. Tap the first corner (or “Close shape”) to finish.';
  }
  return validation?.ok
    ? 'Looks good. Drag corners to adjust, drag + to add a corner, then confirm.'
    : (validation?.issues.map((i) => ISSUE_TEXT[i]).join(' ') ?? '');
}

/** Bottom panel: pan/draw mode switch, guidance, live area and the undo / reset / close / confirm actions. */
export function DrawingToolbar({
  mode,
  onModeChange,
  message,
  snap,
  stats,
  canUndo,
  canConfirm,
  confirmLabel,
  onUndo,
  onReset,
  onClose,
  onConfirm,
  bottomInset,
}: {
  mode: DrawMode;
  onModeChange: (m: DrawMode) => void;
  message: string;
  snap: Snapshot;
  stats: GardenStats | null;
  canUndo: boolean;
  canConfirm: boolean;
  confirmLabel: string;
  onUndo: () => void;
  onReset: () => void;
  onClose: () => void;
  onConfirm: () => void;
  bottomInset: number;
}) {
  return (
    <View style={[styles.panel, { paddingBottom: Math.max(bottomInset, space.m) }]}>
      <Segmented
        value={mode}
        onChange={onModeChange}
        options={[
          { value: 'pan', label: '✋  Move map', hint: 'Pan and zoom the map' },
          { value: 'draw', label: '✎  Draw outline', hint: 'Lock the map and place boundary corners' },
        ]}
      />
      {/* Fixed-height text rows: the map must not resize (and shift) while the user is placing corners. */}
      <Text style={[type.small, styles.helper]} accessibilityLiveRegion="polite" numberOfLines={3}>
        {message}
      </Text>
      <Text style={[type.small, styles.statsLine]} numberOfLines={1}>
        {stats ? (
          <>
            {snap.closed ? 'Area' : 'Area so far'} ≈{' '}
            <Text style={{ fontWeight: '700', color: colors.ink }}>{Math.round(stats.areaM2)} m²</Text> · {snap.points.length} corners ·{' '}
            {stats.lengthM.toFixed(1)} × {stats.widthM.toFixed(1)} m
          </>
        ) : (
          ' '
        )}
      </Text>
      <View style={styles.actions}>
        <Button label="Undo" variant="secondary" onPress={onUndo} disabled={!canUndo} style={styles.action} />
        <Button label="Reset" variant="secondary" onPress={onReset} disabled={snap.points.length === 0} style={styles.action} />
        {snap.closed ? (
          <Button label={confirmLabel} onPress={onConfirm} disabled={!canConfirm} style={[styles.action, { flex: 1.4 }]} />
        ) : (
          <Button label="Close shape" onPress={onClose} disabled={snap.points.length < 3} style={[styles.action, { flex: 1.4 }]} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.surface,
    paddingHorizontal: space.l,
    paddingTop: space.m,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  helper: { marginTop: space.s, marginBottom: space.xs, height: 54 },
  statsLine: { height: 20 },
  actions: { flexDirection: 'row', marginTop: space.s },
  action: { flex: 1, marginRight: space.s },
});
