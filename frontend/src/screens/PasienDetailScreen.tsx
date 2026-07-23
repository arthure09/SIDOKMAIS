import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError } from '../api/client';
import { fetchPasienDetail } from '../api/pasien';
import { useAuthStore } from '../store/authStore';
import { colors, radius, spacing } from '../theme/colors';
import { Text } from '../components/Text';
import type { AssignmentStatus, PasienDetail, StatusKunjungan } from '../api/types';
import type { PasienStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<PasienStackParamList, 'PasienDetail'>;
type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

const ASSIGNMENT_BADGE: Record<AssignmentStatus, { label: string; bg: string; fg: string }> = {
  ACTIVE: { label: 'AKTIF', bg: colors.primary, fg: colors.onPrimary },
  COMPLETED: { label: 'SELESAI', bg: colors.tertiaryFixed, fg: colors.onTertiaryFixed },
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

export function PasienDetailScreen({ route }: Props) {
  const { pasienId } = route.params;
  const token = useAuthStore((s) => s.token);
  const insets = useSafeAreaInsets();
  const [detail, setDetail] = useState<PasienDetail | null>(null);
  const [loading, setLoading] = useState(true);
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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (error || !detail) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error ?? 'Data pasien tidak ditemukan'}</Text>
      </View>
    );
  }

  const umur = calcUmur(detail.tanggalLahir);
  const badge = ASSIGNMENT_BADGE[detail.assignment.status];

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 96 + insets.bottom }]}
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
            </View>
            <View style={[styles.statusPill, { backgroundColor: badge.bg }]}>
              <Text style={[styles.statusPillText, { color: badge.fg }]}>{badge.label}</Text>
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

      {/* Aksi tetap di bawah — belum tersambung ke endpoint tulis */}
      <View style={[styles.actionBar, { paddingBottom: spacing.marginMobile + insets.bottom }]}>
        <View style={styles.actionButton}>
          <MaterialIcons name="check-circle" size={20} color={colors.outline} />
          <Text style={styles.actionButtonText}>Tandai Selesai</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.marginMobile, gap: spacing.gutter },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: { color: colors.error, textAlign: 'center' },
  emptyText: { color: colors.onSurfaceVariant },

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

  actionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surfaceContainerLowest,
    paddingHorizontal: spacing.marginMobile,
    paddingTop: spacing.marginMobile,
    borderTopLeftRadius: radius.sm,
    borderTopRightRadius: radius.sm,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 6,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: colors.outlineVariant,
    borderRadius: radius.full,
    paddingVertical: 14,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: colors.outline,
  },
});
