import React, { useRef, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { usePanResponder } from '../hooks/usePanResponder';
import { colors } from './theme';

/**
 * Horizontal scrubber (0..1) with optional markers. Calls onChange while
 * dragging (the caller throttles expensive work) and onCommit on release.
 */
export function ScrubBar({
  value,
  onChange,
  onCommit,
  markers = [],
  accessibilityLabel,
  accessibilityValue,
  step = 0.01,
}: {
  value: number;
  onChange: (v: number) => void;
  onCommit?: (v: number) => void;
  markers?: { at: number; label: string }[];
  accessibilityLabel: string;
  accessibilityValue: string;
  step?: number;
}) {
  const [width, setWidth] = useState(1);
  const widthRef = useRef(1);
  const last = useRef(value);
  const pr = usePanResponder({
    onGrant: (e) => {
      const v = clamp01(e.nativeEvent.locationX / widthRef.current);
      last.current = v;
      onChange(v);
    },
    onMove: (e) => {
      const v = clamp01(e.nativeEvent.locationX / widthRef.current);
      last.current = v;
      onChange(v);
    },
    onRelease: () => onCommit?.(last.current),
  });
  const onLayout = (e: LayoutChangeEvent) => {
    widthRef.current = Math.max(1, e.nativeEvent.layout.width);
    setWidth(widthRef.current);
  };
  return (
    <View
      style={styles.scrub}
      onLayout={onLayout}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ text: accessibilityValue }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => {
        const v = clamp01(value + (e.nativeEvent.actionName === 'increment' ? step : -step));
        onChange(v);
        onCommit?.(v);
      }}
      {...pr.panHandlers}
    >
      <View pointerEvents="none" style={styles.scrubTrack} />
      {markers.map((m) => (
        <View key={m.label} pointerEvents="none" style={[styles.scrubMarker, { left: m.at * width - 1 }]}>
          <Text style={styles.scrubMarkerText}>{m.label}</Text>
        </View>
      ))}
      <View pointerEvents="none" style={[styles.scrubFill, { width: value * width }]} />
      <View pointerEvents="none" style={[styles.scrubThumb, { left: value * width - 14 }]} />
    </View>
  );
}

function clamp01(v: number) {
  return Math.min(1, Math.max(0, v));
}

const styles = StyleSheet.create({
  scrub: { height: 56, justifyContent: 'center' },
  scrubTrack: { position: 'absolute', left: 0, right: 0, height: 8, borderRadius: 4, backgroundColor: colors.surfaceAlt },
  scrubFill: { position: 'absolute', left: 0, height: 8, borderRadius: 4, backgroundColor: colors.sun },
  scrubThumb: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 3,
    borderColor: colors.sun,
  },
  scrubMarker: { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: colors.line, alignItems: 'center' },
  scrubMarkerText: { position: 'absolute', top: -2, fontSize: 10, color: colors.inkMuted, width: 60, textAlign: 'center' },
});
