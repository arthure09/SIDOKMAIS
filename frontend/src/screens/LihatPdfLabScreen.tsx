import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Asset } from 'expo-asset';
import { WebView } from 'react-native-webview';
import { colors, spacing } from '../theme/colors';
import { Text } from '../components/Text';
import type { PasienStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<PasienStackParamList, 'LihatPdfLab'>;

// Dummy murni (docs/dummy.pdf) — belum ada dokumen PDF asli per pemeriksaan
// dari SIMRS, jadi setiap laporan di list Hasil Lab menunjuk ke file yang
// sama ini. Lihat catatan di HasilLabListScreen.
const DUMMY_PDF_ASSET = require('../../assets/dummy.pdf');

export function LihatPdfLabScreen({ route, navigation }: Props) {
  const { namaLaporan, tanggal } = route.params;
  const insets = useSafeAreaInsets();
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const asset = Asset.fromModule(DUMMY_PDF_ASSET);
        await asset.downloadAsync();
        if (!cancelled) setLocalUri(asset.localUri ?? asset.uri);
      } catch {
        if (!cancelled) setError('Gagal memuat berkas PDF');
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={colors.onBackground} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {namaLaporan}
          </Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {tanggal}
          </Text>
        </View>
      </View>

      {error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : !localUri ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <WebView
          source={{ uri: localUri }}
          style={styles.webview}
          originWhitelist={['*']}
          renderLoading={() => (
            <View style={styles.center}>
              <ActivityIndicator color={colors.primary} />
            </View>
          )}
          startInLoadingState
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: { color: colors.error, textAlign: 'center' },
  webview: { flex: 1, backgroundColor: colors.background },

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
  headerTitle: { fontSize: 16, fontWeight: '600', color: colors.onBackground },
  headerSubtitle: { fontSize: 12, color: colors.onSurfaceVariant, marginTop: 2 },
});
