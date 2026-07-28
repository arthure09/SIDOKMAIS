import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { JadwalOperasiKonsulScreen } from '../screens/JadwalOperasiKonsulScreen';
import { DetailJadwalOperasiScreen } from '../screens/DetailJadwalOperasiScreen';
import { DetailKonsulScreen } from '../screens/DetailKonsulScreen';
import { colors } from '../theme/colors';
import type { OperasiStackParamList } from './types';

const Stack = createNativeStackNavigator<OperasiStackParamList>();

export function OperasiStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerTintColor: colors.primary,
        headerStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen
        name="JadwalOperasiKonsul"
        component={JadwalOperasiKonsulScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="DetailJadwalOperasi"
        component={DetailJadwalOperasiScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="DetailKonsul"
        component={DetailKonsulScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}
