import { useCallback } from 'react';
import { BackHandler } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NavigationProp, ParamListBase } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from './types';

/**
 * Aksi "kembali" untuk screen yang bisa dibuka dari tile Menu di Home
 * (DataPendapatan, CatatanKalender, PilihPasienHasilLab).
 *
 * Screen-screen ini punya dua pintu masuk yang berbeda, jadi tujuan "kembali"-nya
 * juga beda:
 * - Dari tile Menu di Home (`fromHome: true`) → balik ke HomeTab.
 *   `navigation.goBack()` biasa malah pop ke root stack tab tujuan (mis.
 *   ProfilDokter/PasienList, lihat `initial: false` di HomeScreen.handleCardPress)
 *   yang gak pernah sengaja dikunjungi user.
 * - Dari dalam tab-nya sendiri (mis. ProfilDokter → DataPendapatan) → `goBack()`
 *   normal, karena screen sebelumnya memang sengaja dikunjungi. Versi lama
 *   (`goBackToHome`) selalu lompat ke Home dan bikin jalur ini salah.
 *
 * Tombol back Android ikut ditangani di sini supaya tujuannya persis sama dengan
 * tombol back di header — kalau tidak, hardware back tetap pop ke root stack tab
 * tujuan. Saat <Modal> RN lagi kebuka (mis. form di CatatanKalenderScreen),
 * Modal-nya sendiri yang nangkap hardware back lewat `onRequestClose`, jadi
 * listener ini tidak ikut kepanggil.
 */
export function useMenuBack(navigation: NavigationProp<ParamListBase>, fromHome?: boolean) {
  const goBack = useCallback(() => {
    if (!fromHome && navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.getParent<BottomTabNavigationProp<MainTabParamList>>()?.navigate('HomeTab');
  }, [navigation, fromHome]);

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        goBack();
        return true;
      });
      return () => sub.remove();
    }, [goBack]),
  );

  return goBack;
}
