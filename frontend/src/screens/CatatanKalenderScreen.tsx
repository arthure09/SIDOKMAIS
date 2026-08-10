import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, shadows, spacing } from '../theme/colors';
import { ms } from '../theme/responsive';
import { Text } from '../components/Text';
import { TextInput } from '../components/TextInput';
import { ApiError } from '../api/client';
import {
  createCatatanKalender,
  deleteCatatanKalender,
  fetchCatatanKalenderList,
  updateCatatanKalender,
} from '../api/kalender';
import { fetchOperasiList } from '../api/operasi';
import { fetchKunjunganList } from '../api/kunjungan';
import { useAuthStore } from '../store/authStore';
import type { CatatanKalenderItem, KunjunganListItem, OperasiListItem, TipeCatatanKalender } from '../api/types';
import { useTabBarClearance } from '../navigation/tabBarMetrics';
import { useTabBarDockOnScroll } from '../hooks/useTabBarDockOnScroll';
import type { ProfilStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<ProfilStackParamList, 'CatatanKalender'>;

const WEEKDAY_LABELS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
const GRID_CELLS = 42; // 6 baris x 7 kolom, cukup buat bulan mana pun

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// Query param, bukan tampilan — tanggal kalender LOKAL device (sama seperti
// toDateParam di HasilLabListScreen), bukan toISOString() yang bisa geser
// ke hari sebelum/sesudahnya kalau device di timezone +.
function toDateParam(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function buildMonthGrid(monthCursor: Date) {
  const first = startOfMonth(monthCursor);
  const firstWeekday = (first.getDay() + 6) % 7; // 0=Senin ... 6=Minggu
  const gridStart = addDays(first, -firstWeekday);
  return Array.from({ length: GRID_CELLS }, (_, i) => addDays(gridStart, i));
}

function groupByDateKey<T>(items: T[], getIso: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = toDateParam(new Date(getIso(item)));
    const arr = map.get(key);
    if (arr) arr.push(item);
    else map.set(key, [item]);
  }
  return map;
}

function formatMonthLabel(d: Date) {
  return d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
}

function formatSelectedDateLabel(d: Date) {
  return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function formatJam(iso: string) {
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function timeStringToDate(waktu: string | null) {
  const base = new Date();
  if (waktu && /^\d{2}:\d{2}$/.test(waktu)) {
    const [h, m] = waktu.split(':').map(Number);
    base.setHours(h, m, 0, 0);
  } else {
    base.setHours(9, 0, 0, 0);
  }
  return base;
}

function dateToTimeString(d: Date) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const TIPE_META: Record<TipeCatatanKalender, { label: string; icon: keyof typeof MaterialIcons.glyphMap; color: string }> = {
  REMINDER: { label: 'Pengingat', icon: 'notifications', color: colors.primary },
  BLOCKING: { label: 'Blokir Waktu', icon: 'block', color: colors.error },
  PRIBADI: { label: 'Pribadi', icon: 'person', color: colors.secondary },
};

export function CatatanKalenderScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const tabBarClearance = useTabBarClearance();
  const { onScroll, scrollEventThrottle, scrolled } = useTabBarDockOnScroll();
  const token = useAuthStore((s) => s.token);
  const isDokter = useAuthStore((s) => s.pengguna?.role === 'DOKTER');

  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => new Date());

  const [catatanList, setCatatanList] = useState<CatatanKalenderItem[]>([]);
  const [catatanLoading, setCatatanLoading] = useState(true);
  const [catatanError, setCatatanError] = useState<string | null>(null);
  const [adminCatatan, setAdminCatatan] = useState<string | null>(null);

  const [operasiList, setOperasiList] = useState<OperasiListItem[]>([]);
  const [kunjunganList, setKunjunganList] = useState<KunjunganListItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadCatatan = useCallback(
    async (isCancelled: () => boolean) => {
      if (!token) return;
      setCatatanLoading(true);
      setCatatanError(null);
      try {
        const result = await fetchCatatanKalenderList(token, {
          dari: toDateParam(startOfMonth(monthCursor)),
          sampai: toDateParam(addDays(addMonths(monthCursor, 1), -1)),
        });
        if (isCancelled()) return;
        setCatatanList(result.data);
        setAdminCatatan(result.adminCatatan ?? null);
      } catch (err) {
        if (isCancelled()) return;
        setCatatanError(err instanceof ApiError ? err.message : 'Gagal memuat kalender');
      } finally {
        if (!isCancelled()) setCatatanLoading(false);
      }
    },
    [token, monthCursor],
  );

  useEffect(() => {
    let cancelled = false;
    loadCatatan(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [loadCatatan]);

  // Layer read-only (Operasi/Kunjungan) — cuma jadwal SCHEDULED, sekali ambil
  // (bukan re-fetch per bulan) lalu dikelompokkan per tanggal di sisi klien.
  // ponytail: limit=100 cukup buat 1 dokter di app dummy-data ini; naikkan
  // atau tambah param dari/sampai kalau operasi.routes.js/kunjungan.routes.js
  // sudah dukung filter rentang tanggal.
  const loadJadwal = useCallback(async () => {
    if (!token || !isDokter) return;
    try {
      const [operasiRes, kunjunganRes] = await Promise.all([
        fetchOperasiList(token, { status: 'SCHEDULED', page: 1, limit: 100 }),
        fetchKunjunganList(token, { status: 'SCHEDULED', page: 1, limit: 100 }),
      ]);
      setOperasiList(operasiRes.data);
      setKunjunganList(kunjunganRes.data);
    } catch {
      // Layer read-only bukan bagian kritikal screen ini — biarkan kosong kalau gagal.
    }
  }, [token, isDokter]);

  useEffect(() => {
    loadJadwal();
  }, [loadJadwal]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadCatatan(() => false), loadJadwal()]);
    setRefreshing(false);
  }, [loadCatatan, loadJadwal]);

  const catatanByDate = useMemo(() => {
    const map = groupByDateKey(catatanList, (item) => item.tanggal);
    for (const arr of map.values()) {
      arr.sort((a, b) => (a.waktu ?? '99:99').localeCompare(b.waktu ?? '99:99'));
    }
    return map;
  }, [catatanList]);
  const operasiByDate = useMemo(() => groupByDateKey(operasiList, (o) => o.tanggalOperasi), [operasiList]);
  const kunjunganByDate = useMemo(() => groupByDateKey(kunjunganList, (k) => k.tanggalMasuk), [kunjunganList]);

  const gridDates = useMemo(() => buildMonthGrid(monthCursor), [monthCursor]);
  const today = useMemo(() => new Date(), []);

  const selectedKey = toDateParam(selectedDate);
  const selectedCatatan = catatanByDate.get(selectedKey) ?? [];
  const selectedOperasi = operasiByDate.get(selectedKey) ?? [];
  const selectedKunjungan = kunjunganByDate.get(selectedKey) ?? [];

  function goToMonth(offset: number) {
    const next = addMonths(monthCursor, offset);
    setMonthCursor(next);
    setSelectedDate(next);
  }

  // --- Form tambah/edit catatan ---
  const [formVisible, setFormVisible] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [formId, setFormId] = useState<string | null>(null);
  const [formTanggal, setFormTanggal] = useState(new Date());
  const [formWaktu, setFormWaktu] = useState<string | null>(null);
  const [formJudul, setFormJudul] = useState('');
  const [formCatatan, setFormCatatan] = useState('');
  const [formTipe, setFormTipe] = useState<TipeCatatanKalender>('REMINDER');
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showTanggalPicker, setShowTanggalPicker] = useState(false);
  const [showWaktuPicker, setShowWaktuPicker] = useState(false);

  function openCreateForm() {
    setFormMode('create');
    setFormId(null);
    setFormTanggal(selectedDate);
    setFormWaktu(null);
    setFormJudul('');
    setFormCatatan('');
    setFormTipe('REMINDER');
    setFormError(null);
    setFormVisible(true);
  }

  function openEditForm(item: CatatanKalenderItem) {
    setFormMode('edit');
    setFormId(item.id);
    setFormTanggal(new Date(item.tanggal));
    setFormWaktu(item.waktu);
    setFormJudul(item.judul);
    setFormCatatan(item.catatan ?? '');
    setFormTipe(item.tipe);
    setFormError(null);
    setFormVisible(true);
  }

  function closeForm() {
    setFormVisible(false);
    setShowTanggalPicker(false);
    setShowWaktuPicker(false);
  }

  const onChangeTanggal = useCallback((event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS !== 'ios') setShowTanggalPicker(false);
    if (event.type === 'dismissed') return;
    if (selected) setFormTanggal(selected);
  }, []);

  const onChangeWaktu = useCallback((event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS !== 'ios') setShowWaktuPicker(false);
    if (event.type === 'dismissed') return;
    if (selected) setFormWaktu(dateToTimeString(selected));
  }, []);

  async function handleSave() {
    if (!token) return;
    if (!formJudul.trim()) {
      setFormError('Judul wajib diisi');
      return;
    }
    setFormSaving(true);
    setFormError(null);
    const body = {
      tanggal: toDateParam(formTanggal),
      waktu: formWaktu,
      judul: formJudul.trim(),
      catatan: formCatatan.trim() ? formCatatan.trim() : null,
      tipe: formTipe,
    };
    try {
      if (formMode === 'create') {
        await createCatatanKalender(token, body);
      } else if (formId) {
        await updateCatatanKalender(token, formId, body);
      }
      closeForm();
      loadCatatan(() => false);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Gagal menyimpan catatan');
    } finally {
      setFormSaving(false);
    }
  }

  function confirmDelete() {
    if (!formId) return;
    Alert.alert('Hapus Catatan', 'Yakin ingin menghapus catatan kalender ini?', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Hapus', style: 'destructive', onPress: handleDelete },
    ]);
  }

  async function handleDelete() {
    if (!token || !formId) return;
    setFormSaving(true);
    try {
      await deleteCatatanKalender(token, formId);
      closeForm();
      loadCatatan(() => false);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Gagal menghapus catatan');
      setFormSaving(false);
    }
  }

  const header = (
    <View style={[styles.header, { paddingTop: insets.top }, scrolled && shadows.header]}>
      <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
        <MaterialIcons name="arrow-back" size={24} color={colors.onBackground} />
      </Pressable>
      <View style={styles.headerTitleWrap}>
        <Text style={styles.headerTitle}>Kalender Pribadi</Text>
        <Text style={styles.headerSubtitle}>Pengingat & jadwal Anda</Text>
      </View>
      <View style={styles.backButton} />
    </View>
  );

  if (!isDokter) {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.center}>
          <MaterialIcons name="event-busy" size={40} color={colors.outline} />
          <Text style={styles.emptyText}>
            {adminCatatan ?? 'Kalender pribadi cuma tersedia untuk akun dokter.'}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {header}

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: tabBarClearance + 72 }]}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={scrollEventThrottle}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
        }
      >
        <View style={styles.monthNav}>
          <Pressable onPress={() => goToMonth(-1)} hitSlop={8} style={styles.monthNavButton}>
            <MaterialIcons name="chevron-left" size={24} color={colors.primary} />
          </Pressable>
          <Text style={styles.monthLabel}>{formatMonthLabel(monthCursor)}</Text>
          <Pressable onPress={() => goToMonth(1)} hitSlop={8} style={styles.monthNavButton}>
            <MaterialIcons name="chevron-right" size={24} color={colors.primary} />
          </Pressable>
        </View>

        <View style={styles.calendarCard}>
          <View style={styles.weekdayRow}>
            {WEEKDAY_LABELS.map((label) => (
              <Text key={label} style={styles.weekdayLabel}>
                {label}
              </Text>
            ))}
          </View>

          {Array.from({ length: GRID_CELLS / 7 }).map((_, week) => (
            <View key={week} style={styles.gridRow}>
              {gridDates.slice(week * 7, week * 7 + 7).map((d) => {
                const key = toDateParam(d);
                const inMonth = d.getMonth() === monthCursor.getMonth();
                const isToday = isSameDay(d, today);
                const isSelected = isSameDay(d, selectedDate);
                const hasCatatan = catatanByDate.has(key);
                const hasJadwal = operasiByDate.has(key) || kunjunganByDate.has(key);
                return (
                  <Pressable key={key} onPress={() => setSelectedDate(d)} style={styles.dayCell}>
                    <View style={[styles.dayNumberWrap, isSelected && styles.dayNumberWrapSelected]}>
                      <Text
                        style={[
                          styles.dayNumber,
                          !inMonth && styles.dayNumberDim,
                          isToday && !isSelected && styles.dayNumberToday,
                          isSelected && styles.dayNumberSelected,
                        ]}
                      >
                        {d.getDate()}
                      </Text>
                    </View>
                    <View style={styles.dotRow}>
                      {hasCatatan && <View style={[styles.dot, { backgroundColor: colors.primary }]} />}
                      {hasJadwal && <View style={[styles.dot, { backgroundColor: colors.outline }]} />}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>

        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: colors.primary }]} />
            <Text style={styles.legendText}>Catatan saya</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: colors.outline }]} />
            <Text style={styles.legendText}>Jadwal Operasi/Konsultasi (read-only)</Text>
          </View>
        </View>

        <View style={styles.daySection}>
          <Text style={styles.daySectionTitle}>{formatSelectedDateLabel(selectedDate)}</Text>

          {catatanLoading ? (
            <Text style={styles.emptyText}>Memuat...</Text>
          ) : catatanError ? (
            <Text style={styles.errorText}>{catatanError}</Text>
          ) : (
            <View style={{ gap: spacing.base }}>
              {selectedOperasi.map((item) => (
                <View key={`operasi-${item.id}`} style={styles.readonlyCard}>
                  <MaterialIcons name="medical-services" size={18} color={colors.outline} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.readonlyTitle}>Operasi — {item.kunjungan.pasien.nama}</Text>
                    <Text style={styles.readonlyMeta}>
                      {formatJam(item.tanggalOperasi)} • {item.ruangan.nama}
                    </Text>
                  </View>
                </View>
              ))}
              {selectedKunjungan.map((item) => (
                <View key={`kunjungan-${item.id}`} style={styles.readonlyCard}>
                  <MaterialIcons name="person" size={18} color={colors.outline} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.readonlyTitle}>Konsultasi — {item.pasien.nama}</Text>
                    <Text style={styles.readonlyMeta}>
                      {formatJam(item.tanggalMasuk)} • {item.ruangan.nama}
                    </Text>
                  </View>
                </View>
              ))}

              {selectedCatatan.length === 0 && selectedOperasi.length === 0 && selectedKunjungan.length === 0 && (
                <Text style={styles.emptyText}>Tidak ada catatan atau jadwal di tanggal ini.</Text>
              )}

              {selectedCatatan.map((item) => {
                const meta = TIPE_META[item.tipe];
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => openEditForm(item)}
                    style={({ pressed }) => [styles.catatanCard, pressed && styles.catatanCardPressed]}
                  >
                    <View style={[styles.catatanIconCircle, { backgroundColor: `${meta.color}1A` }]}>
                      <MaterialIcons name={meta.icon} size={18} color={meta.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.catatanTitle}>{item.judul}</Text>
                      <Text style={styles.catatanMeta}>
                        {item.waktu ?? 'Sepanjang hari'} • {meta.label}
                      </Text>
                    </View>
                    <MaterialIcons name="chevron-right" size={20} color={colors.outline} />
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      <Pressable
        onPress={openCreateForm}
        style={[styles.fab, { bottom: tabBarClearance }]}
        hitSlop={4}
      >
        <MaterialIcons name="add" size={26} color={colors.onPrimary} />
      </Pressable>

      <Modal visible={formVisible} transparent animationType="fade" onRequestClose={closeForm}>
        <Pressable style={styles.filterBackdrop} onPress={closeForm} />
        <View style={styles.filterModalWrapper} pointerEvents="box-none">
          <ScrollView style={styles.formCard} contentContainerStyle={{ gap: ms(12) }}>
            <Text style={styles.filterCardTitle}>
              {formMode === 'create' ? 'Catatan Baru' : 'Ubah Catatan'}
            </Text>

            <View>
              <Text style={styles.fieldLabel}>Tanggal</Text>
              <Pressable style={styles.filterField} onPress={() => setShowTanggalPicker((v) => !v)}>
                <Text style={styles.filterFieldValue}>
                  {formTanggal.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                </Text>
                <MaterialIcons name="calendar-month" size={18} color={colors.primary} />
              </Pressable>
              {showTanggalPicker && (
                <View style={styles.pickerFullBleed}>
                  <DateTimePicker
                    value={formTanggal}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'inline' : 'default'}
                    themeVariant="light"
                    textColor={colors.onSurface}
                    accentColor={colors.primary}
                    onChange={onChangeTanggal}
                  />
                </View>
              )}
            </View>

            <View>
              <Text style={styles.fieldLabel}>Jam (opsional)</Text>
              <View style={styles.waktuRow}>
                <Pressable style={[styles.filterField, { flex: 1 }]} onPress={() => setShowWaktuPicker((v) => !v)}>
                  <Text style={styles.filterFieldValue}>{formWaktu ?? 'Sepanjang hari'}</Text>
                  <MaterialIcons name="schedule" size={18} color={colors.primary} />
                </Pressable>
                {formWaktu && (
                  <Pressable
                    onPress={() => {
                      setFormWaktu(null);
                      setShowWaktuPicker(false);
                    }}
                    hitSlop={8}
                    style={styles.clearWaktuButton}
                  >
                    <MaterialIcons name="close" size={16} color={colors.onSurfaceVariant} />
                  </Pressable>
                )}
              </View>
              {showWaktuPicker && (
                <View style={styles.pickerFullBleed}>
                  <DateTimePicker
                    value={timeStringToDate(formWaktu)}
                    mode="time"
                    is24Hour
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    themeVariant="light"
                    textColor={colors.onSurface}
                    accentColor={colors.primary}
                    onChange={onChangeWaktu}
                  />
                </View>
              )}
            </View>

            <View>
              <Text style={styles.fieldLabel}>Judul</Text>
              <TextInput
                value={formJudul}
                onChangeText={setFormJudul}
                placeholder="Mis. Follow-up pasien"
                placeholderTextColor={colors.outlineVariant}
                style={styles.textInput}
              />
            </View>

            <View>
              <Text style={styles.fieldLabel}>Catatan (opsional)</Text>
              <TextInput
                value={formCatatan}
                onChangeText={setFormCatatan}
                placeholder="Detail tambahan"
                placeholderTextColor={colors.outlineVariant}
                multiline
                style={[styles.textInput, styles.textInputMultiline]}
              />
            </View>

            <View>
              <Text style={styles.fieldLabel}>Tipe</Text>
              <View style={styles.tipeRow}>
                {(Object.keys(TIPE_META) as TipeCatatanKalender[]).map((tipe) => {
                  const meta = TIPE_META[tipe];
                  const active = formTipe === tipe;
                  return (
                    <Pressable
                      key={tipe}
                      onPress={() => setFormTipe(tipe)}
                      style={[styles.tipeChip, active && { backgroundColor: meta.color, borderColor: meta.color }]}
                    >
                      <MaterialIcons name={meta.icon} size={14} color={active ? colors.onPrimary : meta.color} />
                      <Text style={[styles.tipeChipText, active && { color: colors.onPrimary }]}>{meta.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {formError && <Text style={styles.filterError}>{formError}</Text>}

            <View style={styles.filterActions}>
              {formMode === 'edit' ? (
                <Pressable onPress={confirmDelete} disabled={formSaving} hitSlop={8} style={styles.deleteButton}>
                  <Text style={styles.deleteButtonText}>Hapus</Text>
                </Pressable>
              ) : (
                <Pressable onPress={closeForm} disabled={formSaving} hitSlop={8} style={styles.filterResetButton}>
                  <Text style={styles.filterResetText}>Batal</Text>
                </Pressable>
              )}
              <Pressable
                onPress={handleSave}
                disabled={formSaving}
                style={({ pressed }) => [
                  styles.filterApplyButton,
                  formSaving && styles.filterApplyButtonDisabled,
                  pressed && !formSaving && styles.filterApplyButtonPressed,
                ]}
              >
                <Text style={styles.filterApplyText}>{formSaving ? 'Menyimpan...' : 'Simpan'}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 12 },
  errorText: { color: colors.error, textAlign: 'center' },
  emptyText: { color: colors.onSurfaceVariant, textAlign: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing.marginMobile,
    paddingBottom: spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: `${colors.outlineVariant}1A`,
  },
  backButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitleWrap: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.onBackground },
  headerSubtitle: { fontSize: 12, color: colors.outline, marginTop: 2 },

  content: { padding: spacing.marginMobile, gap: spacing.gutter },

  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.gutter },
  monthNavButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  monthLabel: { fontSize: 16, fontWeight: '700', color: colors.onSurface, minWidth: 160, textAlign: 'center' },

  calendarCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.md,
    padding: spacing.base + 4,
    gap: 6,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
  },
  weekdayRow: { flexDirection: 'row' },
  weekdayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: colors.outline,
    textTransform: 'uppercase',
  },
  gridRow: { flexDirection: 'row' },
  dayCell: { flex: 1, alignItems: 'center', paddingVertical: 4, gap: 3 },
  dayNumberWrap: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  dayNumberWrapSelected: { backgroundColor: colors.primary },
  dayNumber: { fontSize: 13, fontWeight: '600', color: colors.onSurface },
  dayNumberDim: { color: colors.outlineVariant },
  dayNumberToday: { color: colors.primary, fontWeight: '800' },
  dayNumberSelected: { color: colors.onPrimary },
  dotRow: { flexDirection: 'row', gap: 3, height: 5 },
  dot: { width: 5, height: 5, borderRadius: 2.5 },

  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendText: { fontSize: 11, color: colors.onSurfaceVariant },

  daySection: { gap: spacing.base + 4 },
  daySectionTitle: { fontSize: 15, fontWeight: '700', color: colors.onSurface },

  readonlyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surfaceVariant,
    borderRadius: radius.sm,
    padding: 14,
  },
  readonlyTitle: { fontSize: 13, fontWeight: '700', color: colors.onSurfaceVariant },
  readonlyMeta: { fontSize: 12, color: colors.outline, marginTop: 2 },

  catatanCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.sm,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  catatanCardPressed: { opacity: 0.85 },
  catatanIconCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  catatanTitle: { fontSize: 14, fontWeight: '700', color: colors.onSurface },
  catatanMeta: { fontSize: 12, color: colors.outline, marginTop: 2 },

  fab: {
    position: 'absolute',
    right: spacing.marginMobile,
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },

  filterBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: `${colors.onBackground}80` },
  filterModalWrapper: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.marginMobile },
  formCard: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '85%',
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    padding: spacing.cardPadding,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  filterCardTitle: { fontSize: ms(16), fontWeight: '700', color: colors.onSurface },
  fieldLabel: { fontSize: ms(12), fontWeight: '600', color: colors.onSurfaceVariant, marginBottom: 6 },
  filterField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceVariant,
    borderRadius: radius.full,
    paddingHorizontal: ms(16),
    paddingVertical: ms(10),
  },
  filterFieldValue: { fontSize: ms(14), color: colors.onSurface, fontWeight: '600' },
  waktuRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  clearWaktuButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceVariant,
  },
  pickerFullBleed: { marginTop: 4 },
  textInput: {
    backgroundColor: colors.surfaceVariant,
    borderRadius: radius.sm,
    paddingHorizontal: ms(16),
    paddingVertical: ms(10),
    fontSize: ms(14),
    color: colors.onSurface,
  },
  textInputMultiline: { minHeight: 72, textAlignVertical: 'top' },
  tipeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tipeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainerLowest,
  },
  tipeChipText: { fontSize: 12, fontWeight: '600', color: colors.onSurface },
  filterError: { fontSize: ms(12), color: colors.error },
  filterActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  filterResetButton: { paddingVertical: ms(12), paddingHorizontal: ms(14), borderRadius: radius.full },
  filterResetText: { fontSize: ms(14), fontWeight: '600', color: colors.onSurfaceVariant },
  deleteButton: { paddingVertical: ms(12), paddingHorizontal: ms(14), borderRadius: radius.full },
  deleteButtonText: { fontSize: ms(14), fontWeight: '700', color: colors.error },
  filterApplyButton: {
    flex: 1,
    marginLeft: ms(12),
    alignItems: 'center',
    paddingVertical: ms(13),
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  filterApplyButtonPressed: { backgroundColor: colors.secondary },
  filterApplyButtonDisabled: { backgroundColor: colors.outlineVariant },
  filterApplyText: { fontSize: ms(14), fontWeight: '700', color: colors.onPrimary },
});
