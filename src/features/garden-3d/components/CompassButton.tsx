import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, TOUCH } from '../../../shared/ui/theme';

/** North indicator rotated to match the camera; tapping it resets the view. */
export function CompassButton({ northAngleRad, onPress }: { northAngleRad: number; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="North indicator. Tap to reset the view."
      onPress={onPress}
      style={styles.compass}
    >
      <View style={{ transform: [{ rotate: `${northAngleRad}rad` }], alignItems: 'center' }}>
        <Text style={styles.n}>N</Text>
        <Text style={styles.arrow}>▲</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  compass: {
    width: TOUCH + 4,
    height: TOUCH + 4,
    borderRadius: (TOUCH + 4) / 2,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  n: { fontSize: 11, fontWeight: '800', color: colors.danger, lineHeight: 12 },
  arrow: { fontSize: 16, color: colors.danger, lineHeight: 18 },
});
