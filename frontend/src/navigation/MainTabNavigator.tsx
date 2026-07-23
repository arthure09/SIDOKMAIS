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
      screenOptions={{ headerShown: false }}
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
