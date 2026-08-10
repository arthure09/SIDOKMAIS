import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { HomeScreen } from '../screens/HomeScreen';
import { PasienStackNavigator } from './PasienStackNavigator';
import { OperasiStackNavigator } from './OperasiStackNavigator';
import { NotifikasiStackNavigator } from './NotifikasiStackNavigator';
import { ProfilStackNavigator } from './ProfilStackNavigator';
import { FloatingTabBar } from './FloatingTabBar';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

export function MainTabNavigator() {
  return (
    <Tab.Navigator
      // Default bottom-tabs adalah 'none' (potong instan tanpa transisi) —
      // tile Akses Cepat di Home lompat ke tab lain (mis. ProfilTab), jadi
      // tanpa ini kelihatan patah. 'fade' cross-dissolve 150ms bawaan library,
      // gak nambah animasi custom baru.
      screenOptions={{ headerShown: false, animation: 'fade' }}
      tabBar={(props) => <FloatingTabBar {...props} />}
    >
      <Tab.Screen name="HomeTab" component={HomeScreen} />
      <Tab.Screen name="PasienTab" component={PasienStackNavigator} />
      <Tab.Screen name="OperasiTab" component={OperasiStackNavigator} />
      <Tab.Screen name="NotifikasiTab" component={NotifikasiStackNavigator} />
      <Tab.Screen name="ProfilTab" component={ProfilStackNavigator} />
    </Tab.Navigator>
  );
}
