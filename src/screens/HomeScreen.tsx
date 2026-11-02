import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Polygon } from 'react-native-svg';
import { config } from '../config/env';
import { localBoundary } from '../garden/model';
import type { Garden } from '../geo/types';
import { availableImagery } from '../providers/imagery';
import { Banner, Button } from '../ui/controls';
import { colors, radius, space, type } from '../ui/theme';

function Thumb({ g }: { g: Garden }) {
  const pts = localBoundary(g);
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

export function HomeScreen({
  gardens,
  ready,
  storageError,
  onNew,
  onOpen,
  onDemo,
}: {
  gardens: Garden[];
  ready: boolean;
  storageError?: string;
  onNew: () => void;
  onOpen: (id: string) => void;
  onDemo: () => void;
}) {
  const insets = useSafeAreaInsets();
  const imagery = availableImagery(config);
  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.xl, paddingHorizontal: space.xl }}
    >
      <Text style={styles.brand}>Gardena</Text>
      <Text style={[type.body, { color: colors.inkSoft, marginTop: space.xs }]}>
        Trace your garden from above, then see it in 3D with modelled sun and shade.
      </Text>

      <View style={styles.hero}>
        <Button label="Find your garden" onPress={onNew} accessibilityHint="Search an address and draw the boundary" />
        <Button
          label="Try the demo garden"
          variant="secondary"
          onPress={onDemo}
          style={{ marginTop: space.s }}
          accessibilityHint="Opens a sample garden with invented buildings"
        />
        <Text style={[type.tiny, { marginTop: space.m }]}>
          Aerial imagery: {imagery.map((i) => i.name).join(', ')}. Elsewhere you can draw on a metric grid. No account needed — gardens are
          stored on this device only.
        </Text>
      </View>

      {storageError ? <Banner tone="warn">{storageError}</Banner> : null}

      <Text style={[type.heading, { marginTop: space.xl, marginBottom: space.s }]}>Your gardens</Text>
      {!ready ? (
        <ActivityIndicator color={colors.leaf} />
      ) : gardens.length === 0 ? (
        <View style={styles.empty}>
          <Text style={type.body}>No gardens yet.</Text>
          <Text style={[type.small, { marginTop: space.xs }]}>
            Start by finding your garden on the map, or open the demo to explore first.
          </Text>
        </View>
      ) : (
        gardens.map((g) => (
          <Pressable
            key={g.id}
            onPress={() => onOpen(g.id)}
            style={({ pressed }) => [styles.card, pressed && { opacity: 0.8 }]}
            accessibilityRole="button"
            accessibilityLabel={`Open ${g.name}`}
          >
            <Thumb g={g} />
            <View style={{ flex: 1, marginLeft: space.m }}>
              <Text style={type.heading} numberOfLines={1}>
                {g.name}
              </Text>
              <Text style={type.small}>
                {Math.round(g.stats.areaM2)} m² · {g.objects.length} objects{g.isDemo ? ' · sample data' : ''}
              </Text>
              <Text style={type.tiny}>{g.timezone}</Text>
            </View>
            <Text style={{ fontSize: 24, color: colors.inkMuted }}>›</Text>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  brand: { fontSize: 34, fontWeight: '800', color: colors.leafDark, letterSpacing: -0.5 },
  hero: {
    marginTop: space.xl,
    padding: space.l,
    backgroundColor: colors.surface,
    borderRadius: radius.l,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: space.l,
  },
  empty: { padding: space.l, borderRadius: radius.l, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.line },
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
