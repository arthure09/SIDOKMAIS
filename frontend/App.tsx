import { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { RootNavigator } from './src/navigation/RootNavigator';
import { useNunitoSansFonts } from './src/theme/typography';
import { useAuthStore } from './src/store/authStore';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  const [fontsLoaded, fontError] = useNunitoSansFonts();
  const authHydrated = useAuthStore((s) => s.hydrated);
  const hydrateAuth = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    hydrateAuth();
  }, [hydrateAuth]);

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
      <PaperProvider>
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
        <StatusBar style="auto" />
      </PaperProvider>
    </SafeAreaProvider>
  );
}
