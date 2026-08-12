import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { PasienListScreen } from '../screens/PasienListScreen';
import { PasienDetailScreen } from '../screens/PasienDetailScreen';
import { PilihPasienHasilLabScreen } from '../screens/PilihPasienHasilLabScreen';
import { HasilLabListScreen } from '../screens/HasilLabListScreen';
import { HasilLabDetailScreen } from '../screens/HasilLabDetailScreen';
import { LihatPdfLabScreen } from '../screens/LihatPdfLabScreen';
import { menuEntryScreenOptions } from './useMenuBack';
import type { PasienStackParamList } from './types';

const Stack = createNativeStackNavigator<PasienStackParamList>();

export function PasienStackNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="PasienList" component={PasienListScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="PasienDetail"
        component={PasienDetailScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="PilihPasienHasilLab"
        component={PilihPasienHasilLabScreen}
        options={menuEntryScreenOptions}
      />
      <Stack.Screen name="HasilLabList" component={HasilLabListScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="HasilLabDetail"
        component={HasilLabDetailScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen name="LihatPdfLab" component={LihatPdfLabScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}
