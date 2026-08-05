import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError } from '../api/client';
import { fetchHasilLabList } from '../api/lab';
import { useAuthStore } from '../store/authStore';
import { colors, radius, shadows, spacing } from '../theme/colors';
import { ms } from '../theme/responsive';
import { Text } from '../components/Text';
import type { HasilLabRingkasan } from '../api/types';
import { useTabBarClearance } from '../navigation/tabBarMetrics';
import { useHeaderScrollShadow } from '../hooks/useHeaderScrollShadow';
import type { PasienStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<PasienStackParamList, 'HasilLabList'>;

function formatTanggal(value: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatShortDate(date: Date) {
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Dipakai buat bikin query param, bukan buat ditampilkan — ambil tanggal
// kalender lokal device (getFullYear/Month/Date), BUKAN toISOString() yang
// bisa geser ke hari sebelum/sesudahnya kalau device-nya di timezone +.
function toDateParam(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function HasilLabListScreen({ route, navigation }: Props) {
  const { pasienId, nama } = route.params;
  const token = useAuthStore((s) => s.token);
  const insets = useSafeAreaInsets();
  const tabBarClearance = useTabBarClearance();
  const { onScroll, scrollEventThrottle, scrolled } = useHeaderScrollShadow();
  const [items, setItems] = useState<HasilLabRingkasan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter yang benar-benar diterapkan ke request. `draft*` cuma dipakai
  // selagi modal terbuka supaya batal/tutup modal tidak langsung ubah hasil.
  const [dariTanggal, setDariTanggal] = useState<Date | null>(null);
  const [sampaiTanggal, setSampaiTanggal] = useState<Date | null>(null);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [draftDari, setDraftDari] = useState<Date | null>(null);
  const [draftSampai, setDraftSampai] = useState<Date | null>(null);
  const [showDariPicker, setShowDariPicker] = useState(false);
  const [showSampaiPicker, setShowSampaiPicker] = useState(false);
  // Instance stabil buat fallback value picker — bukan `new Date()` inline, yang
  // bikin timestamp baru tiap render dan memicu re-layout native tanpa henti
  // (crash iOS) / dialog Android menumpuk selama tanggal belum dipilih.
  const [fallbackDate] = useState(() => new Date());

  const filterAktif = dariTanggal !== null || sampaiTanggal !== null;
  const draftInvalid = Boolean(draftDari && draftSampai && draftDari > draftSampai);

  // `isCancelled` dicek lagi setelah tiap `await` supaya respons dari request
  // basi (mis. ganti filter cepat-cepat, request lama baru resolve belakangan)
  // tidak menimpa state dari request yang lebih baru.
  const load = useCallback(
    async (isCancelled: () => boolean) => {
      if (!token) return;
      setLoading(true);
      setError(null);
      try {
        const result = await fetchHasilLabList(token, pasienId, {
          limit: 50,
          dariTanggal: dariTanggal ? toDateParam(dariTanggal) : undefined,
          sampaiTanggal: sampaiTanggal ? toDateParam(sampaiTanggal) : undefined,
        });
        if (isCancelled()) return;
        setItems(result.data);
      } catch (err) {
        if (isCancelled()) return;
        setError(err instanceof ApiError ? err.message : 'Gagal memuat hasil lab');
      } finally {
        if (!isCancelled()) setLoading(false);
      }
    },
    [token, pasienId, dariTanggal, sampaiTanggal],
  );

  useEffect(() => {
    let cancelled = false;
    load(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [load]);

  function openFilterModal() {
    setDraftDari(dariTanggal);
    setDraftSampai(sampaiTanggal);
    setShowFilterModal(true);
  }

  function closeFilterModal() {
    setShowFilterModal(false);
    setShowDariPicker(false);
    setShowSampaiPicker(false);
  }

  function terapkanFilter() {
    if (draftInvalid) return;
    setDariTanggal(draftDari);
    setSampaiTanggal(draftSampai);
    closeFilterModal();
  }

  function resetFilter() {
    setDariTanggal(null);
    setSampaiTanggal(null);
    setDraftDari(null);
    setDraftSampai(null);
  }

  // Khusus tombol Reset di dalam modal — hanya bersihkan draft, jangan sentuh
  // filter yang sudah diterapkan. Menulis dariTanggal/sampaiTanggal langsung
  // dari sini memicu fetch ulang selagi modal masih terbuka, menembus pola
  // draft/apply yang seluruh modal ini pakai.
  function resetDraftFilter() {
    setDraftDari(null);
    setDraftSampai(null);
    setShowDariPicker(false);
    setShowSampaiPicker(false);
  }

  const onChangeDari = useCallback((event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS !== 'ios') setShowDariPicker(false);
    if (event.type === 'dismissed') return;
    if (selectedDate) setDraftDari(selectedDate);
  }, []);

  const onChangeSampai = useCallback((event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS !== 'ios') setShowSampaiPicker(false);
    if (event.type === 'dismissed') return;
    if (selectedDate) setDraftSampai(selectedDate);
  }, []);

  let filterLabel = 'Semua Tanggal';
  if (dariTanggal && sampaiTanggal) {
    filterLabel = `${formatShortDate(dariTanggal)} - ${formatShortDate(sampaiTanggal)}`;
  } else if (dariTanggal) {
    filterLabel = `Sejak ${formatShortDate(dariTanggal)}`;
  } else if (sampaiTanggal) {
    filterLabel = `Sampai ${formatShortDate(sampaiTanggal)}`;
  }

  const header = (
    <View style={[styles.header, { paddingTop: insets.top }, scrolled && shadows.header]}>
      <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
        <MaterialIcons name="arrow-back" size={24} color={colors.onBackground} />
      </Pressable>
      <Text style={styles.headerTitle} numberOfLines={1}>
        {nama}
      </Text>
      <View style={styles.backButton} />
    </View>
  );

  const filterBar = (
    <View style={styles.filterBarWrapper}>
      <View style={styles.dateFilter}>
        <Pressable onPress={openFilterModal} style={styles.dateFilterMain} hitSlop={4}>
          <MaterialIcons name="calendar-month" size={20} color={colors.primary} />
          <Text style={styles.dateFilterText} numberOfLines={1}>
            {filterLabel}
          </Text>
        </Pressable>
        {filterAktif && (
          <Pressable onPress={resetFilter} hitSlop={8}>
            <MaterialIcons name="close" size={16} color={colors.onSurfaceVariant} />
          </Pressable>
        )}
      </View>
    </View>
  );

  const filterModal = (
    <Modal visible={showFilterModal} transparent animationType="fade" onRequestClose={closeFilterModal}>
      <Pressable style={styles.filterBackdrop} onPress={closeFilterModal} />
      <View style={styles.filterModalWrapper} pointerEvents="box-none">
        <View style={styles.filterCard}>
          <Text style={styles.filterCardTitle}>Filter Tanggal Permintaan</Text>

          <View>
            <Pressable
              style={styles.filterField}
              onPress={() => {
                setShowDariPicker((v) => !v);
                setShowSampaiPicker(false);
              }}
            >
              <Text style={styles.filterFieldLabel}>Dari</Text>
              <Text style={styles.filterFieldValue}>
                {draftDari ? formatShortDate(draftDari) : 'Pilih tanggal'}
              </Text>
            </Pressable>
            {showDariPicker && (
              <View style={styles.pickerFullBleed}>
                <DateTimePicker
                  value={draftDari ?? draftSampai ?? fallbackDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'inline' : 'default'}
                  themeVariant="light"
                  textColor={colors.onSurface}
                  accentColor={colors.primary}
                  maximumDate={draftSampai ?? undefined}
                  onChange={onChangeDari}
                />
              </View>
            )}
          </View>

          <View>
            <Pressable
              style={styles.filterField}
              onPress={() => {
                setShowSampaiPicker((v) => !v);
                setShowDariPicker(false);
              }}
            >
              <Text style={styles.filterFieldLabel}>Sampai</Text>
              <Text style={styles.filterFieldValue}>
                {draftSampai ? formatShortDate(draftSampai) : 'Pilih tanggal'}
              </Text>
            </Pressable>
            {showSampaiPicker && (
              <View style={styles.pickerFullBleed}>
                <DateTimePicker
                  value={draftSampai ?? draftDari ?? fallbackDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'inline' : 'default'}
                  themeVariant="light"
                  textColor={colors.onSurface}
                  accentColor={colors.primary}
                  minimumDate={draftDari ?? undefined}
                  onChange={onChangeSampai}
                />
              </View>
            )}
          </View>

          {draftInvalid && (
            <Text style={styles.filterError}>Tanggal "Dari" tidak boleh setelah "Sampai".</Text>
          )}

          <View style={styles.filterActions}>
            <Pressable
              onPress={resetDraftFilter}
              hitSlop={8}
              style={({ pressed }) => [styles.filterResetButton, pressed && styles.filterResetButtonPressed]}
            >
              <Text style={styles.filterResetText}>Reset</Text>
            </Pressable>
            <Pressable
              onPress={terapkanFilter}
              disabled={draftInvalid}
              style={({ pressed }) => [
                styles.filterApplyButton,
                draftInvalid && styles.filterApplyButtonDisabled,
                pressed && !draftInvalid && styles.filterApplyButtonPressed,
              ]}
            >
              <Text style={styles.filterApplyText}>Terapkan</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        {header}
        {filterBar}
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
        {filterModal}
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        {header}
        {filterBar}
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
        {filterModal}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {header}
      {filterBar}
      {items.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>
            {filterAktif
              ? 'Tidak ada hasil lab pada rentang tanggal ini.'
              : 'Belum ada hasil lab untuk pasien ini.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: tabBarClearance }]}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={scrollEventThrottle}
          renderItem={({ item }) => {
            // Backend GET /api/lab cuma balikin status COMPLETED (lihat lab.routes.js)
            // — jadi setiap item yang sampai ke sini pasti punya laporan buat dilihat,
            // tidak perlu lagi status/badge atau kondisi tappable di sini.
            const tanggal = formatTanggal(item.tanggalHasil ?? item.tanggalPermintaan);
            return (
              <Pressable
                onPress={() =>
                  navigation.navigate('LihatPdfLab', { namaLaporan: item.namaPemeriksaan, tanggal })
                }
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <View style={styles.rowIcon}>
                  <MaterialIcons name="picture-as-pdf" size={20} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.namaLaporan} numberOfLines={1}>
                    {item.namaPemeriksaan}
                  </Text>
                  <Text style={styles.kategori}>{item.kategori}</Text>
                </View>
                <View style={styles.rowRight}>
                  <Text style={styles.tanggal}>{tanggal}</Text>
                  <View style={styles.lihatPdfPill}>
                    <MaterialIcons name="visibility" size={12} color={colors.primary} />
                    <Text style={styles.lihatPdfText}>Lihat PDF</Text>
                  </View>
                </View>
              </Pressable>
            );
          }}
        />
      )}
      {filterModal}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: { color: colors.error, textAlign: 'center' },
  emptyText: { color: colors.onSurfaceVariant, textAlign: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
    paddingHorizontal: spacing.marginMobile,
    paddingBottom: spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: `${colors.outlineVariant}1A`,
  },
  backButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '600', color: colors.onBackground, textAlign: 'center' },

  filterBarWrapper: { paddingHorizontal: spacing.marginMobile, paddingTop: spacing.base },
  dateFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(10),
    backgroundColor: colors.surfaceSoft,
    borderRadius: radius.full,
    paddingHorizontal: ms(16),
    paddingVertical: ms(7),
    alignSelf: 'flex-start',
  },
  dateFilterMain: { flexDirection: 'row', alignItems: 'center', gap: ms(10) },
  dateFilterText: { fontSize: ms(14), color: colors.onSurface },

  filterBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: `${colors.onBackground}80` },
  filterModalWrapper: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.marginMobile },
  filterCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    padding: spacing.cardPadding,
    gap: ms(12),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  filterCardTitle: { fontSize: ms(16), fontWeight: '700', color: colors.onSurface },
  filterField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceVariant,
    borderRadius: radius.full,
    paddingHorizontal: ms(16),
    paddingVertical: ms(10),
  },
  filterFieldLabel: { fontSize: ms(13), fontWeight: '600', color: colors.onSurfaceVariant },
  filterFieldValue: { fontSize: ms(14), color: colors.onSurface, fontWeight: '600' },
  // Batalkan padding horizontal filterCard khusus buat area picker, supaya inline
  // UIDatePicker iOS (~330pt) dapat ruang cukup — filterCard sendiri cuma sisakan
  // ~287pt di layar 375pt, selisihnya bikin layout pass gagal terus-menerus.
  pickerFullBleed: { marginHorizontal: -spacing.cardPadding },
  filterError: { fontSize: ms(12), color: colors.error },
  filterActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: ms(6),
  },
  filterResetButton: {
    paddingVertical: ms(12),
    paddingHorizontal: ms(14),
    borderRadius: radius.full,
  },
  filterResetButtonPressed: { backgroundColor: colors.surfaceSoft },
  filterResetText: { fontSize: ms(14), fontWeight: '600', color: colors.onSurfaceVariant },
  filterApplyButton: {
    flex: 1,
    marginLeft: ms(12),
    alignItems: 'center',
    paddingVertical: ms(13),
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  filterApplyButtonPressed: { backgroundColor: colors.secondary },
  filterApplyButtonDisabled: { backgroundColor: colors.outlineVariant },
  filterApplyText: { fontSize: ms(14), fontWeight: '700', color: colors.onPrimary },

  listContent: { padding: spacing.marginMobile, gap: spacing.base },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.backgroundWhite,
    borderRadius: radius.sm,
    padding: 16,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 15,
    elevation: 2,
  },
  rowPressed: { opacity: 0.95, transform: [{ scale: 0.98 }] },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  namaLaporan: { fontSize: 15, fontWeight: '700', color: colors.onSurface },
  kategori: { fontSize: 12, color: colors.outline, marginTop: 2 },
  rowRight: { alignItems: 'flex-end', gap: 4 },
  tanggal: { fontSize: 12, color: colors.onSurfaceVariant },
  lihatPdfPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: `${colors.primary}1A`,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  lihatPdfText: { fontSize: 11, fontWeight: '700', color: colors.primary },
});
