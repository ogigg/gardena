import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { GeocodeResult } from '../../../services/geocoding';
import { Banner } from '../../../shared/ui/Banner';
import { colors, radius, space, TOUCH, type } from '../../../shared/ui/theme';
import type { SearchState } from '../hooks/useAddressSearch';

/** Result list plus loading / no-match / error states for the address search. */
export function SearchResults({
  search,
  onPick,
  hasGlobalGeocoder,
}: {
  search: SearchState;
  onPick: (r: GeocodeResult) => void;
  hasGlobalGeocoder: boolean;
}) {
  switch (search.status) {
    case 'results':
      return (
        <View style={styles.results}>
          <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 240 }}>
            {search.results.map((r, i) => (
              <Pressable key={i} onPress={() => onPick(r)} style={styles.item} accessibilityRole="button">
                <Text style={type.body} numberOfLines={2}>
                  {r.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          {search.attribution ? <Text style={[type.tiny, { padding: space.s }]}>{search.attribution}</Text> : null}
        </View>
      );
    case 'loading':
      return (
        <View style={styles.pill}>
          <ActivityIndicator color={colors.leaf} />
          <Text style={[type.small, { marginLeft: space.s }]}>Searching…</Text>
        </View>
      );
    case 'empty':
      return (
        <Banner tone="warn">
          No matches found. {search.errors.length ? `(${search.errors.join(' · ')}) ` : ''}
          {hasGlobalGeocoder ? '' : 'Without a Geoapify key only Polish addresses are searchable — or type “lat, lon”.'}
        </Banner>
      );
    case 'error':
      return <Banner tone="warn">{search.message}</Banner>;
    default:
      return null;
  }
}

const styles = StyleSheet.create({
  results: { backgroundColor: colors.surface, borderRadius: radius.m, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  item: {
    minHeight: TOUCH,
    paddingHorizontal: space.m,
    paddingVertical: space.s,
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  pill: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: space.m,
    paddingVertical: space.s,
  },
});
