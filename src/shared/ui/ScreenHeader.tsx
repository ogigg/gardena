import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, space, TOUCH, type } from './theme';

/** Back button + title row used at the top of every non-home screen. */
export function ScreenHeader({
  title,
  subtitle,
  onBack,
  backLabel = 'Back',
  right,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
  backLabel?: string;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel={backLabel} onPress={onBack} style={styles.back} hitSlop={8}>
        <Text style={styles.backText}>‹</Text>
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={subtitle ? type.heading : type.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? <Text style={type.tiny}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.m, paddingVertical: space.s },
  back: { width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center', marginRight: space.xs },
  backText: { fontSize: 34, color: colors.leafDark, marginTop: -4 },
});
