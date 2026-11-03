import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius, space, TOUCH } from './theme';

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
});
