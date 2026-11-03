import React from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius, space } from './theme';

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

const styles = StyleSheet.create({
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
});
