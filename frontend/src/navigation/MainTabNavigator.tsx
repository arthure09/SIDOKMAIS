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
      //
      // popToTopOnBlur: begitu sebuah tab ditinggalkan, stack di dalamnya
      // di-pop balik ke root. Tanpa ini stack tab tujuan nyangkut di screen
      // terakhir (mis. ProfilTab ketinggalan di DataPendapatan setelah dibuka
      // dari tile Menu Home), jadi (a) screen itu tetap ke-mount di belakang
      // layar dan (b) waktu tab-nya dibuka lagi lewat tab bar user mendarat di
      // screen sisa sesi sebelumnya, bukan di root tab.
      //
      // freezeOnBlur: screen tab yang tidak aktif di-suspend dari re-render
      // (react-native-screens 4.16, syaratnya >=3.16). Ini yang menghentikan
      // screen non-aktif "jalan terus" di belakang — mis. debounce search 400ms
      // di PilihPasienHasilLabScreen atau interval/animasi screen lain.
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        popToTopOnBlur: true,
        freezeOnBlur: true,
      }}
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
