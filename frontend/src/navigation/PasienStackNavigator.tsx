import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { PasienListScreen } from '../screens/PasienListScreen';
import { PasienDetailScreen } from '../screens/PasienDetailScreen';
import { colors } from '../theme/colors';
import type { PasienStackParamList } from './types';

const Stack = createNativeStackNavigator<PasienStackParamList>();

export function PasienStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerTintColor: colors.primary,
        headerStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="PasienList" component={PasienListScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="PasienDetail"
        component={PasienDetailScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}
