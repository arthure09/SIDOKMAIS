import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError } from '../api/client';
import { fetchHasilLabDetail } from '../api/lab';
import { hitungRelRujukan } from '../utils/rentangLab';
import { useAuthStore } from '../store/authStore';
import { colors, radius, shadows, spacing } from '../theme/colors';
import { Text } from '../components/Text';
import type { FlagHasilLab, HasilLabDetail, HasilLabItemApi } from '../api/types';
import { useHeaderScrollShadow } from '../hooks/useHeaderScrollShadow';
import { useHideTabBar } from '../hooks/useHideTabBar';
import type { PasienStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<PasienStackParamList, 'HasilLabDetail'>;

// Satu huruf di baris tabel (ruangnya sempit), satu kata di daftar "Perlu
// diperiksa" (di sana yang dibaca justru penyimpangannya, bukan angkanya).
const FLAG_SINGKAT: Record<FlagHasilLab, string> = {
  NORMAL: '',
  RENDAH: 'R',
  TINGGI: 'T',
  ABNORMAL: 'A',
};

const FLAG_LABEL: Record<FlagHasilLab, string> = {
  NORMAL: 'Normal',
  RENDAH: 'Di bawah rujukan',
  TINGGI: 'Di atas rujukan',
  ABNORMAL: 'Abnormal',
};

function formatTanggal(value: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatJam(value: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function unik(nilai: (string | null | undefined)[]) {
  return [...new Set(nilai.filter((v): v is string => !!v))];
}

// Rel rujukan: rentang rujukan sebagai segmen, hasil sebagai penanda di atasnya.
// Ini yang membuat angka bisa dibaca sekilas — "13,2-17,3" perlu dibandingkan
// dalam kepala, posisi penanda tidak.
//
// Warna penanda mengikuti `flag` DARI BACKEND, bukan geometri rel. Menyimpulkan
// sendiri "nilai ini abnormal" dari angka vs rentang adalah penafsiran klinis;
// backend sengaja tidak melakukannya (lihat simrs/lab.routes.js), jadi layar pun
// tidak. Kalau penandanya kelihatan di luar segmen sementara laboratorium tidak
// menandainya, itu tersaji apa adanya untuk dibaca dokter.
function RelRujukanBar({ item }: { item: HasilLabItemApi }) {
  const rel = hitungRelRujukan(item.nilai, item.nilaiRujukan);
  if (!rel) return null;

  const abnormal = item.flag !== 'NORMAL';
  return (
    <View style={styles.rel}>
      <View style={styles.relTrack} />
      <View
        style={[
          styles.relSegmen,
          { left: `${rel.awal * 100}%`, width: `${Math.max(rel.akhir - rel.awal, 0.02) * 100}%` },
        ]}
      />
      <View
        style={[styles.relPenanda, { left: `${rel.posisi * 100}%` }, abnormal && styles.relPenandaAlarm]}
      />
    </View>
  );
}

function BarisParameter({ item, berikutnya }: { item: HasilLabItemApi; berikutnya: boolean }) {
  const abnormal = item.flag !== 'NORMAL';
  return (
    <View style={[styles.baris, abnormal ? styles.barisAbnormal : berikutnya && styles.barisGaris]}>
      <View style={styles.barisAtas}>
        <Text style={styles.paramNama} numberOfLines={2}>
          {item.namaParameter}
        </Text>
        <View style={styles.nilaiWrap}>
          <Text style={[styles.nilai, abnormal && styles.nilaiAbnormal]}>{item.nilai}</Text>
          {item.satuan && <Text style={styles.satuan}>{item.satuan}</Text>}
          {abnormal && (
            <View style={styles.flagPill}>
              <Text style={styles.flagPillText}>{FLAG_SINGKAT[item.flag]}</Text>
            </View>
          )}
        </View>
      </View>
      <View style={styles.barisBawah}>
        <RelRujukanBar item={item} />
        <Text style={styles.rujukanText} numberOfLines={1}>
          {item.nilaiRujukan ? `Rujukan ${item.nilaiRujukan}` : 'Tanpa rujukan'}
        </Text>
      </View>
    </View>
  );
}

// Satu layar = seluruh hasil lab pada SATU tanggal. Daftar id-nya dikelompokkan
// di HasilLabListScreen; di sini tiap id diambil paralel lalu ditampilkan
// sebagai satu tabel per pemeriksaan di bawah satu kop pasien/tanggal.
// Endpoint tetap GET /api/lab/:id (dummy & SIMRS sama) — tidak ada endpoint
// "per tanggal", dan jumlah id per tanggal cuma segelintir, jadi tidak sepadan
// menambah satu lagi.
export function HasilLabDetailScreen({ route, navigation }: Props) {
  const { pemeriksaanLabIds, tanggal } = route.params;
  const token = useAuthStore((s) => s.token);
  const insets = useSafeAreaInsets();
  useHideTabBar();
  const { onScroll, scrollEventThrottle, scrolled } = useHeaderScrollShadow();
  const [detailList, setDetailList] = useState<HasilLabDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // `pemeriksaanLabIds` adalah array dari route params: identitasnya berubah
  // tiap render, jadi yang dijadikan dependency adalah isinya (string gabungan),
  // bukan arraynya — kalau tidak, efeknya fetch ulang tanpa henti.
  const idsKey = pemeriksaanLabIds.join(',');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const hasil = await Promise.all(
        idsKey.split(',').map((id) => fetchHasilLabDetail(token, id)),
      );
      setDetailList(hasil);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat detail hasil lab');
    } finally {
      setLoading(false);
    }
  }, [token, idsKey]);

  useEffect(() => {
    load();
  }, [load]);

  // Nilai bertanda dikumpulkan lintas pemeriksaan: pertanyaan pertama dokter
  // adalah "ada yang menyimpang?", bukan "apa isi Hematologi?".
  const perluDiperiksa = useMemo(
    () =>
      detailList.flatMap((d) =>
        (d.hasilLabItem ?? [])
          .filter((i) => i.flag !== 'NORMAL')
          .map((i) => ({ item: i, pemeriksaan: d.namaPemeriksaan })),
      ),
    [detailList],
  );

  const header = (
    <View style={[styles.header, { paddingTop: insets.top }, scrolled && shadows.header]}>
      <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
        <MaterialIcons name="arrow-back" size={24} color={colors.onBackground} />
      </Pressable>
      <View style={styles.headerTitleBlock}>
        <Text style={styles.headerEyebrow}>Lembar hasil</Text>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {formatTanggal(tanggal)}
        </Text>
      </View>
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

  if (error || detailList.length === 0) {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.center}>
          <Text style={styles.errorText}>{error ?? 'Data hasil lab tidak ditemukan'}</Text>
        </View>
      </View>
    );
  }

  const pasien = detailList[0].pasien;
  const labs = unik(detailList.map((d) => d.laboratorium));
  const dokter = unik(detailList.map((d) => d.dokterPeminta?.nama));
  const tanggalHasil = unik(detailList.map((d) => d.tanggalHasil)).sort().pop() ?? null;
  const totalNilai = detailList.reduce((n, d) => n + (d.hasilLabItem?.length ?? 0), 0);

  return (
    <View style={styles.container}>
      {header}
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.gutter }]}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={scrollEventThrottle}
      >
        {/* Kop: siapa, dari mana, kapan — lalu tiga angka yang merangkum lembar ini. */}
        <View style={styles.card}>
          <View>
            <Text style={styles.pasienNama}>{pasien?.nama ?? '-'}</Text>
            <Text style={styles.pasienMeta}>
              RM {pasien?.norm ?? '-'} · {labs.length > 0 ? labs.join(' · ') : 'Laboratorium tidak tercatat'}
            </Text>
          </View>

          <View style={styles.statRow}>
            <View style={styles.stat}>
              <Text style={styles.statAngka}>{detailList.length}</Text>
              <Text style={styles.statLabel}>Pemeriksaan</Text>
            </View>
            <View style={styles.statPemisah} />
            <View style={styles.stat}>
              <Text style={styles.statAngka}>{totalNilai}</Text>
              <Text style={styles.statLabel}>Nilai</Text>
            </View>
            <View style={styles.statPemisah} />
            <View style={styles.stat}>
              <Text style={[styles.statAngka, perluDiperiksa.length > 0 && styles.statAngkaAlarm]}>
                {perluDiperiksa.length}
              </Text>
              <Text style={styles.statLabel}>Ditandai lab</Text>
            </View>
          </View>

          <View style={styles.waktuRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.metaLabel}>Diminta</Text>
              <Text style={styles.metaValue}>{formatJam(tanggal)} WIB</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.metaLabel}>Hasil keluar</Text>
              <Text style={styles.metaValue}>
                {tanggalHasil ? `${formatJam(tanggalHasil)} WIB` : '-'}
              </Text>
            </View>
            <View style={{ flex: 1.4 }}>
              <Text style={styles.metaLabel}>Diminta oleh</Text>
              <Text style={styles.metaValue} numberOfLines={2}>
                {dokter.length > 0 ? dokter.join(', ') : '-'}
              </Text>
            </View>
          </View>
        </View>

        {/* Ringkasan penyimpangan. Isinya persis flag dari laboratorium — layar
            tidak menambahkan penilaian sendiri. */}
        {perluDiperiksa.length > 0 ? (
          <View style={[styles.card, styles.kartuPerhatian]}>
            <View style={styles.perhatianJudulRow}>
              <MaterialIcons name="priority-high" size={16} color={colors.onErrorContainer} />
              {/* Angkanya sudah ada di kop; di sini yang penting namanya. */}
              <Text style={styles.perhatianJudul}>Ditandai laboratorium</Text>
            </View>
            {perluDiperiksa.map(({ item, pemeriksaan }) => (
              <View key={item.id} style={styles.perhatianBaris}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.perhatianNama}>{item.namaParameter}</Text>
                  <Text style={styles.perhatianAsal}>
                    {pemeriksaan} · {FLAG_LABEL[item.flag]}
                  </Text>
                </View>
                <Text style={styles.perhatianNilai}>
                  {item.nilai}
                  {item.satuan ? ` ${item.satuan}` : ''}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.kartuAman}>
            <MaterialIcons name="check-circle-outline" size={18} color={colors.primary} />
            <Text style={styles.amanText}>
              Tidak ada nilai yang ditandai laboratorium pada lembar ini.
            </Text>
          </View>
        )}

        {detailList.map((detail) => {
          const item = detail.hasilLabItem;
          const abnormal = (item ?? []).filter((i) => i.flag !== 'NORMAL').length;
          return (
            <View key={detail.id} style={styles.card}>
              <View style={styles.seksiJudulRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.seksiJudul}>{detail.namaPemeriksaan}</Text>
                  <Text style={styles.seksiMeta}>
                    {unik([detail.kategori, detail.laboratorium]).join(' · ') || 'Tanpa kategori'}
                  </Text>
                </View>
                <View style={[styles.hitungPill, abnormal > 0 && styles.hitungPillAlarm]}>
                  <Text style={[styles.hitungPillText, abnormal > 0 && styles.hitungPillTextAlarm]}>
                    {abnormal > 0 ? `${abnormal}/${item?.length ?? 0} ditandai` : `${item?.length ?? 0} nilai`}
                  </Text>
                </View>
              </View>

              {item === null ? (
                <Text style={styles.emptyText}>
                  Laboratorium belum mengirim rincian parameter untuk pemeriksaan ini.
                </Text>
              ) : (
                <View>
                  {item.map((i, idx) => (
                    <BarisParameter key={i.id} item={i} berikutnya={idx < item.length - 1} />
                  ))}
                </View>
              )}

              {detail.catatan && (
                <View style={styles.catatan}>
                  <Text style={styles.metaLabel}>Catatan</Text>
                  <Text style={styles.metaValue}>{detail.catatan}</Text>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: { color: colors.error, textAlign: 'center' },
  emptyText: { color: colors.onSurfaceVariant, fontSize: 13, lineHeight: 19 },

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
  headerTitleBlock: { flex: 1, alignItems: 'center' },
  headerEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.primary,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.onBackground, textAlign: 'center' },

  content: { padding: spacing.marginMobile, gap: 12, paddingBottom: 32 },

  card: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.sm,
    padding: 18,
    gap: 16,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 15,
    elevation: 2,
  },

  pasienNama: { fontSize: 19, fontWeight: '800', color: colors.onSurface },
  pasienMeta: { fontSize: 12, color: colors.onSurfaceVariant, marginTop: 3 },

  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSoft,
    borderRadius: 12,
    paddingVertical: 12,
  },
  stat: { flex: 1, alignItems: 'center' },
  statPemisah: { width: 1, height: 28, backgroundColor: `${colors.outlineVariant}80` },
  statAngka: { fontSize: 20, fontWeight: '800', color: colors.primary, lineHeight: 24 },
  statAngkaAlarm: { color: colors.error },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },

  waktuRow: { flexDirection: 'row', gap: 12 },
  metaLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.outline,
    marginBottom: 3,
  },
  metaValue: { fontSize: 13, fontWeight: '600', color: colors.onSurface },

  kartuPerhatian: { backgroundColor: colors.errorContainer, gap: 10 },
  perhatianJudulRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  perhatianJudul: { fontSize: 14, fontWeight: '800', color: colors.onErrorContainer },
  perhatianBaris: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: `${colors.onErrorContainer}1A`,
  },
  perhatianNama: { fontSize: 14, fontWeight: '700', color: colors.onErrorContainer },
  perhatianAsal: { fontSize: 11, color: colors.onErrorContainer, opacity: 0.8, marginTop: 1 },
  perhatianNilai: { fontSize: 15, fontWeight: '800', color: colors.onErrorContainer },

  kartuAman: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surfaceSoft,
    borderRadius: radius.sm,
    padding: 14,
  },
  amanText: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.onSurfaceVariant },

  seksiJudulRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  seksiJudul: { fontSize: 16, fontWeight: '800', color: colors.primary },
  seksiMeta: { fontSize: 11, color: colors.onSurfaceVariant, marginTop: 2 },
  hitungPill: {
    backgroundColor: colors.surfaceContainer,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  hitungPillAlarm: { backgroundColor: colors.errorContainer },
  hitungPillText: { fontSize: 11, fontWeight: '700', color: colors.onSurfaceVariant },
  hitungPillTextAlarm: { color: colors.onErrorContainer },

  // Baris normal: garis rambut saja. Baris bertanda: blok bernada + rel merah di
  // kiri, jadi memindai lembar cukup dengan melihat mana yang berwarna.
  baris: { paddingVertical: 10, gap: 6 },
  barisGaris: { borderBottomWidth: 1, borderBottomColor: `${colors.outlineVariant}33` },
  barisAbnormal: {
    backgroundColor: `${colors.errorContainer}66`,
    borderLeftWidth: 3,
    borderLeftColor: colors.error,
    borderRadius: 10,
    paddingHorizontal: 10,
    marginVertical: 2,
  },
  barisAtas: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  paramNama: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.onSurface },
  nilaiWrap: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  nilai: { fontSize: 16, fontWeight: '800', color: colors.onSurface },
  nilaiAbnormal: { color: colors.error },
  satuan: { fontSize: 11, color: colors.onSurfaceVariant },
  flagPill: {
    backgroundColor: colors.error,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flagPillText: { fontSize: 9, fontWeight: '800', color: colors.onError, lineHeight: 11 },

  barisBawah: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rujukanText: { width: 118, textAlign: 'right', fontSize: 11, color: colors.onSurfaceVariant },

  // Rel rujukan — idiom yang sama dengan bar chart di Home (track redup + isi
  // primary), diputar horizontal.
  rel: { flex: 1, height: 12, justifyContent: 'center' },
  relTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: `${colors.outlineVariant}66`,
  },
  relSegmen: {
    position: 'absolute',
    height: 4,
    borderRadius: 2,
    backgroundColor: `${colors.primary}59`,
  },
  relPenanda: {
    position: 'absolute',
    width: 10,
    height: 10,
    marginLeft: -5,
    borderRadius: 5,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.backgroundWhite,
  },
  relPenandaAlarm: { backgroundColor: colors.error },

  catatan: { borderTopWidth: 1, borderTopColor: `${colors.outlineVariant}4D`, paddingTop: 12 },
});
