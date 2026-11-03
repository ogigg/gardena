import React from 'react';
import { Text, View } from 'react-native';
import type { ContextBuilding } from '../../../domain/garden/types';
import { Button } from '../../../shared/ui/Button';
import { Stepper } from '../../../shared/ui/Stepper';
import { space, type } from '../../../shared/ui/theme';
import { HEIGHT_LABEL } from './heightLabels';

/** Height override for a surrounding (OSM or sample) building; editing marks it as set by the user. */
export function ContextBuildingEditor({
  building,
  sourceName,
  onPatch,
  onRemove,
}: {
  building: ContextBuilding;
  sourceName?: string;
  onPatch: (p: Partial<ContextBuilding>) => void;
  onRemove: () => void;
}) {
  return (
    <View style={{ marginTop: space.m }}>
      <Text style={type.heading}>{building.heightSource === 'sample' ? 'Sample building' : 'Nearby building'}</Text>
      <Text style={type.small}>
        {building.sourceRef === 'sample' ? 'Invented for the demo' : `${sourceName ?? ''} · ${building.sourceRef ?? ''}`}
      </Text>
      <Stepper
        label="Height"
        value={building.height}
        unit="m"
        step={0.5}
        min={1}
        max={150}
        note={HEIGHT_LABEL[building.heightSource]}
        onChange={(height) => onPatch({ height, heightSource: 'manual' })}
      />
      <Button label="Remove from scene" variant="danger" onPress={onRemove} />
    </View>
  );
}
