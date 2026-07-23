import { ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../theme/colors';
import { Text } from '../components/Text';
import { ringkasanPendapatan, transaksiPendapatan } from '../mocks/pendapatanMock';
import { useTabBarClearance } from '../navigation/tabBarMetrics';
import { useTabBarDockOnScroll } from '../hooks/useTabBarDockOnScroll';
import type { ProfilStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<ProfilStackParamList, 'DataPendapatan'>;

function formatRupiah(value: number) {
  return `Rp ${value.toLocaleString('id-ID')}`;
}

const FILTERS = [
  { label: `Bulan: ${ringkasanPendapatan.labelBulan}`, icon: 'expand-more' as const },
  { label: 'Jenis: Semua', icon: 'filter-list' as const },
  { label: 'Sumber: Semua', icon: 'expand-more' as const },
];

export function DataPendapatanScreen(_props: Props) {
  const tabBarClearance = useTabBarClearance();
  const { onScroll, scrollEventThrottle } = useTabBarDockOnScroll();

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: tabBarClearance }]}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={scrollEventThrottle}
      >
        {/* CLAUDE.md aturan #3: watermark dummy wajib tampil di modul Pendapatan */}
        <View style={styles.dummyBanner}>
          <MaterialIcons name="warning" size={16} color={colors.onSurfaceVariant} />
          <Text style={styles.dummyBannerText}>CONTOH DATA DUMMY</Text>
        </View>

        <View style={styles.summaryCard}>
          <View>
            <Text style={styles.summaryLabel}>TOTAL PENDAPATAN BULAN INI</Text>
            <Text style={styles.summaryValue}>
              {formatRupiah(ringkasanPendapatan.totalBulanIni)}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.breakdownRow}>
            <View style={styles.breakdownCol}>
              <Text style={styles.summaryLabel}>Operasi</Text>
              <Text style={styles.breakdownValue}>
                {formatRupiah(ringkasanPendapatan.totalOperasi)}
              </Text>
            </View>
            <View style={[styles.breakdownCol, styles.breakdownColRight]}>
              <Text style={styles.summaryLabel}>Konsul</Text>
              <Text style={styles.breakdownValue}>
                {formatRupiah(ringkasanPendapatan.totalKonsul)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.filterRow}>
          {FILTERS.map((f, i) => (
            <View key={f.label} style={[styles.filterChip, i === 0 && styles.filterChipActive]}>
              <Text style={[styles.filterChipText, i === 0 && styles.filterChipTextActive]}>
                {f.label}
              </Text>
              <MaterialIcons
                name={f.icon}
                size={16}
                color={i === 0 ? colors.onPrimary : colors.onSurface}
              />
            </View>
          ))}
        </View>

        <View>
          <Text style={styles.sectionTitle}>RINCIAN TRANSAKSI</Text>
          <View style={{ gap: spacing.gutter }}>
            {transaksiPendapatan.map((trx) => (
              <View key={trx.id} style={styles.trxCard}>
                <View style={styles.trxIconCircle}>
                  <MaterialIcons
                    name={trx.jenis === 'OPERASI' ? 'medical-services' : 'person'}
                    size={20}
                    color={colors.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.trxNama}>{trx.pasienNama}</Text>
                  <Text style={styles.trxMeta}>
                    {trx.tanggal} • {trx.sumber}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  <Text style={styles.trxNominal}>{formatRupiah(trx.nominal)}</Text>
                  <View
                    style={[
                      styles.trxBadge,
                      trx.status === 'MENUNGGU' && styles.trxBadgeMenunggu,
                    ]}
                  >
                    <Text style={styles.trxBadgeText}>{trx.status}</Text>
                  </View>
                </View>
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
  content: { padding: spacing.marginMobile, gap: spacing.gutter, paddingBottom: 32 },

  dummyBanner: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surfaceVariant,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  dummyBannerText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: colors.onSurfaceVariant,
  },

  summaryCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.sm,
    padding: spacing.cardPadding,
    gap: 20,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: colors.outline,
    marginBottom: 4,
  },
  summaryValue: { fontSize: 24, fontWeight: '800', color: colors.onSurface },
  divider: { height: 1, backgroundColor: colors.outlineVariant },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between' },
  breakdownCol: { flex: 1 },
  breakdownColRight: { alignItems: 'flex-end' },
  breakdownValue: { fontSize: 20, fontWeight: '700', color: colors.onSurface },

  filterRow: { flexDirection: 'row', gap: 12 },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceVariant,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterChipText: { fontSize: 12, fontWeight: '600', color: colors.onSurface },
  filterChipTextActive: { color: colors.onPrimary },

  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: colors.outline,
    marginBottom: 12,
  },
  trxCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.sm,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderWidth: 1,
    borderColor: colors.surfaceVariant,
  },
  trxIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trxNama: { fontSize: 16, fontWeight: '700', color: colors.onSurface },
  trxMeta: { fontSize: 14, color: colors.outline, marginTop: 2 },
  trxNominal: { fontSize: 16, fontWeight: '700', color: colors.onSurface },
  trxBadge: {
    backgroundColor: colors.surfaceVariant,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  trxBadgeMenunggu: {
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  trxBadgeText: { fontSize: 10, fontWeight: '700', color: colors.onSurfaceVariant },
});
