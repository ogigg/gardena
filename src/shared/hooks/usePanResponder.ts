/* eslint-disable react-hooks/refs -- the responder is created once; it only reads the
   latest handlers when touch events fire, never during render. */
import { useLayoutEffect, useRef, useState } from 'react';
import { PanResponder, type GestureResponderEvent, type PanResponderGestureState, type PanResponderInstance } from 'react-native';

type H = (e: GestureResponderEvent, g: PanResponderGestureState) => void;
export interface PanHandlers {
  shouldSet?: () => boolean;
  onGrant?: H;
  onMove?: H;
  onRelease?: H;
  onTerminate?: H;
}

/** Stable PanResponder that always calls the latest handlers (no stale closures, no re-creation). */
export function usePanResponder(handlers: PanHandlers): PanResponderInstance {
  const latest = useRef(handlers);
  useLayoutEffect(() => {
    latest.current = handlers;
  });
  const [responder] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => latest.current.shouldSet?.() ?? true,
      onMoveShouldSetPanResponder: () => latest.current.shouldSet?.() ?? true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e, g) => latest.current.onGrant?.(e, g),
      onPanResponderMove: (e, g) => latest.current.onMove?.(e, g),
      onPanResponderRelease: (e, g) => latest.current.onRelease?.(e, g),
      onPanResponderTerminate: (e, g) => (latest.current.onTerminate ?? latest.current.onRelease)?.(e, g),
    }),
  );
  return responder;
}
