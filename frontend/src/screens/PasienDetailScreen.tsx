import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError } from '../api/client';
import { fetchPasienDetail } from '../api/pasien';
import { useAuthStore } from '../store/authStore';
import { colors, radius, shadows, spacing } from '../theme/colors';
import { Text } from '../components/Text';
import type { AssignmentStatus, PasienDetail, StatusKunjungan } from '../api/types';
import { useTabBarClearance } from '../navigation/tabBarMetrics';
import { useHeaderScrollShadow } from '../hooks/useHeaderScrollShadow';
import type { PasienStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<PasienStackParamList, 'PasienDetail'>;
type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

const ASSIGNMENT_BADGE: Record<AssignmentStatus, { label: string; bg: string; fg: string }> = {
  ACTIVE: { label: 'AKTIF', bg: colors.primary, fg: colors.onPrimary },
  COMPLETED: { label: 'SELESAI', bg: colors.deepTealDark, fg: colors.onPrimary },
};

const KUNJUNGAN_ICON: Record<StatusKunjungan, IconName> = {
  SCHEDULED: 'event',
  ONGOING: 'pending',
  COMPLETED: 'check-circle',
  CANCELLED: 'cancel',
};

function formatTanggal(value: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function initials(nama: string) {
  const parts = nama.trim().split(/\s+/);
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

function calcUmur(tanggalLahir: string | null): number | null {
  if (!tanggalLahir) return null;
  const dob = new Date(tanggalLahir);
  const now = new Date();
  let umur = now.getFullYear() - dob.getFullYear();
  const belumUlangTahun =
    now.getMonth() < dob.getMonth() ||
    (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate());
  if (belumUlangTahun) umur -= 1;
  return umur;
}

export function PasienDetailScreen({ route, navigation }: Props) {
  const { pasienId, nama } = route.params;
  const token = useAuthStore((s) => s.token);
  const insets = useSafeAreaInsets();
  const tabBarClearance = useTabBarClearance();
  const { onScroll, scrollEventThrottle, scrolled } = useHeaderScrollShadow();
  const [detail, setDetail] = useState<PasienDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchPasienDetail(token as string, pasienId);
        if (!cancelled) setDetail(result);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Gagal memuat detail pasien');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [token, pasienId]);

  const onRefresh = useCallback(async () => {
    if (!token) return;
    setRefreshing(true);
    try {
      const result = await fetchPasienDetail(token, pasienId);
      setDetail(result);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat detail pasien');
    } finally {
      setRefreshing(false);
    }
  }, [token, pasienId]);

  const header = (
    <View style={[styles.header, { paddingTop: insets.top }, scrolled && shadows.header]}>
      <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
        <MaterialIcons name="arrow-back" size={24} color={colors.onBackground} />
      </Pressable>
      {/* 2 baris: nama pasien Indonesia gampang lewat dari ~28 karakter yang
          muat sebaris, dan judul yang kepotong "Muhammad Abdul Rah…" bikin
          dokter harus turun ke kartu buat memastikan pasiennya benar. */}
      <Text style={styles.headerTitle} numberOfLines={2}>
        {detail?.nama ?? nama}
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
          <Text style={styles.errorText}>{error ?? 'Data pasien tidak ditemukan'}</Text>
        </View>
      </View>
    );
  }

  const umur = calcUmur(detail.tanggalLahir);
  const badge = ASSIGNMENT_BADGE[detail.assignment.status];

  return (
    <View style={styles.container}>
      {header}
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: tabBarClearance }]}
        onScroll={onScroll}
        scrollEventThrottle={scrollEventThrottle}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
        }
      >
        {/* Hero: info pasien */}
        <View style={styles.heroCard}>
          <View style={styles.heroRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials(detail.nama)}</Text>
            </View>
            <View style={styles.heroInfo}>
              <Text style={styles.heroName}>{detail.nama}</Text>
              <View style={styles.heroMetaRow}>
                <MaterialIcons name="badge" size={16} color={colors.onSurfaceVariant} />
                <Text style={styles.heroMetaText}>RM: {detail.norm}</Text>
              </View>
              {umur !== null && (
                <View style={styles.heroMetaRow}>
                  <MaterialIcons name="cake" size={16} color={colors.onSurfaceVariant} />
                  <Text style={styles.heroMetaText}>{umur} Tahun</Text>
                </View>
              )}
              {/* Badge status pindah ke bawah info, bukan di kanan nama: waktu
                  masih sekolom dengan nama, sisa lebar buat nama cuma ~130pt,
                  jadi nama panjang (apalagi satu kata panjang) melewati kotaknya
                  dan menabrak badge ini. */}
              <View style={[styles.statusPill, { backgroundColor: badge.bg }]}>
                <Text style={[styles.statusPillText, { color: badge.fg }]}>{badge.label}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Bento: metrik klinis */}
        <View style={styles.bentoRow}>
          <View style={styles.bentoTile}>
            <View style={styles.bentoHeader}>
              <MaterialIcons name="bloodtype" size={18} color={colors.primary} />
              <Text style={styles.bentoLabel}>Gol. Darah</Text>
            </View>
            <Text style={styles.bentoValue}>{detail.golonganDarah ?? '-'}</Text>
          </View>
          <View style={styles.bentoTile}>
            <View style={styles.bentoHeader}>
              <MaterialIcons
                name={detail.jenisKelamin === 'L' ? 'male' : 'female'}
                size={18}
                color={colors.secondary}
              />
              <Text style={styles.bentoLabel}>Jenis Kelamin</Text>
            </View>
            <Text style={styles.bentoValue}>
              {detail.jenisKelamin === 'L' ? 'Laki-laki' : 'Perempuan'}
            </Text>
          </View>
        </View>

        {/* Akses cepat: Hasil Lab pasien ini */}
        <Pressable
          onPress={() => navigation.navigate('HasilLabList', { pasienId: detail.id, nama: detail.nama })}
          style={({ pressed }) => [styles.labLinkCard, pressed && styles.labLinkCardPressed]}
        >
          <View style={styles.labLinkIcon}>
            <MaterialIcons name="biotech" size={22} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.labLinkTitle}>Hasil Lab</Text>
            <Text style={styles.labLinkSubtitle}>Lihat riwayat pemeriksaan laboratorium</Text>
          </View>
          <MaterialIcons name="chevron-right" size={22} color={colors.outline} />
        </Pressable>

        {/* Riwayat kunjungan */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Riwayat Kunjungan</Text>
          {detail.riwayatKunjungan.length === 0 ? (
            <Text style={styles.emptyText}>Belum ada riwayat kunjungan.</Text>
          ) : (
            detail.riwayatKunjungan.map((k, index) => {
              const isFirst = index === 0;
              const isLast = index === detail.riwayatKunjungan.length - 1;
              return (
                <View key={k.id} style={styles.timelineItem}>
                  <View style={styles.timelineIconCol}>
                    <View
                      style={[
                        styles.timelineIconCircle,
                        isFirst && styles.timelineIconCircleActive,
                      ]}
                    >
                      <MaterialIcons
                        name={KUNJUNGAN_ICON[k.statusKunjungan]}
                        size={16}
                        color={isFirst ? colors.onPrimary : colors.onSurfaceVariant}
                      />
                    </View>
                    {!isLast && <View style={styles.timelineLine} />}
                  </View>

                  <View style={[styles.timelineCard, !isFirst && styles.timelineCardMuted]}>
                    <View style={styles.timelineCardHeader}>
                      <Text style={styles.timelineDate}>{formatTanggal(k.tanggalMasuk)}</Text>
                      {isFirst && (
                        <View style={styles.newBadge}>
                          <Text style={styles.newBadgeText}>Terbaru</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.timelineTitle}>{k.diagnosa ?? k.ruangan.nama}</Text>
                    <Text style={styles.timelineDesc}>
                      {k.ruangan.nama} ({k.ruangan.jenis}) · dr. {k.dokter.nama}
                      {k.isPasienBaru ? ' · Pasien baru' : ''}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.marginMobile, gap: spacing.gutter },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: { color: colors.error, textAlign: 'center' },
  emptyText: { color: colors.onSurfaceVariant },

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
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: colors.onBackground,
    textAlign: 'center',
  },

  heroCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.sm,
    padding: spacing.cardPadding,
    borderWidth: 1,
    borderColor: colors.surfaceVariant,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 2,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.primary,
    fontSize: 22,
    fontWeight: '700',
  },
  heroInfo: { flex: 1, gap: 4 },
  heroName: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.onSurface,
  },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroMetaText: {
    fontSize: 14,
    color: colors.onSurfaceVariant,
  },
  statusPill: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '600',
  },

  bentoRow: {
    flexDirection: 'row',
    gap: spacing.base,
  },
  bentoTile: {
    flex: 1,
    height: 96,
    backgroundColor: colors.surfaceSoft,
    borderRadius: radius.sm,
    padding: 16,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.surfaceVariant,
  },
  bentoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bentoLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
  },
  bentoValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.onSurface,
    textAlign: 'right',
  },

  labLinkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.sm,
    padding: spacing.cardPadding,
    borderWidth: 1,
    borderColor: colors.surfaceVariant,
  },
  labLinkCardPressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  labLinkIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labLinkTitle: { fontSize: 16, fontWeight: '700', color: colors.onSurface },
  labLinkSubtitle: { fontSize: 13, color: colors.onSurfaceVariant, marginTop: 2 },

  section: { marginTop: spacing.base },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.onBackground,
    marginBottom: 16,
  },

  timelineItem: {
    flexDirection: 'row',
  },
  timelineIconCol: {
    width: 40,
    alignItems: 'center',
  },
  timelineIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineIconCircleActive: {
    backgroundColor: colors.primary,
  },
  timelineLine: {
    flexGrow: 1,
    width: 2,
    minHeight: 16,
    backgroundColor: colors.outlineVariant,
    marginVertical: 4,
  },
  timelineCard: {
    flex: 1,
    marginLeft: 12,
    marginBottom: 16,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.sm,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.surfaceVariant,
  },
  timelineCardMuted: {
    opacity: 0.8,
    borderColor: 'transparent',
  },
  timelineCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  timelineDate: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  newBadge: {
    backgroundColor: colors.surfaceVariant,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  newBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.onSurfaceVariant,
  },
  timelineTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.onSurface,
    marginBottom: 4,
  },
  timelineDesc: {
    fontSize: 14,
    fontWeight: '300',
    color: colors.onSurfaceVariant,
  },
});
