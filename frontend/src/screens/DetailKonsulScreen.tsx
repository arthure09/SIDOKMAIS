import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, shadows, spacing } from '../theme/colors';
import { ms } from '../theme/responsive';
import { Text } from '../components/Text';
import { ApiError } from '../api/client';
import { fetchKunjunganDetail } from '../api/kunjungan';
import { useAuthStore } from '../store/authStore';
import type { KunjunganDetail } from '../api/types';
import { useTabBarClearance } from '../navigation/tabBarMetrics';
import { useHeaderScrollShadow } from '../hooks/useHeaderScrollShadow';
import type { OperasiStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<OperasiStackParamList, 'DetailKonsul'>;

const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: 'Terjadwal',
  ONGOING: 'Berlangsung',
  COMPLETED: 'Selesai',
  CANCELLED: 'Dibatalkan',
};

function formatTanggal(value: string) {
  return new Date(value).toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatJam(value: string) {
  return new Date(value).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
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

export function DetailKonsulScreen({ route, navigation }: Props) {
  const { kunjunganId } = route.params;
  const token = useAuthStore((s) => s.token);
  const insets = useSafeAreaInsets();
  const tabBarClearance = useTabBarClearance();
  const { onScroll, scrollEventThrottle, scrolled } = useHeaderScrollShadow();
  const [item, setItem] = useState<KunjunganDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchKunjunganDetail(token as string, kunjunganId);
        if (!cancelled) setItem(result);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Gagal memuat detail konsultasi');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [token, kunjunganId]);

  const header = (
    <View style={[styles.header, { paddingTop: insets.top }, scrolled && shadows.header]}>
      <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
        <MaterialIcons name="arrow-back" size={24} color={colors.onBackground} />
      </Pressable>
      <Text style={styles.headerTitle} numberOfLines={1}>
        {item?.diagnosa ?? 'Detail Konsultasi'}
      </Text>
      {item && (
        <View style={styles.statusPill}>
          <View style={styles.statusDot} />
          <Text style={styles.statusPillText}>
            {STATUS_LABEL[item.statusKunjungan] ?? item.statusKunjungan}
          </Text>
        </View>
      )}
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

  if (error || !item) {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.center}>
          <Text style={styles.errorText}>{error ?? 'Data konsultasi tidak ditemukan.'}</Text>
        </View>
      </View>
    );
  }

  const umur = calcUmur(item.pasien.tanggalLahir);
  const jenisKelamin = item.pasien.jenisKelamin === 'L' ? 'Laki-laki' : 'Perempuan';

  return (
    <View style={styles.container}>
      {header}

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: tabBarClearance }]}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={scrollEventThrottle}
      >
        <View style={styles.card}>
          <View style={styles.patientRow}>
            <View style={styles.patientAvatar}>
              <MaterialIcons name="person" size={28} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.patientName}>{item.pasien.nama}</Text>
              <View style={styles.patientMetaRow}>
                <Text style={styles.patientMetaText}>RM: {item.pasien.norm}</Text>
                {umur !== null && <Text style={styles.patientMetaText}>{umur} Tahun</Text>}
                <Text style={styles.patientMetaText}>{jenisKelamin}</Text>
              </View>
            </View>
            {item.isPasienBaru && (
              <View style={styles.baruPill}>
                <Text style={styles.baruPillText}>Pasien Baru</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Informasi Kunjungan</Text>
          <InfoRow icon="description" label="Diagnosa" value={item.diagnosa ?? 'Belum ada diagnosa'} />
          <View style={styles.infoDivider} />
          <InfoRow
            icon="event"
            label="Waktu"
            value={formatTanggal(item.tanggalMasuk)}
            secondary={`${formatJam(item.tanggalMasuk)} WIB`}
          />
          <View style={styles.infoDivider} />
          <InfoRow icon="location-on" label="Lokasi" value={item.ruangan.nama} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Dokter Penanggung Jawab</Text>
          <View style={styles.timRow}>
            <View style={styles.timAvatar}>
              <Text style={styles.timAvatarText}>
                {item.dokter.nama
                  .replace(/^dr\.\s*/i, '')
                  .slice(0, 2)
                  .toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.timNama}>{item.dokter.nama}</Text>
              {item.dokter.spesialisasi && <Text style={styles.timPeran}>{item.dokter.spesialisasi}</Text>}
            </View>
          </View>
        </View>

        {item.operasi.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Tindak Lanjut Operasi</Text>
            {item.operasi.map((op) => (
              <Pressable
                key={op.id}
                onPress={() => navigation.navigate('DetailJadwalOperasi', { operasiId: op.id })}
                style={styles.operasiRow}
              >
                <MaterialIcons name="medical-services" size={20} color={colors.primary} />
                <Text style={styles.operasiRowText}>
                  {formatTanggal(op.tanggalOperasi)} — {STATUS_LABEL[op.status] ?? op.status}
                </Text>
                <MaterialIcons name="chevron-right" size={20} color={colors.outline} />
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function InfoRow({
  icon,
  label,
  value,
  secondary,
}: {
  icon: string;
  label: string;
  value: string;
  secondary?: string;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIconCircle}>
        <MaterialIcons name={icon as never} size={20} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
        {secondary && <Text style={styles.infoSecondary}>{secondary}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(12),
    paddingHorizontal: spacing.marginMobile,
    paddingBottom: spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: `${colors.outlineVariant}1A`,
  },
  backButton: {
    width: ms(40),
    height: ms(40),
    borderRadius: ms(20),
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: ms(18),
    fontWeight: '600',
    color: colors.onBackground,
  },
  content: { padding: spacing.marginMobile, gap: spacing.gutter },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: ms(24) },
  errorText: { color: colors.error, textAlign: 'center' },

  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(8),
    backgroundColor: `${colors.primary}1A`,
    borderWidth: 1,
    borderColor: `${colors.primary}33`,
    paddingHorizontal: ms(14),
    paddingVertical: ms(8),
    borderRadius: radius.full,
  },
  statusDot: { width: ms(6), height: ms(6), borderRadius: ms(3), backgroundColor: colors.primary },
  statusPillText: {
    fontSize: ms(12),
    fontWeight: '600',
    letterSpacing: 0.5,
    color: colors.primary,
    textTransform: 'uppercase',
  },

  card: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.sm,
    padding: spacing.cardPadding,
    gap: ms(16),
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 2,
  },
  cardLabel: {
    fontSize: ms(12),
    fontWeight: '700',
    letterSpacing: 0.5,
    color: colors.outline,
    textTransform: 'uppercase',
  },

  patientRow: { flexDirection: 'row', alignItems: 'center', gap: ms(16) },
  patientAvatar: {
    width: ms(56),
    height: ms(56),
    borderRadius: ms(28),
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  patientName: { fontSize: ms(18), fontWeight: '700', color: colors.onSurface, marginBottom: ms(6) },
  patientMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: ms(12) },
  patientMetaText: { fontSize: ms(13), color: colors.onSurfaceVariant },
  baruPill: {
    backgroundColor: `${colors.primaryContainer}80`,
    paddingHorizontal: ms(10),
    paddingVertical: ms(6),
    borderRadius: radius.full,
  },
  baruPillText: { fontSize: ms(11), fontWeight: '700', color: colors.onPrimaryContainer },

  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: ms(16) },
  infoIconCircle: {
    width: ms(40),
    height: ms(40),
    borderRadius: ms(20),
    backgroundColor: colors.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoLabel: { fontSize: ms(13), color: colors.onSurfaceVariant, marginBottom: ms(2) },
  infoValue: { fontSize: ms(16), fontWeight: '700', color: colors.onSurface },
  infoSecondary: { fontSize: ms(13), fontWeight: '600', color: colors.primary, marginTop: ms(2) },
  infoDivider: { height: 1, backgroundColor: `${colors.outlineVariant}4D` },

  timRow: { flexDirection: 'row', alignItems: 'center', gap: ms(12), paddingVertical: ms(6) },
  timAvatar: {
    width: ms(40),
    height: ms(40),
    borderRadius: ms(20),
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timAvatarText: { fontSize: ms(12), fontWeight: '700', color: colors.onPrimary },
  timNama: { fontSize: ms(14), fontWeight: '600', color: colors.onSurface },
  timPeran: { fontSize: ms(12), color: colors.onSurfaceVariant },

  operasiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(12),
    paddingVertical: ms(10),
  },
  operasiRowText: { flex: 1, fontSize: ms(14), color: colors.onSurface },
});
