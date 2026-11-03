import { useCallback, useMemo, useRef, useState } from 'react';
import type { LngLat } from '../../../domain/garden/types';
import { computeStats, findCrossingEdges, validateBoundary } from '../../../domain/geometry/polygon';
import { createLocalFrame, toLocal, vertexCentroid } from '../../../domain/geometry/projection';

export interface Snapshot {
  points: LngLat[];
  closed: boolean;
}

const MAX_HISTORY = 100;

/** The outline being drawn: points, closed flag, undo history and live validation. */
export function useBoundaryDraft(initial?: LngLat[]) {
  const [snap, setSnap] = useState<Snapshot>({ points: initial ?? [], closed: !!initial });
  const history = useRef<Snapshot[]>([]);
  const [canUndo, setCanUndo] = useState(false);

  const commit = useCallback((next: Snapshot) => {
    setSnap((prev) => {
      history.current.push(prev);
      if (history.current.length > MAX_HISTORY) history.current.shift();
      return next;
    });
    setCanUndo(true);
  }, []);

  const undo = () => {
    const prev = history.current.pop();
    if (prev) setSnap(prev);
    setCanUndo(history.current.length > 0);
  };
  const reset = () => commit({ points: [], closed: false });
  const close = () => {
    if (snap.points.length >= 3) commit({ points: snap.points, closed: true });
  };

  const validation = useMemo(() => (snap.closed ? validateBoundary(snap.points) : null), [snap]);
  const liveStats = useMemo(() => {
    if (snap.points.length < 3) return null;
    try {
      return computeStats(snap.points);
    } catch {
      return null;
    }
  }, [snap.points]);
  const crossing = useMemo(() => {
    if (snap.points.length < 4) return [] as [number, number][];
    const f = createLocalFrame(vertexCentroid(snap.points));
    const local = snap.points.map((p) => toLocal(f, p));
    if (!snap.closed) {
      // open path: ignore the (not yet drawn) closing edge
      return findCrossingEdges(local).filter(([i, j]) => j !== local.length - 1 && i !== local.length - 1);
    }
    return findCrossingEdges(local);
  }, [snap]);

  return { snap, commit, undo, reset, close, canUndo, validation, liveStats, crossing };
}
