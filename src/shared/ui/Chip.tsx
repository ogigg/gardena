import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, radius, space } from './theme';

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

const styles = StyleSheet.create({
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
});
