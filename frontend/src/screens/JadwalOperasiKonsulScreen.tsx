import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '../theme/colors';
import { ms, wp } from '../theme/responsive';
import { Text } from '../components/Text';
import { ApiError } from '../api/client';
import { fetchOperasiList } from '../api/operasi';
import { fetchKunjunganList } from '../api/kunjungan';
import { useAuthStore } from '../store/authStore';
import type { KunjunganListItem, OperasiListItem, OperasiStatus, StatusKunjungan } from '../api/types';
import { useTabBarClearance } from '../navigation/tabBarMetrics';
import { useTabBarDockOnScroll } from '../hooks/useTabBarDockOnScroll';
import type { OperasiStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<OperasiStackParamList, 'JadwalOperasiKonsul'>;

function formatHariIni() {
  return new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatJam(value: string) {
  return new Date(value).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function formatTanggalSingkat(value: string) {
  return new Date(value).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' });
}

const OPERASI_STATUS_META: Record<
  OperasiStatus,
  { label: string; icon: string; bg: string; fg: string }
> = {
  IN_PROGRESS: { label: 'In-Progress', icon: 'sync', bg: '#a3a900', fg: '#393b00' },
  SCHEDULED: { label: 'Scheduled', icon: 'schedule', bg: colors.primaryContainer, fg: colors.onPrimaryContainer },
  COMPLETED: { label: 'Completed', icon: 'check-circle', bg: '#0D3D3B', fg: colors.onPrimary },
  CANCELLED: { label: 'Cancelled', icon: 'cancel', bg: colors.outlineVariant, fg: colors.onSurfaceVariant },
};

const KUNJUNGAN_STATUS_META: Record<
  StatusKunjungan,
  { label: string; icon: string; bg: string; fg: string }
> = {
  ONGOING: { label: 'Berlangsung', icon: 'sync', bg: '#a3a900', fg: '#393b00' },
  SCHEDULED: { label: 'Terjadwal', icon: 'schedule', bg: colors.primaryContainer, fg: colors.onPrimaryContainer },
  COMPLETED: { label: 'Selesai', icon: 'check-circle', bg: '#0D3D3B', fg: colors.onPrimary },
  CANCELLED: { label: 'Batal', icon: 'cancel', bg: colors.outlineVariant, fg: colors.onSurfaceVariant },
};

export function JadwalOperasiKonsulScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const tabBarClearance = useTabBarClearance();
  const { onScroll, scrollEventThrottle } = useTabBarDockOnScroll();
  const token = useAuthStore((s) => s.token);
  const [tab, setTab] = useState<'OPERASI' | 'KONSUL'>('OPERASI');

  const [operasiItems, setOperasiItems] = useState<OperasiListItem[]>([]);
  const [operasiLoading, setOperasiLoading] = useState(true);
  const [operasiError, setOperasiError] = useState<string | null>(null);

  const [kunjunganItems, setKunjunganItems] = useState<KunjunganListItem[]>([]);
  const [kunjunganLoading, setKunjunganLoading] = useState(true);
  const [kunjunganError, setKunjunganError] = useState<string | null>(null);
  const kunjunganLoaded = useRef(false);

  const loadOperasi = useCallback(async () => {
    if (!token) return;
    setOperasiLoading(true);
    setOperasiError(null);
    try {
      const result = await fetchOperasiList(token, { page: 1, limit: 50 });
      setOperasiItems(result.data);
    } catch (err) {
      setOperasiError(err instanceof ApiError ? err.message : 'Gagal memuat jadwal operasi');
    } finally {
      setOperasiLoading(false);
    }
  }, [token]);

  const loadKunjungan = useCallback(async () => {
    if (!token) return;
    setKunjunganLoading(true);
    setKunjunganError(null);
    try {
      const result = await fetchKunjunganList(token, { page: 1, limit: 50 });
      setKunjunganItems(result.data);
    } catch (err) {
      setKunjunganError(err instanceof ApiError ? err.message : 'Gagal memuat jadwal konsul');
    } finally {
      setKunjunganLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadOperasi();
  }, [loadOperasi]);

  useEffect(() => {
    if (tab === 'KONSUL' && !kunjunganLoaded.current) {
      kunjunganLoaded.current = true;
      loadKunjungan();
    }
  }, [tab, loadKunjungan]);

  function handleOperasiPress(item: OperasiListItem) {
    if (item.status === 'CANCELLED') return;
    navigation.navigate('DetailJadwalOperasi', { operasiId: item.id });
  }

  function handleKunjunganPress(item: KunjunganListItem) {
    if (item.statusKunjungan === 'CANCELLED') return;
    navigation.navigate('DetailKonsul', { kunjunganId: item.id });
  }

  return (
    <View style={styles.container}>
      <View style={[styles.headerArea, { paddingTop: insets.top + ms(spacing.marginMobile) }]}>
        <Text style={styles.title}>Jadwal Operasi</Text>
        <View style={styles.toggle}>
          <Pressable
            onPress={() => setTab('OPERASI')}
            style={[styles.toggleButton, tab === 'OPERASI' && styles.toggleButtonActive]}
          >
            <Text
              style={[styles.toggleText, tab === 'OPERASI' && styles.toggleTextActive]}
            >
              Operasi
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setTab('KONSUL')}
            style={[styles.toggleButton, tab === 'KONSUL' && styles.toggleButtonActive]}
          >
            <Text style={[styles.toggleText, tab === 'KONSUL' && styles.toggleTextActive]}>
              Konsul
            </Text>
          </Pressable>
        </View>
        <View style={styles.dateFilter}>
          <MaterialIcons name="calendar-month" size={20} color={colors.primary} />
          <Text style={styles.dateFilterText}>Hari Ini, {formatHariIni()}</Text>
        </View>
      </View>

      {tab === 'KONSUL' ? (
        kunjunganLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : kunjunganError ? (
          <View style={styles.center}>
            <Text style={styles.errorText}>{kunjunganError}</Text>
          </View>
        ) : kunjunganItems.length === 0 ? (
          <View style={styles.center}>
            <MaterialIcons name="chat-bubble" size={40} color={colors.outlineVariant} />
            <Text style={styles.comingSoonTitle}>Belum ada jadwal konsul</Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={[styles.listContent, { paddingBottom: tabBarClearance }]}
            showsVerticalScrollIndicator={false}
            onScroll={onScroll}
            scrollEventThrottle={scrollEventThrottle}
          >
            {kunjunganItems.map((item) => {
              const meta = KUNJUNGAN_STATUS_META[item.statusKunjungan];
              const cancelled = item.statusKunjungan === 'CANCELLED';
              return (
                <Pressable
                  key={item.id}
                  disabled={cancelled}
                  onPress={() => handleKunjunganPress(item)}
                  style={({ pressed }) => [
                    styles.card,
                    cancelled && styles.cardCancelled,
                    pressed && styles.cardPressed,
                  ]}
                >
                  <View style={styles.cardTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTime}>
                        {formatTanggalSingkat(item.tanggalMasuk)}, {formatJam(item.tanggalMasuk)}
                      </Text>
                      <Text style={[styles.cardPatient, cancelled && styles.cardPatientCancelled]}>
                        {item.pasien.nama}
                      </Text>
                      <Text style={styles.cardTindakan}>{item.diagnosa ?? 'Belum ada diagnosa'}</Text>
                    </View>
                    <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
                      <MaterialIcons name={meta.icon as never} size={14} color={meta.fg} />
                      <Text style={[styles.statusPillText, { color: meta.fg }]}>{meta.label}</Text>
                    </View>
                  </View>
                  {!cancelled && (
                    <>
                      <View style={styles.cardDivider} />
                      <View style={styles.cardBottom}>
                        <View style={styles.cardBottomItem}>
                          <MaterialIcons name="meeting-room" size={18} color={colors.primary} />
                          <Text style={styles.cardBottomText}>{item.ruangan.nama}</Text>
                        </View>
                        <View style={styles.cardBottomItem}>
                          <MaterialIcons name="person" size={18} color={colors.primary} />
                          <Text style={styles.cardBottomText}>{item.dokter.nama}</Text>
                        </View>
                      </View>
                    </>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        )
      ) : operasiLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : operasiError ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{operasiError}</Text>
        </View>
      ) : operasiItems.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.comingSoonTitle}>Belum ada jadwal operasi</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.listContent, { paddingBottom: tabBarClearance }]}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={scrollEventThrottle}
        >
          {operasiItems.map((item) => {
            const meta = OPERASI_STATUS_META[item.status];
            const cancelled = item.status === 'CANCELLED';
            return (
              <Pressable
                key={item.id}
                disabled={cancelled}
                onPress={() => handleOperasiPress(item)}
                style={({ pressed }) => [
                  styles.card,
                  cancelled && styles.cardCancelled,
                  pressed && styles.cardPressed,
                ]}
              >
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTime}>
                      {formatTanggalSingkat(item.tanggalOperasi)}, {formatJam(item.tanggalOperasi)}
                    </Text>
                    <Text style={[styles.cardPatient, cancelled && styles.cardPatientCancelled]}>
                      {item.kunjungan.pasien.nama}
                    </Text>
                    <Text style={styles.cardTindakan}>{item.jenisTindakan}</Text>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
                    <MaterialIcons name={meta.icon as never} size={14} color={meta.fg} />
                    <Text style={[styles.statusPillText, { color: meta.fg }]}>{meta.label}</Text>
                  </View>
                </View>
                {!cancelled && (
                  <>
                    <View style={styles.cardDivider} />
                    <View style={styles.cardBottom}>
                      <View style={styles.cardBottomItem}>
                        <MaterialIcons name="meeting-room" size={18} color={colors.primary} />
                        <Text style={styles.cardBottomText}>{item.ruangan.nama}</Text>
                      </View>
                      <View style={styles.cardBottomItem}>
                        <MaterialIcons name="person" size={18} color={colors.primary} />
                        <Text style={styles.cardBottomText}>{item.kunjungan.dokter.nama}</Text>
                      </View>
                    </View>
                  </>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  headerArea: { padding: spacing.marginMobile, paddingBottom: ms(8), gap: ms(16) },
  title: { fontSize: ms(20), fontWeight: '700', color: colors.onSurface },
  toggle: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceVariant,
    borderRadius: radius.full,
    padding: ms(4),
    alignSelf: 'center',
    width: '100%',
    maxWidth: wp(85),
  },
  toggleButton: { flex: 1, paddingVertical: ms(10), borderRadius: radius.full, alignItems: 'center' },
  toggleButtonActive: { backgroundColor: colors.primary },
  toggleText: { fontSize: ms(12), fontWeight: '600', color: colors.onSurfaceVariant },
  toggleTextActive: { color: colors.onPrimary },
  dateFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(10),
    backgroundColor: colors.surfaceSoft,
    borderRadius: radius.full,
    paddingHorizontal: ms(16),
    paddingVertical: ms(12),
  },
  dateFilterText: { fontSize: ms(16), color: colors.onSurface },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: ms(8), padding: ms(32) },
  comingSoonTitle: { fontSize: ms(16), fontWeight: '700', color: colors.onSurfaceVariant },
  errorText: { color: colors.error, textAlign: 'center' },

  listContent: { padding: spacing.marginMobile, paddingTop: ms(8), gap: spacing.gutter },
  card: {
    backgroundColor: colors.backgroundWhite,
    borderRadius: ms(24),
    padding: spacing.cardPadding,
    gap: ms(16),
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 2,
  },
  cardCancelled: { backgroundColor: colors.surfaceVariant, opacity: 0.7, elevation: 0 },
  cardPressed: { opacity: 0.92 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardTime: { fontSize: ms(12), fontWeight: '600', color: colors.outline },
  cardPatient: { fontSize: ms(20), fontWeight: '700', color: colors.onSurface, marginTop: ms(4) },
  cardPatientCancelled: { textDecorationLine: 'line-through', color: colors.outline },
  cardTindakan: { fontSize: ms(14), color: colors.onSurfaceVariant, marginTop: ms(2) },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(4),
    paddingHorizontal: ms(12),
    paddingVertical: ms(6),
    borderRadius: radius.full,
  },
  statusPillText: { fontSize: ms(12), fontWeight: '600' },
  cardDivider: { height: 1, backgroundColor: colors.surfaceVariant },
  cardBottom: { flexDirection: 'row', gap: ms(24) },
  cardBottomItem: { flexDirection: 'row', alignItems: 'center', gap: ms(8) },
  cardBottomText: { fontSize: ms(14), color: colors.onSurfaceVariant },
});
