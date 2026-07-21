import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '../store/authStore';
import { LoginScreen } from '../screens/LoginScreen';
import { PasienListScreen } from '../screens/PasienListScreen';
import { PasienDetailScreen } from '../screens/PasienDetailScreen';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const token = useAuthStore((s) => s.token);

  return (
    <Stack.Navigator>
      {token ? (
        <>
          <Stack.Screen
            name="PasienList"
            component={PasienListScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="PasienDetail"
            component={PasienDetailScreen}
            options={({ route }) => ({ title: route.params.nama })}
          />
        </>
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      )}
    </Stack.Navigator>
  );
}
