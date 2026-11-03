import React from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import type { Garden } from '../../../domain/garden/types';
import { compassLabel } from '../../../domain/geometry/polygon';
import { CONTEXT_RADIUS_M } from '../../../services/obstacles/overpass';
import { config } from '../../../shared/config/env';
import { Button } from '../../../shared/ui/Button';
import { Stepper } from '../../../shared/ui/Stepper';
import { colors, space, TOUCH, type } from '../../../shared/ui/theme';

function InfoRow({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.row}>
      <Text style={[type.small, { width: 120 }]}>{k}</Text>
      <Text style={[type.body, { flex: 1 }]}>{v}</Text>
    </View>
  );
}

/** Saved garden facts, ground reference, surrounding-building data, detail level and delete. */
export function GardenInfoPanel({
  garden,
  onGroundLevelChange,
  onLoadContext,
  loadingContext,
  lowDetail,
  onLowDetailChange,
  onDelete,
}: {
  garden: Garden;
  onGroundLevelChange: (m: number) => void;
  onLoadContext: () => void;
  loadingContext: boolean;
  lowDetail: boolean;
  onLowDetailChange: (v: boolean) => void;
  onDelete: () => void;
}) {
  const { stats } = garden;
  const [lon, lat] = garden.origin;
  const contextNote =
    garden.context.status === 'not-loaded'
      ? 'Surrounding buildings are not loaded — shadows only include objects you add.'
      : garden.context.message;
  return (
    <View style={{ marginTop: space.m }}>
      <InfoRow k="Area" v={`${stats.areaM2.toFixed(1)} m² (approx.)`} />
      <InfoRow k="Size" v={`${stats.lengthM.toFixed(1)} × ${stats.widthM.toFixed(1)} m (bounding rectangle)`} />
      <InfoRow k="Long axis" v={`${stats.orientationDeg.toFixed(0)}° from north (${compassLabel(stats.orientationDeg)})`} />
      <InfoRow k="Perimeter" v={`${stats.perimeterM.toFixed(1)} m · ${garden.boundary.length} corners`} />
      <InfoRow k="Location" v={`${lat.toFixed(5)}, ${lon.toFixed(5)}${garden.isDemo ? ' (sample)' : ''}`} />
      <InfoRow k="Time zone" v={garden.timezone} />
      <InfoRow k="Outline drawn on" v={garden.imagery?.attribution ?? '—'} />
      <Stepper
        label="Ground reference"
        value={garden.groundLevelM}
        unit="m"
        step={0.5}
        min={-500}
        max={5000}
        note="Manual elevation above sea level; terrain and slope are not modelled."
        onChange={onGroundLevelChange}
      />
      <Text style={[type.heading, styles.sectionTitle]}>Surroundings</Text>
      <Text style={type.small}>{contextNote}</Text>
      {garden.context.attribution ? <Text style={type.tiny}>{garden.context.attribution}</Text> : null}
      {!garden.isDemo && config.enableOsmContext ? (
        <>
          <Button
            label={
              garden.context.status === 'loaded' ? 'Reload nearby buildings' : `Load buildings within ${CONTEXT_RADIUS_M} m (OpenStreetMap)`
            }
            variant="secondary"
            loading={loadingContext}
            onPress={onLoadContext}
            style={{ marginTop: space.s }}
          />
          <Text style={type.tiny}>Uses the public Overpass API — development use only. Heights are labelled by source and editable.</Text>
        </>
      ) : null}
      <View style={styles.switchRow}>
        <Text style={[type.body, { flex: 1 }]}>Lower detail (faster, softer shadows)</Text>
        <Switch value={lowDetail} onValueChange={onLowDetailChange} accessibilityLabel="Lower detail rendering" />
      </View>
      <Button label="Delete this garden" variant="danger" onPress={onDelete} style={{ marginTop: space.m }} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  sectionTitle: { marginTop: space.l, marginBottom: space.xs },
  switchRow: { flexDirection: 'row', alignItems: 'center', marginTop: space.m, minHeight: TOUCH },
});
