import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/authStore';
import { colors, radius, shadows, spacing } from '../theme/colors';
import { Text } from '../components/Text';
import { useTabBarClearance } from '../navigation/tabBarMetrics';
import { useTabBarDockOnScroll } from '../hooks/useTabBarDockOnScroll';
import type { ProfilStackParamList } from '../navigation/types';
import { fetchStatistikDashboard } from '../api/dashboard';
import { fetchMe } from '../api/auth';

type Props = NativeStackScreenProps<ProfilStackParamList, 'ProfilDokter'>;

// Gelar dibuang ("dr.", "Sp.PD") supaya inisialnya orangnya, bukan gelarnya:
// "dr. Reza Auditore" → "RA", bukan "DR".
function inisial(nama: string) {
  const kata = nama.split(/\s+/).filter((k) => k && !k.endsWith('.'));
  return (
    kata
      .slice(0, 2)
      .map((k) => k[0]?.toUpperCase() ?? '')
      .join('') || '—'
  );
}

function tampilkanTentang() {
  Alert.alert(
    'Tentang aplikasi',
    'SIDOKMAIS — Sistem Informasi Dokter Dharmais.\n\n' +
      'Aplikasi internal untuk dokter RS Kanker Dharmais: daftar pasien, jadwal ' +
      'operasi & konsultasi, hasil lab, dan jasa medis.\n\n' +
      'Seluruh data masih contoh dan belum tersambung ke SIMRS produksi.',
  );
}

// Dua dari tiga item ini benar-benar jalan. Izin & suara notifikasi memang milik
// setelan sistem, jadi barisnya membuka setelan aplikasi di OS daripada
// menyalin ulang kontrol yang sudah ada di sana. Keamanan akun (ganti kata
// sandi) belum punya endpoint, jadi masih ditandai.
const MENU = [
  {
    id: 'notifikasi',
    label: 'Pengaturan notifikasi',
    icon: 'notifications-active',
    onPress: () => Linking.openSettings(),
  },
  { id: 'tentang', label: 'Tentang aplikasi', icon: 'info', onPress: tampilkanTentang },
  { id: 'keamanan', label: 'Keamanan akun', icon: 'security', onPress: null },
] as const;

