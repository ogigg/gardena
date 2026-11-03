import React from 'react';
import { Text, View } from 'react-native';
import type { GardenObject } from '../../../domain/garden/types';
import { Button } from '../../../shared/ui/Button';
import { Stepper } from '../../../shared/ui/Stepper';
import { space, type } from '../../../shared/ui/theme';
import { HEIGHT_LABEL } from './heightLabels';

/** Size, height, rotation (and canopy for trees) of a bed, tree or building the user placed. */
export function ObjectEditor({
  o,
  onPatch,
  onDelete,
}: {
  o: GardenObject;
  onPatch: (p: Partial<GardenObject>) => void;
  onDelete: () => void;
}) {
  return (
    <View style={{ marginTop: space.m }}>
      <Text style={type.heading}>{o.label}</Text>
      <Stepper
        label="Height"
        value={o.height}
        unit="m"
        step={o.kind === 'bed' ? 0.05 : 0.25}
        min={0.1}
        max={60}
        decimals={2}
        note={HEIGHT_LABEL[o.heightSource]}
        onChange={(height) => onPatch({ height, heightSource: 'manual' })}
      />
      {o.kind === 'tree' ? (
        <Stepper
          label="Canopy radius"
          value={o.canopyRadius ?? 2}
          unit="m"
          step={0.25}
          min={0.3}
          max={15}
          decimals={2}
          onChange={(canopyRadius) => onPatch({ canopyRadius })}
          note="Canopy shadow is approximate."
        />
      ) : (
        <>
          <Stepper
            label="Width"
            value={o.width}
            unit="m"
            step={0.1}
            min={0.2}
            max={60}
            decimals={1}
            onChange={(width) => onPatch({ width })}
          />
          <Stepper
            label="Depth"
            value={o.depth}
            unit="m"
            step={0.1}
            min={0.2}
            max={60}
            decimals={1}
            onChange={(depth) => onPatch({ depth })}
          />
          <Stepper
            label="Rotation"
            value={o.rotationDeg}
            unit="°"
            step={15}
            min={-180}
            max={180}
            decimals={0}
            onChange={(rotationDeg) => onPatch({ rotationDeg })}
          />
        </>
      )}
      <Text style={type.tiny}>
        Position: {o.e.toFixed(1)} m east, {o.n.toFixed(1)} m north of the garden reference point.
      </Text>
      <Button label="Delete object" variant="danger" onPress={onDelete} style={{ marginTop: space.s }} />
    </View>
  );
}
