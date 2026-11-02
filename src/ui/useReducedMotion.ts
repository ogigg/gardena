import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Mirrors the OS "Reduce motion" setting. Returns null until the setting is
 * known, so callers can hold animations instead of starting them by mistake.
 */
export function useReducedMotionSetting(): boolean | null {
  const [reduced, setReduced] = useState<boolean | null>(null);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => mounted && setReduced(v))
      .catch(() => mounted && setReduced(false));
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => setReduced(v));
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);
  return reduced;
}

/** Boolean convenience: unknown is treated as "reduce", so nothing animates before the setting arrives. */
export function useReducedMotion(): boolean {
  return useReducedMotionSetting() ?? true;
}
