import { useCallback, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, shadows, spacing } from '../theme/colors';
import { Text } from '../components/Text';
import { ringkasanPendapatan, transaksiPendapatan, type JenisTransaksi } from '../mocks/pendapatanMock';
import { useTabBarDockOnScroll } from '../hooks/useTabBarDockOnScroll';
import { useHideTabBar } from '../hooks/useHideTabBar';
import { useMenuBack } from '../navigation/useMenuBack';
import type { ProfilStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<ProfilStackParamList, 'DataPendapatan'>;
type FilterKey = 'BULAN' | 'JENIS' | 'SUMBER';
type AnchorRect = { x: number; y: number; width: number; height: number };

function formatRupiah(value: number) {
  return `Rp ${value.toLocaleString('id-ID')}`;
}

function extractBulan(tanggal: string) {
  return tanggal.split(' ')[1] ?? tanggal;
}

const BULAN_OPTIONS = Array.from(
  new Set(transaksiPendapatan.map((t) => extractBulan(t.tanggal))),
);
const JENIS_OPTIONS: { value: JenisTransaksi | 'Semua'; label: string }[] = [
  { value: 'Semua', label: 'Semua' },
  { value: 'OPERASI', label: 'Operasi' },
  { value: 'KONSUL', label: 'Konsultasi' },
];
const SUMBER_OPTIONS = ['Semua', ...new Set(transaksiPendapatan.map((t) => t.sumber))];

const DROPDOWN_WIDTH = 180;

export function DataPendapatanScreen({ navigation, route }: Props) {
  const goBack = useMenuBack(navigation, route.params?.fromHome);
  const insets = useSafeAreaInsets();
  useHideTabBar();
  const { onScroll, scrollEventThrottle, scrolled } = useTabBarDockOnScroll();
  const { width: windowWidth } = useWindowDimensions();

  const [bulan, setBulan] = useState(ringkasanPendapatan.labelBulan);
  const [jenis, setJenis] = useState<JenisTransaksi | 'Semua'>('Semua');
  const [sumber, setSumber] = useState('Semua');
  const [openFilter, setOpenFilter] = useState<FilterKey | null>(null);
  const [anchorRect, setAnchorRect] = useState<AnchorRect | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Data pendapatan masih murni mock (belum ada endpoint), jadi "refresh" di
  // sini cuma re-affirm data yang sama — disimulasikan biar gesture pull-to-
  // refresh tetap konsisten dengan screen lain. Ganti ke fetch asli kalau
  // modul Pendapatan sudah tersambung backend.
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
  }, []);

  const anchorRefs = useRef<Record<FilterKey, View | null>>({
    BULAN: null,
    JENIS: null,
    SUMBER: null,
  });

  const filteredTransaksi = useMemo(
    () =>
      transaksiPendapatan.filter((trx) => {
        const matchBulan = extractBulan(trx.tanggal) === bulan;
        const matchJenis = jenis === 'Semua' || trx.jenis === jenis;
        const matchSumber = sumber === 'Semua' || trx.sumber === sumber;
        return matchBulan && matchJenis && matchSumber;
      }),
    [bulan, jenis, sumber],
  );

  function toggleDropdown(key: FilterKey) {
    if (openFilter === key) {
      setOpenFilter(null);
      return;
    }
    anchorRefs.current[key]?.measureInWindow((x, y, width, height) => {
      setAnchorRect({ x, y, width, height });
      setOpenFilter(key);
    });
  }

  const jenisLabel = JENIS_OPTIONS.find((o) => o.value === jenis)?.label ?? 'Semua';

  const FILTERS: { key: FilterKey; label: string }[] = [
    { key: 'BULAN', label: `Bulan: ${bulan}` },
    { key: 'JENIS', label: `Jenis: ${jenisLabel}` },
    { key: 'SUMBER', label: `Sumber: ${sumber}` },
  ];

  const dropdownConfig: Record<FilterKey, { options: string[]; value: string; onSelect: (v: string) => void }> = {
    BULAN: { options: BULAN_OPTIONS, value: bulan, onSelect: setBulan },
    JENIS: {
      options: JENIS_OPTIONS.map((o) => o.label),
      value: jenisLabel,
      onSelect: (label) => {
        const found = JENIS_OPTIONS.find((o) => o.label === label);
        setJenis(found ? found.value : 'Semua');
      },
    },
    SUMBER: { options: SUMBER_OPTIONS, value: sumber, onSelect: setSumber },
  };

  const activeDropdown = openFilter ? dropdownConfig[openFilter] : null;
  const dropdownLeft = anchorRect
    ? Math.max(16, Math.min(anchorRect.x, windowWidth - DROPDOWN_WIDTH - 16))
    : 0;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top }, scrolled && shadows.header]}>
        <Pressable onPress={goBack} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={colors.onBackground} />
        </Pressable>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Data Pendapatan</Text>
          <Text style={styles.headerSubtitle}>Ringkasan & rincian transaksi</Text>
        </View>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.gutter }]}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={scrollEventThrottle}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
        }
      >
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
            <View style={styles.breakdownDividerVertical} />
            <View style={styles.breakdownCol}>
              <Text style={styles.summaryLabel}>Konsultasi</Text>
              <Text style={styles.breakdownValue}>
                {formatRupiah(ringkasanPendapatan.totalKonsul)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.filterRow}>
          {FILTERS.map((f) => {
            const active = openFilter === f.key;
            return (
              <Pressable
                key={f.key}
                ref={(el) => {
                  anchorRefs.current[f.key] = el;
                }}
                onPress={() => toggleDropdown(f.key)}
                style={({ pressed }) => [
                  styles.filterChip,
                  active && styles.filterChipActive,
                  pressed && styles.filterChipPressed,
                ]}
              >
                <Text
                  style={[styles.filterChipText, active && styles.filterChipTextActive]}
                  numberOfLines={1}
                >
                  {f.label}
                </Text>
                <MaterialIcons
                  name={active ? 'expand-less' : 'expand-more'}
                  size={16}
                  color={active ? colors.onPrimary : colors.onSurface}
                />
              </Pressable>
            );
          })}
        </View>

        <View>
          <Text style={styles.sectionTitle}>RINCIAN TRANSAKSI</Text>
          {filteredTransaksi.length === 0 ? (
            <Text style={styles.emptyText}>Tidak ada transaksi untuk filter ini.</Text>
          ) : (
            <View style={{ gap: spacing.gutter }}>
              {filteredTransaksi.map((trx) => (
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
          )}
        </View>
      </ScrollView>

      <Modal
        visible={openFilter !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setOpenFilter(null)}
      >
        <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setOpenFilter(null)} />
        {activeDropdown && anchorRect && (
          <View
            style={[
              styles.dropdown,
              { top: anchorRect.y + anchorRect.height + 6, left: dropdownLeft },
            ]}
          >
            {activeDropdown.options.map((opt) => {
              const active = opt === activeDropdown.value;
              return (
                <Pressable
                  key={opt}
                  onPress={() => {
                    activeDropdown.onSelect(opt);
                    setOpenFilter(null);
                  }}
                  style={({ pressed }) => [
                    styles.dropdownOption,
                    active && styles.dropdownOptionActive,
                    pressed && styles.filterChipPressed,
                  ]}
                >
                  <Text
                    style={[styles.dropdownOptionText, active && styles.dropdownOptionTextActive]}
                  >
                    {opt}
                  </Text>
                  {active && <MaterialIcons name="check" size={18} color={colors.primary} />}
                </Pressable>
              );
            })}
          </View>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.marginMobile, gap: spacing.gutter, paddingBottom: 32 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing.marginMobile,
    paddingBottom: spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: `${colors.outlineVariant}1A`,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.onBackground },
  headerSubtitle: { fontSize: 12, color: colors.outline, marginTop: 2 },

  summaryCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.md,
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
  breakdownRow: { flexDirection: 'row' },
  breakdownCol: { flex: 1 },
  breakdownDividerVertical: {
    width: 1,
    backgroundColor: colors.outlineVariant,
    marginHorizontal: spacing.gutter,
  },
  breakdownValue: { fontSize: 20, fontWeight: '700', color: colors.onSurface },

  filterRow: { flexDirection: 'row', gap: 10 },
  filterChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceVariant,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterChipPressed: { opacity: 0.7 },
  filterChipText: { flexShrink: 1, fontSize: 12, fontWeight: '600', color: colors.onSurface },
  filterChipTextActive: { color: colors.onPrimary },

  dropdown: {
    position: 'absolute',
    width: DROPDOWN_WIDTH,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.sm,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  dropdownOptionActive: { backgroundColor: `${colors.primary}14` },
  dropdownOptionText: { fontSize: 14, color: colors.onSurface },
  dropdownOptionTextActive: { color: colors.primary, fontWeight: '700' },

  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: colors.outline,
    marginBottom: 12,
  },
  emptyText: { fontSize: 14, color: colors.onSurfaceVariant },
  trxCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.md,
    overflow: 'hidden',
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
