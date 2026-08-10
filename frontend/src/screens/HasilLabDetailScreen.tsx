import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError } from '../api/client';
import { fetchHasilLabDetail } from '../api/lab';
import { useAuthStore } from '../store/authStore';
import { colors, radius, shadows, spacing } from '../theme/colors';
import { Text } from '../components/Text';
import type { FlagHasilLab, HasilLabDetail, StatusPemeriksaanLab } from '../api/types';
import { useHeaderScrollShadow } from '../hooks/useHeaderScrollShadow';
import { useHideTabBar } from '../hooks/useHideTabBar';
import type { PasienStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<PasienStackParamList, 'HasilLabDetail'>;

const STATUS_META: Record<StatusPemeriksaanLab, { label: string; bg: string; fg: string }> = {
  COMPLETED: { label: 'Selesai', bg: colors.deepTealDark, fg: colors.onPrimary },
  PENDING: { label: 'Menunggu', bg: colors.primaryContainer, fg: colors.onPrimaryContainer },
  CANCELLED: { label: 'Batal', bg: colors.errorContainer, fg: colors.onErrorContainer },
};

const FLAG_META: Record<FlagHasilLab, { bg: string; fg: string }> = {
  NORMAL: { bg: colors.surfaceContainer, fg: colors.onSurfaceVariant },
  RENDAH: { bg: colors.errorContainer, fg: colors.onErrorContainer },
  TINGGI: { bg: colors.errorContainer, fg: colors.onErrorContainer },
  ABNORMAL: { bg: colors.errorContainer, fg: colors.onErrorContainer },
};

function formatTanggal(value: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function HasilLabDetailScreen({ route, navigation }: Props) {
  const { pemeriksaanLabId } = route.params;
  const token = useAuthStore((s) => s.token);
  const insets = useSafeAreaInsets();
  useHideTabBar();
  const { onScroll, scrollEventThrottle, scrolled } = useHeaderScrollShadow();
  const [detail, setDetail] = useState<HasilLabDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchHasilLabDetail(token, pemeriksaanLabId);
      setDetail(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat detail hasil lab');
    } finally {
      setLoading(false);
    }
  }, [token, pemeriksaanLabId]);

  useEffect(() => {
    load();
  }, [load]);

  const header = (
    <View style={[styles.header, { paddingTop: insets.top }, scrolled && shadows.header]}>
      <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
        <MaterialIcons name="arrow-back" size={24} color={colors.onBackground} />
      </Pressable>
      <Text style={styles.headerTitle} numberOfLines={1}>
        {detail?.namaPemeriksaan ?? 'Detail Hasil Lab'}
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

  if (error || !detail) {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.center}>
          <Text style={styles.errorText}>{error ?? 'Data hasil lab tidak ditemukan'}</Text>
        </View>
      </View>
    );
  }

  const statusMeta = STATUS_META[detail.status];

  return (
    <View style={styles.container}>
      {header}
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.gutter }]}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={scrollEventThrottle}
      >
        <View style={styles.card}>
          <View style={styles.topRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.pasienNama}>{detail.pasien.nama}</Text>
              <Text style={styles.pasienMeta}>RM: {detail.pasien.norm}</Text>
            </View>
            <View style={[styles.statusPill, { backgroundColor: statusMeta.bg }]}>
              <Text style={[styles.statusPillText, { color: statusMeta.fg }]}>{statusMeta.label}</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.metaGrid}>
            <View style={{ flex: 1 }}>
              <Text style={styles.metaLabel}>Kategori</Text>
              <Text style={styles.metaValue}>{detail.kategori}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.metaLabel}>Laboratorium</Text>
              <Text style={styles.metaValue}>{detail.laboratorium ?? '-'}</Text>
            </View>
          </View>
          <View style={styles.metaGrid}>
            <View style={{ flex: 1 }}>
              <Text style={styles.metaLabel}>Tanggal Permintaan</Text>
              <Text style={styles.metaValue}>{formatTanggal(detail.tanggalPermintaan)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.metaLabel}>Tanggal Hasil</Text>
              <Text style={styles.metaValue}>{formatTanggal(detail.tanggalHasil)}</Text>
            </View>
          </View>
          {detail.dokterPeminta && (
            <View style={styles.metaGrid}>
              <View style={{ flex: 1 }}>
                <Text style={styles.metaLabel}>Dokter Peminta</Text>
                <Text style={styles.metaValue}>{detail.dokterPeminta.nama}</Text>
              </View>
            </View>
          )}
          {detail.catatan && (
            <View>
              <Text style={styles.metaLabel}>Catatan</Text>
              <Text style={styles.metaValue}>{detail.catatan}</Text>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Hasil Parameter</Text>

          {detail.status === 'PENDING' ? (
            <Text style={styles.emptyText}>Hasil belum tersedia, pemeriksaan masih menunggu.</Text>
          ) : detail.status === 'CANCELLED' ? (
            <Text style={styles.emptyText}>Pemeriksaan ini dibatalkan.</Text>
          ) : detail.hasilLabItem === null ? (
            <Text style={styles.emptyText}>Detail parameter belum tersedia untuk pemeriksaan ini.</Text>
          ) : (
            <View>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.tableHeaderText, { flex: 2 }]}>Parameter</Text>
                <Text style={[styles.tableHeaderText, { flex: 1 }]}>Hasil</Text>
                <Text style={[styles.tableHeaderText, { flex: 1.4 }]}>Rujukan</Text>
              </View>
              {detail.hasilLabItem.map((item, i) => {
                const flagMeta = FLAG_META[item.flag];
                return (
                  <View
                    key={item.id}
                    style={[
                      styles.tableRow,
                      i < (detail.hasilLabItem?.length ?? 0) - 1 && styles.tableRowBorder,
                    ]}
                  >
                    <Text style={[styles.tableCellNama, { flex: 2 }]}>{item.namaParameter}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.tableCellNilai}>
                        {item.nilai}
                        {item.satuan ? ` ${item.satuan}` : ''}
                      </Text>
                      {item.flag !== 'NORMAL' && (
                        <View style={[styles.flagPill, { backgroundColor: flagMeta.bg }]}>
                          <Text style={[styles.flagPillText, { color: flagMeta.fg }]}>{item.flag}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.tableCellRujukan, { flex: 1.4 }]}>{item.nilaiRujukan ?? '-'}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: { color: colors.error, textAlign: 'center' },
  emptyText: { color: colors.onSurfaceVariant, fontSize: 14 },

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

  content: { padding: spacing.marginMobile, gap: spacing.gutter, paddingBottom: 32 },

  card: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.sm,
    padding: spacing.cardPadding,
    gap: 16,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 15,
    elevation: 2,
  },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  pasienNama: { fontSize: 18, fontWeight: '700', color: colors.onSurface },
  pasienMeta: { fontSize: 13, color: colors.onSurfaceVariant, marginTop: 2 },
  statusPill: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: radius.full },
  statusPillText: { fontSize: 12, fontWeight: '700' },
  divider: { height: 1, backgroundColor: `${colors.outlineVariant}4D` },
  metaGrid: { flexDirection: 'row', gap: 16 },
  metaLabel: { fontSize: 12, fontWeight: '600', color: colors.outline, marginBottom: 4 },
  metaValue: { fontSize: 14, fontWeight: '600', color: colors.onSurface },

  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.primary },

  tableHeaderRow: { flexDirection: 'row', paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: `${colors.outlineVariant}4D` },
  tableHeaderText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, color: colors.outline, textTransform: 'uppercase' },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  tableRowBorder: { borderBottomWidth: 1, borderBottomColor: `${colors.outlineVariant}33` },
  tableCellNama: { fontSize: 14, fontWeight: '600', color: colors.onSurface },
  tableCellNilai: { fontSize: 14, color: colors.onSurface },
  tableCellRujukan: { fontSize: 12, color: colors.onSurfaceVariant },
  flagPill: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  flagPillText: { fontSize: 10, fontWeight: '700' },
});
