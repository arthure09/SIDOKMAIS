import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeScreen } from '../screens/HomeScreen';
import { DataPendapatanScreen } from '../screens/DataPendapatanScreen';
import { CatatanKalenderScreen } from '../screens/CatatanKalenderScreen';
import { PilihPasienHasilLabScreen } from '../screens/PilihPasienHasilLabScreen';
import { HasilLabListScreen } from '../screens/HasilLabListScreen';
import { HasilLabDetailScreen } from '../screens/HasilLabDetailScreen';
import { LihatPdfLabScreen } from '../screens/LihatPdfLabScreen';
import type { HomeStackParamList } from './types';

const Stack = createNativeStackNavigator<HomeStackParamList>();

/**
 * Stack milik HomeTab: Home plus semua screen yang dibuka dari tile Menu.
 * Sebelumnya screen-screen itu numpang stack tab lain (ProfilTab/PasienTab),
 * jadi "kembali" mendarat di ProfilDokter/PasienList — layar yang tidak pernah
 * sengaja dibuka user — dan gestur swipe iOS terpaksa dimatikan karena pop
 * native-nya tidak bisa dibelokkan dari JS. Di sini urutannya benar dari sananya.
 *
 * Tiga screen Hasil Lab di bawah sengaja didaftarkan juga di
 * `PasienStackNavigator`: alurnya bisa masuk dari dua arah (Menu Home → pilih
 * pasien, atau PasienDetail → hasil lab pasien itu), dan tiap arah harus
 * kembali ke tempat asalnya.
 */
export function HomeStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="DataPendapatan" component={DataPendapatanScreen} />
      <Stack.Screen name="CatatanKalender" component={CatatanKalenderScreen} />
      <Stack.Screen name="PilihPasienHasilLab" component={PilihPasienHasilLabScreen} />
      <Stack.Screen name="HasilLabList" component={HasilLabListScreen} />
      <Stack.Screen name="HasilLabDetail" component={HasilLabDetailScreen} />
      <Stack.Screen name="LihatPdfLab" component={LihatPdfLabScreen} />
    </Stack.Navigator>
  );
}
