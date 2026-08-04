import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError } from '../api/client';
import { fetchHasilLabList } from '../api/lab';
import { useAuthStore } from '../store/authStore';
import { colors, radius, shadows, spacing } from '../theme/colors';
import { Text } from '../components/Text';
import type { HasilLabRingkasan, StatusPemeriksaanLab } from '../api/types';
import { useTabBarClearance } from '../navigation/tabBarMetrics';
import { useHeaderScrollShadow } from '../hooks/useHeaderScrollShadow';
import type { PasienStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<PasienStackParamList, 'HasilLabList'>;

// PENDING/CANCELLED belum ada laporan buat dilihat — cuma status yang
// ditampilkan, kartu-nya non-tappable (pola sama dgn JadwalOperasiKonsulScreen
// utk kartu berstatus CANCELLED).
const STATUS_LABEL: Record<StatusPemeriksaanLab, string> = {
  COMPLETED: 'Selesai',
  PENDING: 'Menunggu Hasil',
  CANCELLED: 'Dibatalkan',
};

function formatTanggal(value: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
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

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchHasilLabList(token, pasienId, { limit: 50 });
      setItems(result.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat hasil lab');
    } finally {
      setLoading(false);
    }
  }, [token, pasienId]);

  useEffect(() => {
    load();
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

  if (loading) {
    return (
      <View style={styles.container}>
        {header}
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
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {header}
      {items.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>Belum ada hasil lab untuk pasien ini.</Text>
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
            const bisaDilihat = item.status === 'COMPLETED';
            const tanggal = formatTanggal(item.tanggalHasil ?? item.tanggalPermintaan);
            return (
              <Pressable
                disabled={!bisaDilihat}
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
                  {bisaDilihat ? (
                    <View style={styles.lihatPdfPill}>
                      <MaterialIcons name="visibility" size={12} color={colors.primary} />
                      <Text style={styles.lihatPdfText}>Lihat PDF</Text>
                    </View>
                  ) : (
                    <Text style={styles.statusText}>{STATUS_LABEL[item.status]}</Text>
                  )}
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
  statusText: { fontSize: 11, fontWeight: '600', color: colors.outline },
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
