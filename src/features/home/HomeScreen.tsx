import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { config } from '../../shared/config/env';
import type { Garden } from '../../domain/garden/types';
import { availableImagery } from '../../services/imagery/providers';
import { Banner } from '../../shared/ui/Banner';
import { Button } from '../../shared/ui/Button';
import { colors, radius, space, type } from '../../shared/ui/theme';
import { GardenCard } from './GardenCard';

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
        gardens.map((g) => <GardenCard key={g.id} garden={g} onPress={() => onOpen(g.id)} />)
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
});
