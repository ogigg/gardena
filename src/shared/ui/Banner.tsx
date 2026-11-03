import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius, space, type } from './theme';

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

const styles = StyleSheet.create({
  banner: { borderRadius: radius.m, paddingVertical: space.s, paddingHorizontal: space.m },
});
