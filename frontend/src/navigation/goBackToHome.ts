import type { NavigationProp, ParamListBase } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from './types';

// Dipakai screen yang CUMA bisa diakses lewat tile Akses Cepat di Home
// (DataPendapatan, CatatanKalender, PilihPasienHasilLab) — navigation.goBack()
// biasa malah pop ke root stack tab tujuan (mis. ProfilDokter/PasienList,
// lihat `initial: false` di HomeScreen.handleCardPress) yang gak pernah
// sengaja dikunjungi user, bukan ke Home tempat mereka berangkat.
export function goBackToHome(navigation: NavigationProp<ParamListBase>) {
  navigation.getParent<BottomTabNavigationProp<MainTabParamList>>()?.navigate('HomeTab');
}
