import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/authStore';
import { colors, radius, spacing } from '../theme/colors';
import { Text } from '../components/Text';
import { navigasiCards, pasienPrioritas, ringkasanAktivitas, statistikMingguan } from '../mocks/homeMock';
import { useTabBarClearance } from '../navigation/tabBarMetrics';
import { useTabBarDockOnScroll } from '../hooks/useTabBarDockOnScroll';
import type { MainTabParamList } from '../navigation/types';

type Props = BottomTabScreenProps<MainTabParamList, 'HomeTab'>;

const RINGKASAN_ROWS = [
  { key: 'pasienAktif' as const, label: 'Pasien Aktif', icon: 'groups', tint: colors.primary },
  {
    key: 'operasiHariIni' as const,
    label: 'Operasi Hari Ini',
    icon: 'local-hospital',
    tint: colors.tertiaryContainer,
  },
  { key: 'konsulHariIni' as const, label: 'Konsul Hari Ini', icon: 'chat-bubble', tint: colors.primary },
];

const CARD_TARGET_TAB: Partial<Record<string, keyof MainTabParamList>> = {
  pasien: 'PasienTab',
  operasi: 'OperasiTab',
  notifikasi: 'NotifikasiTab',
};

export function HomeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const tabBarClearance = useTabBarClearance();
  const { onScroll, scrollEventThrottle } = useTabBarDockOnScroll();
  const dokterNama = useAuthStore((s) => s.pengguna?.dokter?.nama);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Image
          source={require('../../assets/Logo sidokmais.png')}
          style={styles.headerLogo}
          resizeMode="contain"
        />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: tabBarClearance }]}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={scrollEventThrottle}
      >
        <View>
          <Text style={styles.greeting}>Halo, dr. {dokterNama ?? 'User'}</Text>
          <Text style={styles.subtitle}>Semoga harimu menyenangkan.</Text>
        </View>

        <View style={styles.grid}>
          {navigasiCards.map((card) => {
            const targetTab = CARD_TARGET_TAB[card.id];
            return (
              <Pressable
                key={card.id}
                disabled={!targetTab}
                onPress={() => targetTab && navigation.navigate(targetTab)}
                style={({ pressed }) => [styles.gridCard, pressed && styles.gridCardPressed]}
              >
                {card.id === 'notifikasi' && <View style={styles.gridCardDot} />}
                <View style={styles.gridIconCircle}>
                  <MaterialIcons name={card.icon as never} size={26} color={colors.primary} />
                </View>
                <Text style={styles.gridLabel}>{card.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Ringkasan Aktivitas Hari Ini</Text>
          <View style={{ gap: spacing.gutter }}>
            {RINGKASAN_ROWS.map((row) => (
              <View key={row.key} style={styles.statRow}>
                <View style={styles.statRowLeft}>
                  <View style={[styles.statIconCircle, { backgroundColor: `${row.tint}1A` }]}>
                    <MaterialIcons name={row.icon as never} size={20} color={row.tint} />
                  </View>
                  <Text style={styles.statLabel}>{row.label}</Text>
                </View>
                <Text style={[styles.statValue, { color: row.tint }]}>
                  {ringkasanAktivitas[row.key]}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.priorityHeader}>
            <Text style={styles.summaryTitle}>Pasien Prioritas</Text>
          </View>
          <View style={{ gap: spacing.base }}>
            {pasienPrioritas.map((p) => (
              <View key={p.id} style={styles.priorityCard}>
                <View style={styles.priorityAvatar}>
                  <MaterialIcons name="person" size={24} color={colors.onPrimary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.priorityName}>{p.nama}</Text>
                  <Text style={styles.priorityLokasi}>{p.lokasi}</Text>
                </View>
                <View>
                  <Text style={styles.priorityWaktuLabel}>WAKTU</Text>
                  <Text style={styles.priorityWaktu}>{p.waktu}</Text>
                </View>
              </View>
            ))}
          </View>

          <Text style={[styles.summaryTitle, { marginTop: spacing.gutter }]}>
            Statistik Pasien Mingguan
          </Text>
          <View style={styles.chartCard}>
            {statistikMingguan.map((d, i) => (
              <View key={i} style={styles.chartBarCol}>
                <View style={styles.chartBarTrack}>
                  <View
                    style={[
                      styles.chartBarFill,
                      {
                        height: `${d.persen}%`,
                        backgroundColor: d.highlight ? colors.primary : `${colors.primary}33`,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.chartBarLabel, d.highlight && styles.chartBarLabelActive]}>
                  {d.label}
                </Text>
              </View>
            ))}
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
    minHeight: 64,
    paddingHorizontal: spacing.marginMobile,
  },
  headerLogo: { width: 132, height: 45 },

  content: { padding: spacing.marginMobile, paddingTop: 12, gap: 24, paddingBottom: 32 },
  greeting: { fontSize: 24, fontWeight: '800', color: colors.deepTealDark },
  subtitle: { fontSize: 14, color: colors.onSurfaceVariant, marginTop: 4 },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.gutter,
  },
  gridCard: {
    width: '47%',
    backgroundColor: colors.backgroundWhite,
    borderRadius: 24,
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 12,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 15,
    elevation: 2,
  },
  gridCardPressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  gridCardDot: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.tertiaryFixed,
  },
  gridIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridLabel: { fontSize: 20, fontWeight: '700', color: colors.deepTealDark, textAlign: 'center' },

  summaryCard: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: radius.lg,
    padding: spacing.cardPadding,
    gap: 16,
  },
  summaryTitle: { fontSize: 20, fontWeight: '700', color: colors.deepTealDark, marginBottom: 4 },

  statRow: {
    backgroundColor: colors.backgroundWhite,
    borderRadius: radius.sm,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statLabel: { fontSize: 16, color: colors.onSurface },
  statValue: { fontSize: 24, fontWeight: '800' },

  priorityHeader: { marginTop: 8 },
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

  chartCard: {
    backgroundColor: colors.backgroundWhite,
    borderRadius: radius.sm,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
    height: 140,
  },
  chartBarCol: { flex: 1, alignItems: 'center', gap: 8, height: '100%' },
  chartBarTrack: { flex: 1, width: '100%', justifyContent: 'flex-end' },
  chartBarFill: { width: '100%', borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  chartBarLabel: { fontSize: 10, color: colors.outline },
  chartBarLabelActive: { color: colors.primary, fontWeight: '700' },
});
