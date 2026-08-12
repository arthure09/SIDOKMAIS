import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/authStore';
import { colors, radius, shadows, spacing } from '../theme/colors';
import { Text } from '../components/Text';
import { settingsMenu, statsProfil } from '../mocks/profilMock';
import { useTabBarClearance } from '../navigation/tabBarMetrics';
import { useTabBarDockOnScroll } from '../hooks/useTabBarDockOnScroll';
import type { ProfilStackParamList } from '../navigation/types';
import { fetchPasienList } from '../api/pasien';

type Props = NativeStackScreenProps<ProfilStackParamList, 'ProfilDokter'>;

export function ProfilDokterScreen({}: Props) {
  const insets = useSafeAreaInsets();
  const tabBarClearance = useTabBarClearance();
  const { onScroll, scrollEventThrottle, scrolled } = useTabBarDockOnScroll();
  const pengguna = useAuthStore((s) => s.pengguna);
  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);
  const nama = pengguna?.dokter?.nama ?? 'dr. Reza Auditore';
  const spesialisasi = pengguna?.dokter?.spesialisasi ?? 'Spesialisasi belum tersedia';

  const [pasienAktif, setPasienAktif] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadPasienAktif = useCallback(async () => {
    if (!token) return;
    try {
      const result = await fetchPasienList(token, { status: 'ACTIVE', limit: 1 });
      setPasienAktif(result.pagination.total);
    } catch {
      // Statistik pendukung — biarkan placeholder kalau gagal, tidak menghalangi halaman.
    }
  }, [token]);

  useEffect(() => {
    loadPasienAktif();
  }, [loadPasienAktif]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadPasienAktif();
    setRefreshing(false);
  }, [loadPasienAktif]);

  function handleLogout() {
    Alert.alert('Keluar Akun', 'Yakin ingin keluar dari akun ini?', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Keluar', style: 'destructive', onPress: logout },
    ]);
  }

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
        <View style={styles.heroCard}>
          <View style={styles.heroBody}>
            <View style={styles.heroAvatar}>
              <MaterialIcons name="person" size={36} color={colors.primary} />
            </View>
            <View style={styles.heroInfo}>
              <Text style={styles.heroNama} numberOfLines={2}>
                {nama}
              </Text>
              <View style={styles.spesialisasiRow}>
                <MaterialIcons name="medical-services" size={13} color={colors.primary} />
                <Text style={styles.spesialisasiText}>{spesialisasi}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{pasienAktif ?? '–'}</Text>
            <Text style={styles.statLabel}>Pasien Aktif</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{statsProfil.tahunPengalaman}</Text>
            <Text style={styles.statLabel}>Tahun Pengalaman</Text>
            <Text style={styles.statDemoLabel}>Contoh</Text>
          </View>
        </View>

        {/* Setelah "Data Pendapatan" pindah sepenuhnya ke kartu menu di Home,
            tidak ada satu pun item di sini yang punya tujuan navigasi. Jadi
            barisnya View biasa + "Segera hadir", bukan Pressable yang disabled —
            tidak ada yang bisa ditekan untuk sekarang. */}
        <View style={styles.settingsCard}>
          {settingsMenu.map((item, index) => (
            <View key={item.id}>
              <View style={[styles.settingsRow, styles.settingsRowDisabled]}>
                <View style={styles.settingsRowLeft}>
                  <View style={styles.settingsIconCircle}>
                    <MaterialIcons name={item.icon as never} size={20} color={colors.primary} />
                  </View>
                  <Text style={styles.settingsLabel}>{item.label}</Text>
                </View>
                <Text style={styles.settingsSoonText}>Segera hadir</Text>
              </View>
              {index < settingsMenu.length - 1 && <View style={styles.settingsDivider} />}
            </View>
          ))}
        </View>

        <Pressable
          onPress={handleLogout}
          style={({ pressed }) => [styles.logoutButton, pressed && styles.logoutButtonPressed]}
        >
          <MaterialIcons name="logout" size={20} color={colors.error} />
          <Text style={styles.logoutText}>Keluar Akun</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { backgroundColor: colors.background },
  content: { padding: spacing.marginMobile, gap: spacing.gutter, paddingBottom: 32 },

  // Hero didesain kayak badge identitas (avatar rata kiri + nama/spesialisasi
  // di sampingnya) — sengaja BUKAN kartu profil centered+pill generik, dan
  // sengaja gak pakai motif pill lagi (udah dipakai di mana-mana di app ini:
  // search/filter/status chip).
  heroCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.md,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 6,
  },
  heroBody: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 20 },
  heroAvatar: {
    width: 72,
    height: 72,
    borderRadius: 18,
    backgroundColor: colors.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroInfo: { flex: 1, gap: 4 },
  heroNama: { fontSize: 19, fontWeight: '800', color: colors.onBackground },
  spesialisasiRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  spesialisasiText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  statsGrid: { flexDirection: 'row', gap: spacing.base },
  statCard: {
    flex: 1,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.sm,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 4,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 5,
  },
  statValue: { fontSize: 26, fontWeight: '800', color: colors.onBackground },
  statLabel: { fontSize: 13, fontWeight: '600', color: colors.onSurfaceVariant, textAlign: 'center' },
  statDemoLabel: { fontSize: 10, fontWeight: '600', fontStyle: 'italic', color: colors.outline },

  settingsCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.md,
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 5,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
  },
  settingsDivider: { height: 1, backgroundColor: colors.surfaceVariant, marginHorizontal: 20 },
  settingsRowDisabled: { opacity: 0.5 },
  settingsSoonText: { fontSize: 11, fontWeight: '600', fontStyle: 'italic', color: colors.outline },
  settingsRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  settingsIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsLabel: { fontSize: 16, fontWeight: '600', color: colors.onBackground },

  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.errorContainer,
    backgroundColor: 'transparent',
  },
  logoutButtonPressed: { backgroundColor: colors.errorContainer },
  logoutText: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5, color: colors.error },
});
