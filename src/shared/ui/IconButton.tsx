import React from 'react';
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { colors, TOUCH } from './theme';

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

const styles = StyleSheet.create({
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
});
