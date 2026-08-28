import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { HomeStackNavigator } from './HomeStackNavigator';
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
      // animation 'fade': default bottom-tabs 'none' potong instan tanpa transisi, kelihatan patah waktu
      // tile Akses Cepat di Home lompat ke tab lain.
      // popToTopOnBlur: tanpa ini, tab yang ditinggalkan di tengah stack (mis. dibuka dari tile Menu Home)
      // nyangkut di screen terakhir — tetap ke-mount di belakang, dan waktu tab dibuka lagi user mendarat
      // di screen sisa sesi sebelumnya, bukan root tab.
      // freezeOnBlur: suspend re-render screen tab non-aktif (react-native-screens >=3.16), menghentikan
      // proses berjalan di belakang seperti debounce search atau animasi screen lain.
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        popToTopOnBlur: true,
        freezeOnBlur: true,
      }}
      tabBar={(props) => <FloatingTabBar {...props} />}
    >
      <Tab.Screen name="HomeTab" component={HomeStackNavigator} />
      <Tab.Screen name="PasienTab" component={PasienStackNavigator} />
      <Tab.Screen name="OperasiTab" component={OperasiStackNavigator} />
      <Tab.Screen name="NotifikasiTab" component={NotifikasiStackNavigator} />
      <Tab.Screen name="ProfilTab" component={ProfilStackNavigator} />
    </Tab.Navigator>
  );
}
