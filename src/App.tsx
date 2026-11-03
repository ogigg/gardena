import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppRouter } from './navigation/AppRouter';
import { GardenStoreProvider } from './services/storage/GardenStore';
import { colors } from './shared/ui/theme';

export default function App() {
  return (
    <SafeAreaProvider>
      <GardenStoreProvider>
        <View style={styles.fill}>
          <AppRouter />
        </View>
        <StatusBar style="dark" />
      </GardenStoreProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1, backgroundColor: colors.bg } });
