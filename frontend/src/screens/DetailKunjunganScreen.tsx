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
import type { KunjunganDetail, OperasiStatus, StatusKunjungan } from '../api/types';
import { labelJenisKunjungan } from '../utils/jenisKunjungan';
import { useTabBarClearance } from '../navigation/tabBarMetrics';
import { useHeaderScrollShadow } from '../hooks/useHeaderScrollShadow';
import type { OperasiStackParamList } from '../navigation/types';

// Layar detail kunjungan poliklinik. Sebelumnya kartu di tab Poliklinik tidak
// bisa ditap karena layar ini belum ada (lihat komentar lama di
// JadwalOperasiKonsulScreen). Read-only, sama seperti seluruh modul Kunjungan.
//
// Tampilannya mengikuti DetailJadwalOperasiScreen baris demi baris — header
// dengan pil status, kartu identitas pasien, lalu kartu info berbaris ikon.
// Dua layar ini dibuka dari dua tab yang bersebelahan di layar yang sama, jadi
// bentuk yang berbeda terbaca sebagai dua aplikasi, bukan dua isi.

type Props = NativeStackScreenProps<OperasiStackParamList, 'DetailKunjungan'>;

const STATUS_LABEL: Record<StatusKunjungan, string> = {
  SCHEDULED: 'Terjadwal',
  ONGOING: 'Berlangsung',
  COMPLETED: 'Selesai',
  CANCELLED: 'Dibatalkan',
};

// Operasi punya enum sendiri (IN_PROGRESS, bukan ONGOING) — dipisah supaya
// TypeScript tidak diam-diam menerima nilai yang tidak ada labelnya.
const STATUS_OPERASI_LABEL: Record<OperasiStatus, string> = {
  SCHEDULED: 'Terjadwal',
  IN_PROGRESS: 'Berlangsung',
  COMPLETED: 'Selesai',
  CANCELLED: 'Dibatalkan',
};

// Pil status di DetailJadwalOperasiScreen selalu teal. Di sini warnanya ikut
// status: kunjungan yang dibatalkan tampil di daftar Poliklinik dengan warna
// merah, dan pil teal bertuliskan "Dibatalkan" membatalkan isyarat itu.
const STATUS_WARNA: Record<StatusKunjungan, string> = {
  SCHEDULED: colors.primary,
  ONGOING: colors.primary,
  COMPLETED: colors.outline,
  CANCELLED: colors.error,
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

function hitungUmur(tanggalLahir: string | null): number | null {
  if (!tanggalLahir) return null;
  const lahir = new Date(tanggalLahir);
  if (Number.isNaN(lahir.getTime())) return null;
  const now = new Date();
  let umur = now.getFullYear() - lahir.getFullYear();
  const belumUlangTahun =
    now.getMonth() < lahir.getMonth() ||
    (now.getMonth() === lahir.getMonth() && now.getDate() < lahir.getDate());
  if (belumUlangTahun) umur -= 1;
  return umur >= 0 ? umur : null;
}

/**
 * Satu baris info berikon, bentuknya sama dengan InfoRow di layar detail
 * operasi. Bedanya `value` boleh null: field kosong ditulis '—', tidak
 * disembunyikan — baris yang hilang diam-diam bikin dokter mengira datanya
 * belum selesai dimuat. Layar operasi bisa menyembunyikan karena field-nya
 * memang cuma ada setelah laporan operasi ditulis.
 */
function InfoRow({
  icon,
  label,
  value,
  secondary,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  value: string | null;
  secondary?: string | null;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIconCircle}>
        <MaterialIcons name={icon} size={20} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={[styles.infoValue, !value && styles.infoValueKosong]}>{value ?? '—'}</Text>
        {value && secondary ? <Text style={styles.infoSecondary}>{secondary}</Text> : null}
      </View>
    </View>
  );
}

