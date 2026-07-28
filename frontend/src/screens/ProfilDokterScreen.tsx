import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
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

export function ProfilDokterScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const tabBarClearance = useTabBarClearance();
  const { onScroll, scrollEventThrottle, scrolled } = useTabBarDockOnScroll();
  const pengguna = useAuthStore((s) => s.pengguna);
  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);
  const nama = pengguna?.dokter?.nama ?? 'dr. Reza Auditore';
  const spesialisasi = pengguna?.dokter?.spesialisasi ?? 'Spesialis Kelamin';

  const [pasienAktif, setPasienAktif] = useState<number | null>(null);

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

  function handleLogout() {
    Alert.alert('Keluar Akun', 'Yakin ingin keluar dari akun ini?', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Keluar', style: 'destructive', onPress: logout },
    ]);
  }

  function handleMenuPress(id: string) {
    if (id === 'pendapatan') {
      navigation.navigate('DataPendapatan');
    }
    // Item lain (Pengaturan Notifikasi, Tentang Aplikasi, Keamanan Akun) belum
    // ada tujuan navigasinya di batch ini — statis dulu.
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { height: insets.top }, scrolled && shadows.header]} />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: tabBarClearance }]}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={scrollEventThrottle}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroAvatar}>
            <MaterialIcons name="person" size={48} color={colors.primary} />
          </View>
          <Text style={styles.heroNama}>{nama}</Text>
          <View style={styles.spesialisasiPill}>
            <MaterialIcons name="medical-services" size={16} color={colors.primary} />
            <Text style={styles.spesialisasiText}>{spesialisasi}</Text>
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
          </View>
        </View>

        <View style={styles.settingsCard}>
          {settingsMenu.map((item, index) => (
            <Pressable
              key={item.id}
              onPress={() => handleMenuPress(item.id)}
              style={({ pressed }) => [
                styles.settingsRow,
                index < settingsMenu.length - 1 && styles.settingsRowBorder,
                pressed && styles.settingsRowPressed,
              ]}
            >
              <View style={styles.settingsRowLeft}>
                <View style={styles.settingsIconCircle}>
                  <MaterialIcons name={item.icon as never} size={20} color={colors.primary} />
                </View>
                <Text style={styles.settingsLabel}>{item.label}</Text>
              </View>
              <MaterialIcons name="chevron-right" size={22} color={colors.outline} />
            </Pressable>
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

  heroCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    gap: 12,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  heroAvatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroNama: { fontSize: 24, fontWeight: '800', color: colors.onBackground, textAlign: 'center' },
  spesialisasiPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: `${colors.primary}1A`,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.full,
  },
  spesialisasiText: { fontSize: 12, fontWeight: '600', color: colors.primary },

  statsGrid: { flexDirection: 'row', gap: spacing.base },
  statCard: {
    flex: 1,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 24,
    paddingVertical: 20,
    alignItems: 'center',
    gap: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 1,
  },
  statValue: { fontSize: 28, fontWeight: '800', color: colors.onBackground },
  statLabel: { fontSize: 12, color: colors.onSurfaceVariant, textAlign: 'center' },

  settingsCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 1,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
  },
  settingsRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.surfaceVariant },
  settingsRowPressed: { backgroundColor: colors.surfaceSoft },
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
    paddingVertical: 16,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.error,
  },
  logoutButtonPressed: { backgroundColor: colors.errorContainer },
  logoutText: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5, color: colors.error },
});
