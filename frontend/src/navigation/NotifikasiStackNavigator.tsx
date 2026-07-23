import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NotifikasiScreen } from '../screens/NotifikasiScreen';
import { DetailLaporanLabScreen } from '../screens/DetailLaporanLabScreen';
import { colors } from '../theme/colors';
import type { NotifikasiStackParamList } from './types';

const Stack = createNativeStackNavigator<NotifikasiStackParamList>();

export function NotifikasiStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerTintColor: colors.primary,
        headerStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen
        name="NotifikasiList"
        component={NotifikasiScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="DetailLaporanLab"
        component={DetailLaporanLabScreen}
        options={{ title: 'Detail Lab' }}
      />
    </Stack.Navigator>
  );
}