export function ProfilDokterScreen({}: Props) {
  const insets = useSafeAreaInsets();
  const tabBarClearance = useTabBarClearance();
  const { onScroll, scrollEventThrottle, scrolled } = useTabBarDockOnScroll();
  const pengguna = useAuthStore((s) => s.pengguna);
  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);
  const setPengguna = useAuthStore((s) => s.setPengguna);

  const dokter = pengguna?.dokter;
  const nama = dokter?.nama ?? pengguna?.username ?? '—';
  const keterangan =
    dokter?.spesialisasi ??
    (pengguna?.role === 'ADMIN' ? 'Akun administrator' : 'Spesialisasi belum tercatat');

  const [statistik, setStatistik] = useState<{
    pasienAktif: number;
    operasiHariIni: number;
    konsulHariIni: number;
  } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Identitas ikut ditarik ulang, bukan cuma angkanya: sesi yang tersimpan bisa
  // lebih tua dari bentuk response sekarang (NIP & SIP baru ikut belakangan),
  // dan itu tidak boleh berarti user harus login ulang buat melihatnya.
  const load = useCallback(async () => {
    if (!token) return;
    const [identitas, hasil] = await Promise.allSettled([
      fetchMe(token),
      fetchStatistikDashboard(token),
    ]);
    // Dua-duanya gagal diam-diam: identitas lama tetap terbaca dari store, dan
    // angka yang belum sempat masuk cukup tampil sebagai "–".
    if (identitas.status === 'fulfilled') setPengguna(identitas.value);
    if (hasil.status === 'fulfilled') {
      setStatistik({
        pasienAktif: hasil.value.pasienAktif,
        operasiHariIni: hasil.value.operasiHariIni,
        konsulHariIni: hasil.value.konsulHariIni,
      });
    }
  }, [token, setPengguna]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  function handleLogout() {
    Alert.alert('Keluar akun', 'Yakin ingin keluar dari akun ini?', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Keluar', style: 'destructive', onPress: logout },
    ]);
  }

  const angkaAktivitas = [
    { label: 'Pasien aktif', value: statistik?.pasienAktif },
    { label: 'Operasi hari ini', value: statistik?.operasiHariIni },
    { label: 'Konsultasi hari ini', value: statistik?.konsulHariIni },
  ];

  return (
    <View style={styles.container}>
      <View style={[styles.header, { height: insets.top }, scrolled && shadows.header]} />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: tabBarClearance }]}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={scrollEventThrottle}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
        }
      >
        {/* Kartu identitas dinas, bukan kartu profil sosial: yang dibawa NIP &
            SIP — dua hal yang memang tercetak di tanda pengenal RS, dan yang
            membedakan halaman ini dari halaman profil aplikasi mana pun.
            Permukaan gelapnya sama dengan panel Jasa Medis, jadi dua layar
            "tentang kamu" terbaca sepasang. */}
        <View style={styles.kartu}>
          <View style={styles.kartuAtas}>
            <View style={styles.inisialKotak}>
              <Text style={styles.inisialText}>{inisial(nama)}</Text>
            </View>
            {/* Nama dapat lebar penuh: gelar spesialis bikin nama panjang, dan
                chip role di sebelahnya sempat memotongnya jadi "Sp....". */}
            <View style={styles.identitas}>
              <Text style={styles.nama}>{nama}</Text>
              <Text style={styles.keterangan}>{keterangan}</Text>
            </View>
          </View>

          {pengguna && (
            <View style={styles.kartuBawah}>
              <View style={styles.dataKolom}>
                {dokter?.nip && (
                  <View style={styles.barisData}>
                    <Text style={styles.barisLabel}>NIP</Text>
                    <Text style={styles.barisNilai} numberOfLines={1}>
                      {dokter.nip}
                    </Text>
                  </View>
                )}
                {dokter?.sip && (
                  <View style={styles.barisData}>
                    <Text style={styles.barisLabel}>SIP</Text>
                    <Text style={styles.barisNilai} numberOfLines={2}>
                      {dokter.sip}
                    </Text>
                  </View>
                )}
                <View style={styles.barisData}>
                  <Text style={styles.barisLabel}>Akun</Text>
                  <Text style={styles.barisNilai} numberOfLines={1}>
                    {pengguna.username}
                  </Text>
                </View>
              </View>
              <View style={styles.roleChip}>
                <Text style={styles.roleChipText}>{pengguna.role}</Text>
              </View>
            </View>
          )}
        </View>

        <View style={styles.aktivitasRow}>
          {angkaAktivitas.map((a) => (
            <View key={a.label} style={styles.aktivitasKartu}>
              <Text style={styles.aktivitasAngka}>{a.value ?? '–'}</Text>
              <Text style={styles.aktivitasLabel}>{a.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.menuKartu}>
          {MENU.map((item, index) => {
            const isi = (
              <>
                <View style={styles.menuKiri}>
                  <View style={styles.menuIkon}>
                    <MaterialIcons name={item.icon} size={20} color={colors.primary} />
                  </View>
                  <Text style={styles.menuLabel}>{item.label}</Text>
                </View>
                {item.onPress ? (
                  <MaterialIcons name="chevron-right" size={22} color={colors.outline} />
                ) : (
                  <Text style={styles.menuSoon}>Segera hadir</Text>
                )}
              </>
            );
            return (
              <View key={item.id}>
                {index > 0 && <View style={styles.menuGaris} />}
                {item.onPress ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={item.onPress}
                    style={({ pressed }) => [styles.menuBaris, pressed && styles.menuBarisDitekan]}
                  >
                    {isi}
                  </Pressable>
                ) : (
                  <View style={[styles.menuBaris, styles.menuBarisMati]}>{isi}</View>
                )}
              </View>
            );
          })}
        </View>

        {/* Keluar akun didorong ke dasar layar: itu aksi penutup, dan ruang
            kosong di antaranya jadi terbaca sebagai jarak yang disengaja, bukan
            sebagai konten yang belum jadi. */}
        <View style={styles.pendorong} />

        <Pressable
          accessibilityRole="button"
          onPress={handleLogout}
          style={({ pressed }) => [styles.logoutButton, pressed && styles.logoutButtonPressed]}
        >
          <MaterialIcons name="logout" size={20} color={colors.error} />
          <Text style={styles.logoutText}>Keluar akun</Text>
        </Pressable>

      </ScrollView>
    </View>
  );
}

