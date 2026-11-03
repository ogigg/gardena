import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { IconButton } from './IconButton';
import { space, type } from './theme';

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

const styles = StyleSheet.create({
  stepper: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.s },
});
