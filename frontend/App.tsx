import { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { RootNavigator } from './src/navigation/RootNavigator';
import { useNunitoSansFonts } from './src/theme/typography';
import { useAuthStore } from './src/store/authStore';
import { useNotifikasiHp } from './src/hooks/useNotifikasiHp';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  const [fontsLoaded, fontError] = useNunitoSansFonts();
  const authHydrated = useAuthStore((s) => s.hydrated);
  const hydrateAuth = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    hydrateAuth();
  }, [hydrateAuth]);

  useNotifikasiHp();

  useEffect(() => {
    if ((fontsLoaded || fontError) && authHydrated) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError, authHydrated]);

  if ((!fontsLoaded && !fontError) || !authHydrated) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}
