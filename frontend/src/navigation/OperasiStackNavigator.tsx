import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { JadwalOperasiKonsulScreen } from '../screens/JadwalOperasiKonsulScreen';
import { DetailJadwalOperasiScreen } from '../screens/DetailJadwalOperasiScreen';
import { DetailPembatalanOperasiScreen } from '../screens/DetailPembatalanOperasiScreen';
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
        options={{ title: 'Detail Jadwal' }}
      />
      <Stack.Screen
        name="DetailPembatalanOperasi"
        component={DetailPembatalanOperasiScreen}
        options={{ title: 'Detail Pembatalan' }}
      />
    </Stack.Navigator>
  );
}
