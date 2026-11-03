import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import { colors } from '../../../shared/ui/theme';

export interface Morph {
  /** Outline vertices in window coordinates, where they were on the map. */
  from: [number, number][];
  /** The same vertices in window coordinates, on the 3D plan view. */
  to: [number, number][];
  /** Eased progress 0..1. */
  t: number;
}

/** Stage 1 of the map → 3D hand-off: the drawn outline glides onto the 3D plan view. */
export function OutlineMorph({ morph }: { morph: Morph }) {
  // Coordinates are in window space; this overlay sits inside the canvas, so subtract its origin.
  const [origin, setOrigin] = useState<[number, number] | null>(null);
  const ref = useRef<React.ComponentRef<typeof View>>(null);
  useEffect(() => {
    ref.current?.measureInWindow((x, y) => setOrigin([x, y]));
  }, []);
  const o = origin ?? [0, 0];
  const pts = morph.from
    .map((p, i) => {
      const q = morph.to[i];
      return `${p[0] + (q[0] - p[0]) * morph.t - o[0]},${p[1] + (q[1] - p[1]) * morph.t - o[1]}`;
    })
    .join(' ');
  return (
    <View ref={ref} style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(233,239,230,${1 - morph.t * 0.6})` }]} collapsable={false}>
      {origin ? (
        <Svg width="100%" height="100%">
          <Polygon points={pts} fill={colors.outline} fillOpacity={0.35 + 0.4 * morph.t} stroke={colors.outlineStroke} strokeWidth={3} />
        </Svg>
      ) : null}
    </View>
  );
}
