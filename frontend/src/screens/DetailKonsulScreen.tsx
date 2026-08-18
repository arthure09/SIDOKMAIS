import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, shadows, spacing } from '../theme/colors';
import { ms } from '../theme/responsive';
import { Text } from '../components/Text';
import { ApiError } from '../api/client';
import { fetchKonsultasiDetail } from '../api/konsultasi';
import { useAuthStore } from '../store/authStore';
import type { KonsultasiDetail, StatusKonsultasi } from '../api/types';
import { labelJenisKunjungan } from '../utils/jenisKunjungan';
import { useTabBarClearance } from '../navigation/tabBarMetrics';
import { useHeaderScrollShadow } from '../hooks/useHeaderScrollShadow';
import type { OperasiStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<OperasiStackParamList, 'DetailKonsul'>;

const STATUS_LABEL: Record<StatusKonsultasi, string> = {
  MENUNGGU_JAWABAN: 'Menunggu Jawaban',
  SUDAH_DIJAWAB: 'Sudah Dijawab',
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

/**
 * Ikhtisar klinis: cuma tampilkan yang terisi. Lembar konsul di lapangan sering
 * diisi sebagian, dan mencetak "Suhu: –" untuk field yang memang tidak diukur
 * itu memberi kesan datanya hilang, bukan tidak diambil.
 */
function ikhtisarTerisi(item: KonsultasiDetail) {
  const baris: { label: string; nilai: string }[] = [];
  if (item.kesadaran) baris.push({ label: 'Kesadaran', nilai: item.kesadaran });
  if (item.tekananDarah) baris.push({ label: 'Tekanan Darah', nilai: `${item.tekananDarah} mmHg` });
  if (item.nadi !== null) baris.push({ label: 'Nadi', nilai: `${item.nadi} x/menit` });
  if (item.pernapasan !== null) baris.push({ label: 'Pernapasan', nilai: `${item.pernapasan} x/menit` });
  if (item.suhu !== null) baris.push({ label: 'Suhu', nilai: `${item.suhu} °C` });
  if (item.tinggiBadan !== null) baris.push({ label: 'Tinggi Badan', nilai: `${item.tinggiBadan} cm` });
  if (item.beratBadan !== null) baris.push({ label: 'Berat Badan', nilai: `${item.beratBadan} kg` });
  if (item.nyeri !== null) baris.push({ label: 'Skala Nyeri', nilai: `${item.nyeri}/10` });
  return baris;
}

export function DetailKonsulScreen({ route, navigation }: Props) {
  const { konsultasiId } = route.params;
  const token = useAuthStore((s) => s.token);
  const insets = useSafeAreaInsets();
  const tabBarClearance = useTabBarClearance();
  const { onScroll, scrollEventThrottle, scrolled } = useHeaderScrollShadow();
  const [item, setItem] = useState<KonsultasiDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchKonsultasiDetail(token as string, konsultasiId);
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
  }, [token, konsultasiId]);

  const header = (
    <View style={[styles.header, { paddingTop: insets.top }, scrolled && shadows.header]}>
      <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
        <MaterialIcons name="arrow-back" size={24} color={colors.onBackground} />
      </Pressable>
      <Text style={styles.headerTitle} numberOfLines={1}>
        {item ? 'Lembar Konsultasi' : 'Detail Konsultasi'}
      </Text>
      {item && (
        <View style={styles.statusPill}>
          <View style={styles.statusDot} />
          <Text style={styles.statusPillText}>{STATUS_LABEL[item.status]}</Text>
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
  const jenisLabel = labelJenisKunjungan(item.jenisKunjungan);
  const ikhtisar = ikhtisarTerisi(item);
  const sudahDijawab = item.status === 'SUDAH_DIJAWAB';

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
            {item.prioritas === 'CITO' && (
              <View style={styles.citoPill}>
                <MaterialIcons name="priority-high" size={14} color={colors.onErrorContainer} />
                <Text style={styles.citoPillText}>CITO</Text>
              </View>
            )}
          </View>
        </View>

        {/* SECTION 1 — PERMINTAAN. Selalu tampil: ini isi surat konsulnya. */}
        <View style={styles.sectionHeading}>
          <MaterialIcons name="outgoing-mail" size={18} color={colors.primary} />
          <Text style={styles.sectionHeadingText}>Permintaan Konsultasi</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.timRow}>
            <View style={styles.timAvatar}>
              <Text style={styles.timAvatarText}>
                {item.dokterPengirim.nama.replace(/^dr\.\s*/i, '').slice(0, 2).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.timNama}>{item.dokterPengirim.nama}</Text>
              <Text style={styles.timPeran}>
                {item.dokterPengirim.spesialisasi ?? 'Dokter pengirim'}
              </Text>
            </View>
          </View>
          <View style={styles.infoDivider} />
          <InfoRow
            icon="event"
            label="Tanggal Permintaan"
            value={formatTanggal(item.tanggalPermintaan)}
            secondary={`${formatJam(item.tanggalPermintaan)} WIB`}
          />
          {jenisLabel && (
            <>
              <View style={styles.infoDivider} />
              <InfoRow
                icon="meeting-room"
                label="Konteks Kunjungan"
                value={jenisLabel}
                secondary={item.kunjungan?.ruangan.nama}
              />
            </>
          )}
          <View style={styles.infoDivider} />
          <InfoRow icon="description" label="Diagnosis Kerja" value={item.diagnosisKerja} />
        </View>

        {ikhtisar.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Ikhtisar Klinis</Text>
            <View style={styles.vitalGrid}>
              {ikhtisar.map((v) => (
                <View key={v.label} style={styles.vitalItem}>
                  <Text style={styles.vitalLabel}>{v.label}</Text>
                  <Text style={styles.vitalValue}>{v.nilai}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Konsul yang Diminta</Text>
          <Text style={styles.naratif}>{item.konsulYangDiminta}</Text>
        </View>

        {/* SECTION 2 — JAWABAN. Kondisional: selama MENUNGGU_JAWABAN seluruh
            field jawaban memang null di server, jadi yang tampil bukan kartu
            kosong tapi penanda bahwa jawabannya belum masuk. */}
        <View style={styles.sectionHeading}>
          <MaterialIcons
            name={sudahDijawab ? 'mark-email-read' : 'hourglass-empty'}
            size={18}
            color={colors.primary}
          />
          <Text style={styles.sectionHeadingText}>Jawaban Konsultasi</Text>
        </View>

        {sudahDijawab ? (
          <>
            <View style={styles.card}>
              <View style={styles.timRow}>
                <View style={styles.timAvatar}>
                  <Text style={styles.timAvatarText}>
                    {item.dokterTujuan.nama.replace(/^dr\.\s*/i, '').slice(0, 2).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.timNama}>{item.dokterTujuan.nama}</Text>
                  <Text style={styles.timPeran}>
                    {item.dokterTujuan.spesialisasi ?? 'Dokter yang dikonsultasikan'}
                  </Text>
                </View>
              </View>
              {item.tanggalJawaban && (
                <>
                  <View style={styles.infoDivider} />
                  <InfoRow
                    icon="event-available"
                    label="Tanggal Jawaban"
                    value={formatTanggal(item.tanggalJawaban)}
                    secondary={`${formatJam(item.tanggalJawaban)} WIB`}
                  />
                </>
              )}
            </View>

            {item.penemuan && (
              <View style={styles.card}>
                <Text style={styles.cardLabel}>Penemuan</Text>
                <Text style={styles.naratif}>{item.penemuan}</Text>
              </View>
            )}

            <View style={styles.card}>
              {item.diagnosisJawaban && (
                <InfoRow icon="fact-check" label="Diagnosis" value={item.diagnosisJawaban} />
              )}
              {item.anjuran && (
                <>
                  <View style={styles.infoDivider} />
                  <InfoRow icon="tips-and-updates" label="Anjuran" value={item.anjuran} />
                </>
              )}
              {item.setujuUntuk && (
                <>
                  <View style={styles.infoDivider} />
                  <InfoRow icon="how-to-reg" label="Setuju Untuk" value={item.setujuUntuk} />
                </>
              )}
            </View>
          </>
        ) : (
          <View style={[styles.card, styles.menungguCard]}>
            <MaterialIcons name="hourglass-empty" size={28} color={colors.outline} />
            <Text style={styles.menungguText}>
              Konsultasi ini belum dijawab. Jawaban akan muncul di sini setelah masuk dari SIMRS.
            </Text>
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

  // Penanda batas dua bagian surat (permintaan vs jawaban) — tanpa ini kartu
  // jawaban terbaca seperti lanjutan kartu permintaan.
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(8),
    marginTop: ms(4),
  },
  sectionHeadingText: {
    fontSize: ms(13),
    fontWeight: '800',
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
  naratif: { fontSize: ms(15), lineHeight: ms(22), color: colors.onSurface },

  menungguCard: { alignItems: 'center', gap: ms(10), paddingVertical: ms(28) },
  menungguText: {
    fontSize: ms(14),
    lineHeight: ms(20),
    color: colors.onSurfaceVariant,
    textAlign: 'center',
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
  citoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(2),
    paddingLeft: ms(6),
    paddingRight: ms(10),
    paddingVertical: ms(6),
    borderRadius: radius.full,
    backgroundColor: colors.errorContainer,
  },
  citoPillText: { fontSize: ms(11), fontWeight: '800', color: colors.onErrorContainer },

  // Dua kolom: pasangan label/nilai vital sign pendek-pendek, satu per baris
  // bikin kartunya panjang tanpa alasan.
  vitalGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: ms(14) },
  vitalItem: { width: '50%', paddingRight: ms(8) },
  vitalLabel: { fontSize: ms(12), color: colors.onSurfaceVariant },
  vitalValue: { fontSize: ms(15), fontWeight: '700', color: colors.onSurface, marginTop: ms(2) },

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
});
