import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ObjectKind } from '../../../domain/garden/types';
import { colors, radius, space, type } from '../../../shared/ui/theme';

const TILES: { kind: ObjectKind; glyph: string; label: string }[] = [
  { kind: 'bed', glyph: '▭', label: 'Raised bed' },
  { kind: 'tree', glyph: '🌳', label: 'Tree' },
  { kind: 'building', glyph: '⌂', label: 'Building' },
];

export function AddObjectPanel({ onAdd }: { onAdd: (kind: ObjectKind) => void }) {
  return (
    <View style={{ marginTop: space.m }}>
      <Text style={type.small}>New objects are placed in the middle of the view. Switch to “Move objects” to drag them.</Text>
      <View style={styles.row}>
        {TILES.map((t) => (
          <Pressable
            key={t.kind}
            accessibilityRole="button"
            accessibilityLabel={`Add ${t.label}`}
            onPress={() => onAdd(t.kind)}
            style={({ pressed }) => [styles.tile, pressed && { opacity: 0.7 }]}
          >
            <Text style={{ fontSize: 28 }}>{t.glyph}</Text>
            <Text style={[type.small, { color: colors.ink, marginTop: space.xs }]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', marginTop: space.m },
  tile: {
    flex: 1,
    minHeight: 96,
    marginRight: space.s,
    borderRadius: radius.l,
    backgroundColor: colors.leafSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
