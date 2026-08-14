import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ProfilDokterScreen } from '../screens/ProfilDokterScreen';
import type { ProfilStackParamList } from './types';

const Stack = createNativeStackNavigator<ProfilStackParamList>();

export function ProfilStackNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="ProfilDokter"
        component={ProfilDokterScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}
