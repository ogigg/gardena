import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import { localBoundary } from '../../domain/garden/garden';
import type { Garden } from '../../domain/garden/types';
import { colors, radius, space, type } from '../../shared/ui/theme';

/** Outline drawn to scale, north up. */
function Thumbnail({ garden }: { garden: Garden }) {
  const pts = localBoundary(garden);
  const xs = pts.map((p) => p.e);
  const ys = pts.map((p) => -p.n);
  const minX = Math.min(...xs),
    maxX = Math.max(...xs),
    minY = Math.min(...ys),
    maxY = Math.max(...ys);
  const s = 48 / Math.max(maxX - minX, maxY - minY, 1);
  const str = pts.map((p) => `${(p.e - minX) * s + 6},${(-p.n - minY) * s + 6}`).join(' ');
  return (
    <Svg width={60} height={60}>
      <Polygon points={str} fill={colors.leafSoft} stroke={colors.leaf} strokeWidth={2} />
    </Svg>
  );
}

/** One saved garden in the home list. */
export function GardenCard({ garden, onPress }: { garden: Garden; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.8 }]}
      accessibilityRole="button"
      accessibilityLabel={`Open ${garden.name}`}
    >
      <Thumbnail garden={garden} />
      <View style={{ flex: 1, marginLeft: space.m }}>
        <Text style={type.heading} numberOfLines={1}>
          {garden.name}
        </Text>
        <Text style={type.small}>
          {Math.round(garden.stats.areaM2)} m² · {garden.objects.length} objects{garden.isDemo ? ' · sample data' : ''}
        </Text>
        <Text style={type.tiny}>{garden.timezone}</Text>
      </View>
      <Text style={{ fontSize: 24, color: colors.inkMuted }}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: space.m,
    backgroundColor: colors.surface,
    borderRadius: radius.l,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: space.s,
  },
});
