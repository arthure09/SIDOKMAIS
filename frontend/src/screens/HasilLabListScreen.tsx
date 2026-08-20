import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError } from '../api/client';
import { toDateParam } from '../utils/tanggal';
import { fetchHasilLabList } from '../api/lab';
import { useAuthStore } from '../store/authStore';
import { colors, radius, shadows, spacing } from '../theme/colors';
import { ms } from '../theme/responsive';
import { Text } from '../components/Text';
import { FilterTanggal } from '../components/FilterTanggal';
import type { HasilLabRingkasan } from '../api/types';
import { useHeaderScrollShadow } from '../hooks/useHeaderScrollShadow';
import { useHideTabBar } from '../hooks/useHideTabBar';
import type { PasienStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<PasienStackParamList, 'HasilLabList'>;

function formatTanggal(value: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}


export function HasilLabListScreen({ route, navigation }: Props) {
  const { pasienId, nama } = route.params;
  const token = useAuthStore((s) => s.token);
  const insets = useSafeAreaInsets();
  useHideTabBar();
  const { onScroll, scrollEventThrottle, scrolled } = useHeaderScrollShadow();
  const [items, setItems] = useState<HasilLabRingkasan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter yang benar-benar diterapkan ke request. `draft*` cuma dipakai
  // selagi modal terbuka supaya batal/tutup modal tidak langsung ubah hasil.
  const [dariTanggal, setDariTanggal] = useState<Date | null>(null);
  const [sampaiTanggal, setSampaiTanggal] = useState<Date | null>(null);
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

  const filterAktif = dariTanggal !== null || sampaiTanggal !== null;

  const filterBar = (
    <View style={styles.filterBarWrapper}>
      <FilterTanggal
        judul="Filter Tanggal Permintaan"
        dari={dariTanggal}
        sampai={sampaiTanggal}
        onChange={(dari, sampai) => {
          setDariTanggal(dari);
          setSampaiTanggal(sampai);
        }}
      />
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        {header}
        {filterBar}
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
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
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + spacing.gutter }]}
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
