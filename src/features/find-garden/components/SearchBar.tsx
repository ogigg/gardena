import React from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { Button } from '../../../shared/ui/Button';
import { colors, radius, space, TOUCH } from '../../../shared/ui/theme';

export function SearchBar({
  query,
  onChangeQuery,
  onSubmit,
  searching,
  onLocate,
  locating,
}: {
  query: string;
  onChangeQuery: (q: string) => void;
  onSubmit: () => void;
  searching: boolean;
  onLocate: () => void;
  locating: boolean;
}) {
  return (
    <View style={styles.row}>
      <TextInput
        value={query}
        onChangeText={onChangeQuery}
        onSubmitEditing={onSubmit}
        placeholder="Address, place, or “lat, lon”"
        placeholderTextColor={colors.inkMuted}
        returnKeyType="search"
        style={styles.input}
        accessibilityLabel="Search for an address"
        autoCorrect={false}
      />
      <Button label="Search" onPress={onSubmit} compact loading={searching} style={{ marginLeft: space.s }} />
      <Button
        label="◎"
        onPress={onLocate}
        compact
        variant="secondary"
        loading={locating}
        style={{ marginLeft: space.s, width: TOUCH }}
        accessibilityHint="Centre the map on your current location"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', paddingHorizontal: space.l, paddingBottom: space.m, alignItems: 'center' },
  input: {
    flex: 1,
    minHeight: TOUCH,
    borderRadius: radius.m,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: space.m,
    fontSize: 16,
    color: colors.ink,
  },
});