export function DetailKunjunganScreen({ route, navigation }: Props) {
  const { kunjunganId } = route.params;
  const token = useAuthStore((s) => s.token);
  const insets = useSafeAreaInsets();
  const tabBarClearance = useTabBarClearance();
  const { onScroll, scrollEventThrottle, scrolled } = useHeaderScrollShadow();

  const [data, setData] = useState<KunjunganDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let batal = false;
    if (!token) return;

    setLoading(true);
    setError(null);
    fetchKunjunganDetail(token, kunjunganId)
      .then((hasil) => {
        if (!batal) setData(hasil);
      })
      .catch((err) => {
        if (!batal) setError(err instanceof ApiError ? err.message : 'Gagal memuat detail kunjungan');
      })
      .finally(() => {
        if (!batal) setLoading(false);
      });

    return () => {
      batal = true;
    };
  }, [token, kunjunganId]);

  const warnaStatus = data ? STATUS_WARNA[data.statusKunjungan] : colors.primary;

  const header = (
    <View style={[styles.header, { paddingTop: insets.top }, scrolled && shadows.header]}>
      <Pressable
        onPress={() => navigation.goBack()}
        style={styles.backButton}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Kembali"
      >
        <MaterialIcons name="arrow-back" size={24} color={colors.onBackground} />
      </Pressable>
      <Text style={styles.headerTitle} numberOfLines={1}>
        {data?.ruangan?.nama ?? 'Detail Kunjungan'}
      </Text>
      {data && (
        <View
          style={[
            styles.statusPill,
            { backgroundColor: `${warnaStatus}1A`, borderColor: `${warnaStatus}33` },
          ]}
        >
          <View style={[styles.statusDot, { backgroundColor: warnaStatus }]} />
          <Text style={[styles.statusPillText, { color: warnaStatus }]}>
            {STATUS_LABEL[data.statusKunjungan]}
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

  if (error || !data) {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.center}>
          <Text style={styles.errorText}>{error ?? 'Kunjungan tidak ditemukan.'}</Text>
        </View>
      </View>
    );
  }

  const pasien = data.pasien;
  const umur = hitungUmur(pasien?.tanggalLahir ?? null);
  const jenisKelamin =
    pasien?.jenisKelamin === 'L' ? 'Laki-laki' : pasien?.jenisKelamin === 'P' ? 'Perempuan' : null;

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
              <Text style={styles.patientName}>{pasien?.nama ?? '—'}</Text>
              <View style={styles.patientMetaRow}>
                <Text style={styles.patientMetaText}>RM: {pasien?.norm ?? '—'}</Text>
                {umur !== null && <Text style={styles.patientMetaText}>{umur} Tahun</Text>}
                {jenisKelamin && <Text style={styles.patientMetaText}>{jenisKelamin}</Text>}
              </View>
            </View>
          </View>
          {data.isPasienBaru ? (
            <View style={styles.chipBaru}>
              <MaterialIcons name="fiber-new" size={16} color={colors.primary} />
              <Text style={styles.chipBaruText}>Pasien baru</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Informasi Kunjungan</Text>
          <InfoRow
            icon="event"
            label="Waktu masuk"
            value={formatTanggal(data.tanggalMasuk)}
            secondary={`${formatJam(data.tanggalMasuk)} WIB`}
          />
          <View style={styles.infoDivider} />
          <InfoRow
            icon="schedule"
            label="Waktu keluar"
            value={data.tanggalKeluar ? formatTanggal(data.tanggalKeluar) : null}
            secondary={data.tanggalKeluar ? `${formatJam(data.tanggalKeluar)} WIB` : null}
          />
          <View style={styles.infoDivider} />
          <InfoRow
            icon="location-on"
            label="Lokasi"
            value={data.ruangan?.nama ?? null}
            secondary={labelJenisKunjungan(data.jenisKunjungan)}
          />
          <View style={styles.infoDivider} />
          <InfoRow icon="description" label="Diagnosa" value={data.diagnosa} />
          <View style={styles.infoDivider} />
          <InfoRow
            icon="person"
            label="DPJP"
            value={data.dokter?.nama ?? null}
            secondary={data.dokter?.spesialisasi ?? null}
          />
        </View>

        {data.operasi?.length ? (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Operasi Terkait</Text>
            <View style={{ gap: ms(4) }}>
              {data.operasi.map((o) => (
                <Pressable
                  key={o.id}
                  onPress={() => navigation.navigate('DetailJadwalOperasi', { operasiId: o.id })}
                  accessibilityRole="button"
                  accessibilityLabel={`Detail operasi ${formatTanggal(o.tanggalOperasi)}`}
                  style={({ pressed }) => [styles.operasiRow, pressed && styles.ditekan]}
                >
                  <View style={styles.infoIconCircle}>
                    <MaterialIcons name="medical-services" size={20} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.operasiTanggal}>{formatTanggal(o.tanggalOperasi)}</Text>
                    <Text style={styles.operasiStatus}>{STATUS_OPERASI_LABEL[o.status]}</Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={20} color={colors.outline} />
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

// Nilai style-nya sengaja disalin dari DetailJadwalOperasiScreen, bukan
// diimpor: repo ini memang menaruh satu StyleSheet per layar. Kalau nanti ada
// layar ketiga dengan bentuk yang sama, barulah kartu + InfoRow layak diangkat
// jadi komponen bersama.
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(12),
    paddingHorizontal: spacing.marginMobile,
    paddingBottom: spacing.base,
    backgroundColor: colors.background,
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
    borderWidth: 1,
    paddingHorizontal: ms(14),
    paddingVertical: ms(8),
    borderRadius: radius.full,
  },
  statusDot: { width: ms(6), height: ms(6), borderRadius: ms(3) },
  statusPillText: {
    fontSize: ms(12),
    fontWeight: '600',
    letterSpacing: 0.5,
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
  // Pil, bukan teks polos di baris meta: "pasien baru" bukan identitas pasien,
  // melainkan sifat kunjungan ini — dan hanya muncul di sebagian kunjungan.
  chipBaru: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(6),
    backgroundColor: `${colors.primary}1A`,
    paddingHorizontal: ms(12),
    paddingVertical: ms(6),
    borderRadius: radius.full,
  },
  chipBaruText: { fontSize: ms(12), fontWeight: '600', color: colors.primary },

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
  infoValueKosong: { color: colors.outline },
  infoSecondary: { fontSize: ms(13), fontWeight: '600', color: colors.primary, marginTop: ms(2) },
  infoDivider: { height: 1, backgroundColor: `${colors.outlineVariant}4D` },

  operasiRow: { flexDirection: 'row', alignItems: 'center', gap: ms(16), paddingVertical: ms(4) },
  ditekan: { opacity: 0.6 },
  operasiTanggal: { fontSize: ms(14), fontWeight: '700', color: colors.onSurface },
  operasiStatus: { fontSize: ms(13), color: colors.onSurfaceVariant, marginTop: ms(2) },
});