// NIP 18 digit & nomor SIP dibaca sebagai deret, bukan sebagai kata — figure
// tabular bikin digitnya rata dan lebih gampang dicocokkan ke kartu fisik.
const angka = { fontVariant: ['tabular-nums' as const] };

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { backgroundColor: colors.background },
  // flexGrow biar pendorong di bawah punya ruang buat mendorong, walaupun
  // isinya lebih pendek dari layar.
  content: { flexGrow: 1, padding: spacing.marginMobile, gap: spacing.gutter, paddingBottom: 32 },
  pendorong: { flex: 1, minHeight: spacing.gutter },

  kartu: {
    backgroundColor: colors.deepTealDark,
    borderRadius: radius.md,
    padding: spacing.cardPadding,
    gap: spacing.gutter,
  },
  kartuAtas: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.gutter },
  inisialKotak: {
    width: 64,
    height: 64,
    borderRadius: radius.sm,
    backgroundColor: `${colors.onPrimary}1F`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inisialText: { fontSize: 24, fontWeight: '800', color: colors.onPrimary, letterSpacing: 1 },
  identitas: { flex: 1, gap: 4, paddingTop: 2 },
  nama: { fontSize: 18, fontWeight: '800', color: colors.onPrimary },
  keterangan: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.surfaceVariant,
  },
  roleChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: `${colors.onPrimary}3D`,
  },
  roleChipText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5, color: colors.surfaceVariant },

  kartuBawah: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.gutter,
    paddingTop: spacing.gutter,
    borderTopWidth: 1,
    borderTopColor: `${colors.onPrimary}24`,
  },
  dataKolom: { flex: 1, gap: 6 },
  barisData: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  barisLabel: { width: 34, fontSize: 11, fontWeight: '700', color: colors.surfaceVariant },
  barisNilai: { ...angka, flex: 1, fontSize: 13, fontWeight: '600', color: colors.onPrimary },

  aktivitasRow: { flexDirection: 'row', gap: spacing.base },
  aktivitasKartu: {
    flex: 1,
    gap: 2,
    paddingVertical: spacing.gutter,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceContainerLowest,
  },
  aktivitasAngka: { ...angka, fontSize: 24, fontWeight: '800', color: colors.onBackground },
  aktivitasLabel: { fontSize: 11, fontWeight: '600', color: colors.onSurfaceVariant },

  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.errorContainer,
  },
  logoutButtonPressed: { backgroundColor: colors.errorContainer },
  logoutText: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5, color: colors.error },

  menuKartu: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  menuBaris: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  menuBarisDitekan: { backgroundColor: colors.surfaceSoft },
  menuBarisMati: { opacity: 0.5 },
  menuGaris: { height: 1, backgroundColor: colors.surfaceVariant, marginHorizontal: 20 },
  menuKiri: { flexDirection: 'row', alignItems: 'center', gap: spacing.gutter },
  menuIkon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: { fontSize: 15, fontWeight: '600', color: colors.onBackground },
  menuSoon: { fontSize: 11, fontWeight: '600', fontStyle: 'italic', color: colors.outline },
});
