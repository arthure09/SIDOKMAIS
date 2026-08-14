import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NotifikasiScreen } from '../screens/NotifikasiScreen';
import { DetailNotifikasiScreen } from '../screens/DetailNotifikasiScreen';
import type { NotifikasiStackParamList } from './types';

const Stack = createNativeStackNavigator<NotifikasiStackParamList>();

export function NotifikasiStackNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="NotifikasiList"
        component={NotifikasiScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="DetailNotifikasi"
        component={DetailNotifikasiScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}
