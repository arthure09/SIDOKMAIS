import { useCallback, useEffect, useState } from 'react';
import { Animated, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/authStore';
import { colors, radius, spacing } from '../theme/colors';
import { Text } from '../components/Text';
import { navigasiCards } from '../mocks/homeMock';
import { useTabBarClearance } from '../navigation/tabBarMetrics';
import { useTabBarDockOnScroll } from '../hooks/useTabBarDockOnScroll';
import { useAnimatedHeaderFade } from '../hooks/useAnimatedHeaderFade';
import type { MainTabParamList } from '../navigation/types';
import { fetchStatistikDashboard } from '../api/dashboard';
import type { AktivitasHarianMingguan, PasienPrioritasItem } from '../api/types';

function formatWaktuPrioritas(iso: string) {
  const d = new Date(iso);
  const tanggal = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  const jam = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  return `${tanggal}, ${jam}`;
}

function formatTanggalHariIni() {
  return new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

type Props = BottomTabScreenProps<MainTabParamList, 'HomeTab'>;

const RINGKASAN_ROWS = [
  { key: 'pasienAktif' as const, label: 'Pasien Aktif', icon: 'groups', tint: colors.primary },
  {
    key: 'operasiHariIni' as const,
    label: 'Operasi Hari Ini',
    icon: 'local-hospital',
    tint: colors.tertiaryContainer,
  },
  { key: 'konsulHariIni' as const, label: 'Konsultasi Hari Ini', icon: 'chat-bubble', tint: colors.primary },
];

// 'chatbot' masih digeser keluar scope — tombolnya non-aktif dulu. 'hasillab'
// diaktifkan Hari 19 (docs/prompts/prompts-day-21-18-19.md), arahnya ke layar
// pilih pasien dulu (endpoint /api/lab discope per pasienId, bukan No. RM).
const NAVIGABLE_CARD_IDS = new Set(['pendapatan', 'hasillab']);

// Tint per kartu quick action biar grid gak 3 lingkaran putih identik —
// reuse warna yang udah ada di tempat lain, bukan warna baru.
const NAVIGASI_TINTS: Record<string, string> = {
  pendapatan: colors.tertiary,
  hasillab: colors.primaryContainer,
  chatbot: colors.outline,
};

export function HomeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const tabBarClearance = useTabBarClearance();
  const { onScroll, scrollEventThrottle, scrolled } = useTabBarDockOnScroll();
  const dokterNama = useAuthStore((s) => s.pengguna?.dokter?.nama);
  const token = useAuthStore((s) => s.token);

  const [ringkasan, setRingkasan] = useState({ pasienAktif: 0, operasiHariIni: 0, konsulHariIni: 0 });
  const [ringkasanLoading, setRingkasanLoading] = useState(true);
  const [aktivitasMingguan, setAktivitasMingguan] = useState<AktivitasHarianMingguan[]>([]);
  const [pasienPrioritas, setPasienPrioritas] = useState<PasienPrioritasItem[]>([]);

  const { headerBackgroundColor, headerShadowOpacity, headerElevation } = useAnimatedHeaderFade(scrolled);

  // Tinggi bar chart dinormalisasi relatif ke hari tersibuk minggu ini (bukan
  // skala tetap) — jumlah mentah dari backend adalah gabungan Kunjungan +
  // Operasi per hari, lihat dashboard.routes.js.
  const maxAktivitasMingguan = Math.max(1, ...aktivitasMingguan.map((a) => a.jumlah));

  const loadRingkasan = useCallback(async () => {
    if (!token) return;
    setRingkasanLoading(true);
    try {
      const statistik = await fetchStatistikDashboard(token);
      setRingkasan({
        pasienAktif: statistik.pasienAktif,
        operasiHariIni: statistik.operasiHariIni,
        konsulHariIni: statistik.konsulHariIni,
      });
      // Fallback ke [] kalau backend yang dihit belum punya field ini (mis.
      // backend belum di-redeploy setelah frontend di-update) — biar
      // HomeScreen gak crash (`.length`/`.map` of undefined), cuma tampil
      // kosong sampai backend-nya disamakan.
      setAktivitasMingguan(statistik.aktivitasMingguan ?? []);
      setPasienPrioritas(statistik.pasienPrioritas ?? []);
    } catch {
      // Ringkasan bukan bagian kritikal halaman ini — biarkan nilai lama kalau gagal.
    } finally {
      setRingkasanLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadRingkasan();
  }, [loadRingkasan]);

  function handleCardPress(id: string) {
    switch (id) {
      case 'pendapatan':
        navigation.navigate('ProfilTab', { screen: 'DataPendapatan' });
        break;
      case 'hasillab':
        navigation.navigate('PasienTab', { screen: 'PilihPasienHasilLab' });
        break;
    }
  }

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.header,
          {
            paddingTop: insets.top,
            backgroundColor: headerBackgroundColor,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowRadius: 8,
            shadowOpacity: headerShadowOpacity,
            elevation: headerElevation,
          },
        ]}
      >
        <Image
          source={require('../../assets/logo sidokmais dan tulisan.png')}
          style={styles.headerLogo}
          resizeMode="contain"
        />
      </Animated.View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: tabBarClearance }]}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={scrollEventThrottle}
      >
        <View>
          <Text style={styles.dateEyebrow}>{formatTanggalHariIni()}</Text>
          <Text style={styles.greeting}>
            Halo, <Text style={styles.greetingName}>{dokterNama ?? 'dr. Reza Auditore'}</Text>
          </Text>
          <Text style={styles.subtitle}>Semoga harimu menyenangkan.</Text>
        </View>

        <View style={styles.quickActionsSection}>
          <Text style={styles.summaryTitle}>Ringkasan Aktivitas Hari Ini</Text>
          <View style={styles.statTileRow}>
            {RINGKASAN_ROWS.map((row) => (
              <View key={row.key} style={styles.statTile}>
                <View style={[styles.statTileIconCircle, { backgroundColor: `${row.tint}1A` }]}>
                  <MaterialIcons name={row.icon as never} size={18} color={row.tint} />
                </View>
                <Text style={[styles.statTileValue, { color: row.tint }]}>
                  {ringkasanLoading ? '–' : ringkasan[row.key]}
                </Text>
                <Text style={styles.statTileLabel}>{row.label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.grid}>
            {navigasiCards.map((card) => {
              const isNavigable = NAVIGABLE_CARD_IDS.has(card.id);
              const tint = NAVIGASI_TINTS[card.id] ?? colors.primary;
              return (
                <Pressable
                  key={card.id}
                  disabled={!isNavigable}
                  onPress={() => handleCardPress(card.id)}
                  style={({ pressed }) => [
                    styles.gridCard,
                    !isNavigable && styles.gridCardDisabled,
                    pressed && styles.gridCardPressed,
                  ]}
                >
                  <View style={styles.gridIconWrap}>
                    <View style={[styles.gridIconCircle, { shadowColor: tint }]}>
                      <MaterialIcons name={card.icon as never} size={32} color={tint} />
                    </View>
                  </View>
                  <Text style={styles.gridLabel}>{card.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.prioritySection}>
          <Text style={styles.summaryTitle}>Pasien Prioritas</Text>
          <View style={{ gap: spacing.base }}>
            {pasienPrioritas.length === 0 ? (
              <Text style={styles.emptyStateText}>Tidak ada jadwal operasi/konsultasi mendatang.</Text>
            ) : (
              pasienPrioritas.map((p) => (
                <View key={p.id} style={styles.priorityCard}>
                  <View style={styles.priorityAvatar}>
                    <MaterialIcons
                      name={p.jenis === 'OPERASI' ? 'medical-services' : 'person'}
                      size={24}
                      color={colors.onPrimary}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.priorityName}>{p.nama}</Text>
                    <Text style={styles.priorityLokasi}>{p.lokasi}</Text>
                  </View>
                  <View>
                    <Text style={styles.priorityWaktuLabel}>WAKTU</Text>
                    <Text style={styles.priorityWaktu}>{formatWaktuPrioritas(p.waktu)}</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        </View>

        <View style={styles.chartSection}>
          <Text style={styles.summaryTitle}>Statistik Pasien Mingguan</Text>
          <View style={styles.chartCard}>
            {aktivitasMingguan.map((d, i) => {
              // Lantai minimum 6% biar bar tetap keliatan (bukan hilang total
              // tanpa warna) waktu jumlah hari itu 0 — kalau seluruh minggu 0
              // (belum ada aktivitas sama sekali), semua bar bakal setinggi
              // lantai ini, tapi warnanya tetap kebaca (highlight vs bukan).
              const persen = Math.max((d.jumlah / maxAktivitasMingguan) * 100, 6);
              return (
                <View key={i} style={styles.chartBarCol}>
                  <View style={styles.chartBarValueSlot}>
                    {d.highlight && <Text style={styles.chartBarValue}>{d.jumlah}</Text>}
                  </View>
                  <View style={styles.chartBarTrack}>
                    <View
                      style={[
                        styles.chartBarFill,
                        {
                          height: `${persen}%`,
                          backgroundColor: d.highlight ? colors.primary : `${colors.primary}33`,
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.chartBarLabel, d.highlight && styles.chartBarLabelActive]}>
                    {d.label.charAt(0)}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 88,
    paddingLeft: spacing.marginMobile,
    paddingRight: spacing.marginMobile,
    paddingBottom: 4,
  },
  headerLogo: { width: 112, height: 32 },

  content: { padding: spacing.marginMobile, paddingTop: 12, gap: 24, paddingBottom: 32 },
  dateEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  greeting: { fontSize: 24, fontWeight: '600', color: colors.deepTealDark },
  greetingName: { fontSize: 24, fontWeight: '800', color: colors.primary },
  subtitle: { fontSize: 14, color: colors.onSurfaceVariant, marginTop: 4 },

  quickActionsSection: { gap: 20 },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.gutter,
  },
  gridCard: {
    width: '30%',
    alignItems: 'center',
    gap: 8,
  },
  gridCardPressed: { opacity: 0.85, transform: [{ scale: 0.96 }] },
  gridCardDisabled: { opacity: 0.45 },
  gridIconWrap: { position: 'relative' },
  gridIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.backgroundWhite,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 2,
  },
  gridLabel: { fontSize: 12, fontWeight: '600', color: colors.deepTealDark, textAlign: 'center' },

  prioritySection: { gap: 16 },
  chartSection: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: radius.lg,
    padding: spacing.cardPadding,
    gap: 16,
  },
  summaryTitle: { fontSize: 20, fontWeight: '700', color: colors.deepTealDark, marginBottom: 4 },

  statTileRow: { flexDirection: 'row', gap: spacing.gutter },
  statTile: {
    flex: 1,
    backgroundColor: colors.backgroundWhite,
    borderRadius: radius.sm,
    padding: 14,
    gap: 6,
    alignItems: 'flex-start',
  },
  statTileIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statTileValue: { fontSize: 26, fontWeight: '800', marginLeft: 9 },
  statTileLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginLeft: 4,
  },

  priorityCard: {
    backgroundColor: colors.primaryContainer,
    borderRadius: radius.lg,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 3,
  },
  priorityAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  priorityName: { fontSize: 20, fontWeight: '700', color: colors.onPrimaryContainer },
  priorityLokasi: { fontSize: 14, color: colors.onPrimaryContainer, opacity: 0.9, marginTop: 2 },
  priorityWaktuLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: colors.onPrimaryContainer,
    opacity: 0.8,
    textAlign: 'right',
  },
  priorityWaktu: { fontSize: 20, fontWeight: '700', color: colors.onPrimaryContainer },
  emptyStateText: {
    fontSize: 14,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    paddingVertical: 12,
  },

  chartCard: {
    backgroundColor: colors.backgroundWhite,
    borderRadius: radius.sm,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
    height: 156,
  },
  chartBarCol: { flex: 1, alignItems: 'center', gap: 4, height: '100%' },
  chartBarValueSlot: { height: 16, justifyContent: 'flex-end' },
  chartBarValue: { fontSize: 11, fontWeight: '800', color: colors.primary },
  chartBarTrack: { flex: 1, width: '100%', justifyContent: 'flex-end' },
  chartBarFill: { width: '100%', borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  chartBarLabel: { fontSize: 10, color: colors.outline },
  chartBarLabelActive: { color: colors.primary, fontWeight: '700' },
});
