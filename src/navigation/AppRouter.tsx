import React, { useEffect, useState } from 'react';
import { Alert, Animated, Platform, StyleSheet } from 'react-native';
import { createDemoGarden } from '../domain/garden/demoGarden';
import { FindGardenScreen } from '../features/find-garden/FindGardenScreen';
import { GardenScreen } from '../features/garden-3d/GardenScreen';
import { HomeScreen } from '../features/home/HomeScreen';
import { useGardens } from '../services/storage/GardenStore';
import { useReducedMotion } from '../shared/hooks/useReducedMotion';
import { colors } from '../shared/ui/theme';

type Route =
  | { name: 'home' }
  | { name: 'find-garden'; gardenId?: string }
  | { name: 'garden'; gardenId: string; introFrom?: [number, number][] };

/** Small state-based router: three screens and the staged transitions between them. */
export function AppRouter() {
  const store = useGardens();
  const [route, setRoute] = useState<Route>({ name: 'home' });
  const reducedMotion = useReducedMotion();
  const [fade] = useState(() => new Animated.Value(1));

  // Gentle cross-fade between screens (skipped with Reduce Motion).
  const go = (r: Route) => {
    if (reducedMotion || r.name === 'garden') {
      // the garden screen runs its own staged outline hand-off
      setRoute(r);
      return;
    }
    Animated.timing(fade, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => {
      setRoute(r);
      Animated.timing(fade, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    });
  };
  useEffect(() => {
    fade.setValue(1);
  }, [route.name, fade]);

  const confirmDelete = (id: string) => {
    const doDelete = () => {
      void store.remove(id);
      setRoute({ name: 'home' });
    };
    if (Platform.OS === 'web') {
      doDelete();
      return;
    }
    Alert.alert('Delete garden?', 'This removes the outline and all objects from this device.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: doDelete },
    ]);
  };

  let screen: React.ReactNode = null;
  if (route.name === 'home') {
    screen = (
      <HomeScreen
        gardens={store.gardens}
        ready={store.ready}
        storageError={store.storageError}
        onNew={() => go({ name: 'find-garden' })}
        onOpen={(id) => go({ name: 'garden', gardenId: id })}
        onDemo={() => {
          const existing = store.gardens.find((g) => g.isDemo);
          const demo = existing ?? createDemoGarden();
          if (!existing) store.upsert(demo, { immediate: true });
          go({ name: 'garden', gardenId: demo.id });
        }}
      />
    );
  } else if (route.name === 'find-garden') {
    const editing = route.gardenId ? store.get(route.gardenId) : undefined;
    screen = (
      <FindGardenScreen
        editing={editing}
        onBack={() => go(editing ? { name: 'garden', gardenId: editing.id } : { name: 'home' })}
        onConfirmed={({ garden, windowPoints }) => {
          store.upsert(garden, { immediate: true });
          go({ name: 'garden', gardenId: garden.id, introFrom: windowPoints });
        }}
      />
    );
  } else {
    const g = store.get(route.gardenId);
    screen = g ? (
      <GardenScreen
        key={g.id + (route.introFrom ? ':intro' : '')}
        garden={g}
        introFrom={route.introFrom}
        onChange={(next, opts) => store.upsert(next, opts)}
        onBack={() => go({ name: 'home' })}
        onEditOutline={() => go({ name: 'find-garden', gardenId: g.id })}
        onDelete={() => confirmDelete(g.id)}
      />
    ) : null;
  }

  return <Animated.View style={[styles.fill, { opacity: fade }]}>{screen}</Animated.View>;
}

const styles = StyleSheet.create({ fill: { flex: 1, backgroundColor: colors.bg } });
