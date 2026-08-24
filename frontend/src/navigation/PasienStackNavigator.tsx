import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { PasienListScreen } from '../screens/PasienListScreen';
import { PasienDetailScreen } from '../screens/PasienDetailScreen';
import { HasilLabListScreen } from '../screens/HasilLabListScreen';
import { HasilLabDetailScreen } from '../screens/HasilLabDetailScreen';
import { RadiologiListScreen } from '../screens/RadiologiListScreen';
import { RadiologiDetailScreen } from '../screens/RadiologiDetailScreen';
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
      <Stack.Screen name="HasilLabList" component={HasilLabListScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="HasilLabDetail"
        component={HasilLabDetailScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="RadiologiList"
        component={RadiologiListScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="RadiologiDetail"
        component={RadiologiDetailScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}
