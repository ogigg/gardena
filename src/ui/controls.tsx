import React, { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius, space, TOUCH, type } from './theme';
import { usePanResponder } from './usePanResponder';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  icon,
  style,
  compact,
  accessibilityHint,
}: {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  icon?: string;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
  accessibilityHint?: string;
}) {
  const v = variants[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        compact && styles.btnCompact,
        { backgroundColor: v.bg, borderColor: v.border },
        pressed && { opacity: 0.75 },
        disabled && { opacity: 0.4 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <Text style={[styles.btnText, { color: v.fg }]} numberOfLines={1}>
          {icon ? `${icon}  ` : ''}
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const variants: Record<Variant, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.leaf, fg: '#fff', border: colors.leaf },
  secondary: { bg: colors.surface, fg: colors.ink, border: colors.line },
  ghost: { bg: 'transparent', fg: colors.leafDark, border: 'transparent' },
  danger: { bg: colors.surface, fg: colors.danger, border: colors.warnSoft },
};

export function IconButton({
  glyph,
  label,
  onPress,
  active,
  style,
}: {
  glyph: string;
  label: string;
  onPress?: () => void;
  active?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.icon, active && styles.iconActive, pressed && { opacity: 0.7 }, style]}
    >
      <Text style={[styles.iconGlyph, active && { color: '#fff' }]}>{glyph}</Text>
    </Pressable>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  style,
}: {
  options: { value: T; label: string; hint?: string }[];
  value: T;
  onChange: (v: T) => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.seg, style]} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={o.label}
            accessibilityHint={o.hint}
            onPress={() => onChange(o.value)}
            style={[styles.segItem, on && styles.segItemOn]}
          >
            <Text style={[styles.segText, on && styles.segTextOn]} numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Chip({ label, onPress, active }: { label: string; onPress?: () => void; active?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, active && styles.chipOn, pressed && { opacity: 0.7 }]}
    >
      <Text style={[styles.chipText, active && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

export function Banner({
  tone = 'info',
  children,
  style,
}: {
  tone?: 'info' | 'warn' | 'demo' | 'sun';
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const t = {
    info: { bg: colors.infoSoft, fg: colors.info },
    warn: { bg: colors.warnSoft, fg: colors.warn },
    demo: { bg: '#EFE3F6', fg: '#6A3F86' },
    sun: { bg: colors.sunSoft, fg: '#8A5A12' },
  }[tone];
  return (
    <View style={[styles.banner, { backgroundColor: t.bg }, style]} accessibilityRole="text">
      <Text style={[type.small, { color: t.fg }]}>{children}</Text>
    </View>
  );
}

/** +/- stepper with a large touch target; long values stay readable. */
export function Stepper({
  label,
  value,
  unit,
  step,
  min,
  max,
  decimals = 1,
  onChange,
  note,
}: {
  label: string;
  value: number;
  unit: string;
  step: number;
  min: number;
  max: number;
  decimals?: number;
  onChange: (v: number) => void;
  note?: string;
}) {
  const set = (v: number) => onChange(Math.min(max, Math.max(min, Math.round(v / step) * step)));
  return (
    <View style={styles.stepper}>
      <View style={{ flex: 1 }}>
        <Text style={type.small}>{label}</Text>
        <Text style={type.heading}>
          {value.toFixed(decimals)} {unit}
        </Text>
        {note ? <Text style={type.tiny}>{note}</Text> : null}
      </View>
      <IconButton glyph="−" label={`Decrease ${label}`} onPress={() => set(value - step)} />
      <IconButton glyph="+" label={`Increase ${label}`} onPress={() => set(value + step)} style={{ marginLeft: space.s }} />
    </View>
  );
}

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
  btn: {
    minHeight: TOUCH,
    paddingHorizontal: space.l,
    borderRadius: radius.m,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  btnCompact: { minHeight: 40, paddingHorizontal: space.m },
  btnText: { fontSize: 15, fontWeight: '600' },
  icon: {
    width: TOUCH,
    height: TOUCH,
    borderRadius: TOUCH / 2,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconActive: { backgroundColor: colors.leaf, borderColor: colors.leaf },
  iconGlyph: { fontSize: 20, color: colors.ink, fontWeight: '600' },
  seg: { flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderRadius: radius.m, padding: 3 },
  segItem: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: radius.s, paddingHorizontal: space.s },
  segItemOn: {
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  segText: { fontSize: 14, color: colors.inkSoft, fontWeight: '600' },
  segTextOn: { color: colors.ink },
  chip: {
    minHeight: 40,
    paddingHorizontal: space.m,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    justifyContent: 'center',
    marginRight: space.s,
  },
  chipOn: { backgroundColor: colors.leaf, borderColor: colors.leaf },
  chipText: { fontSize: 14, color: colors.ink, fontWeight: '500' },
  banner: { borderRadius: radius.m, paddingVertical: space.s, paddingHorizontal: space.m },
  stepper: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.s },
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
