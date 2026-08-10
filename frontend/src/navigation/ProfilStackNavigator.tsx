import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ProfilDokterScreen } from '../screens/ProfilDokterScreen';
import { DataPendapatanScreen } from '../screens/DataPendapatanScreen';
import { CatatanKalenderScreen } from '../screens/CatatanKalenderScreen';
import { colors } from '../theme/colors';
import type { ProfilStackParamList } from './types';

const Stack = createNativeStackNavigator<ProfilStackParamList>();

export function ProfilStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerTintColor: colors.primary,
        headerStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen
        name="ProfilDokter"
        component={ProfilDokterScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="DataPendapatan"
        component={DataPendapatanScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="CatatanKalender"
        component={CatatanKalenderScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}
