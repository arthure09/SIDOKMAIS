import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { login } from '../api/auth';
import { ApiError } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { colors } from '../theme/colors';
import { Text } from '../components/Text';
import { TextInput } from '../components/TextInput';

export function LoginScreen() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [focusedField, setFocusedField] = useState<'username' | 'password' | null>(null);

  const drift1 = useRef(new Animated.Value(0)).current;
  const drift2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const makeLoop = (value: Animated.Value, duration: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(value, {
            toValue: 1,
            duration,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      );

    const loop1 = makeLoop(drift1, 9000);
    const loop2 = makeLoop(drift2, 12000);
    loop1.start();
    loop2.start();

    return () => {
      loop1.stop();
      loop2.stop();
    };
  }, [drift1, drift2]);

  const glow1Transform = {
    transform: [
      { translateX: drift1.interpolate({ inputRange: [0, 1], outputRange: [-24, 24] }) },
      { translateY: drift1.interpolate({ inputRange: [0, 1], outputRange: [-16, 20] }) },
      { scale: drift1.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) },
    ],
  };

  const glow2Transform = {
    transform: [
      { translateX: drift2.interpolate({ inputRange: [0, 1], outputRange: [18, -22] }) },
      { translateY: drift2.interpolate({ inputRange: [0, 1], outputRange: [16, -18] }) },
      { scale: drift2.interpolate({ inputRange: [0, 1], outputRange: [1.1, 1] }) },
    ],
  };

  async function handleLogin() {
    setError(null);
    setLoading(true);
    try {
      const result = await login(username.trim(), password);
      setAuth(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal terhubung ke server');
    } finally {
      setLoading(false);
    }
  }

  return (
    <LinearGradient
      colors={[colors.primaryContainer, colors.tertiaryFixedDim]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradient}
    >
      <Animated.View
        style={[styles.glow, styles.glowTopLeft, glow1Transform]}
        pointerEvents="none"
      />
      <Animated.View
        style={[styles.glow, styles.glowBottomRight, glow2Transform]}
        pointerEvents="none"
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            <View style={styles.header}>
              <Image
                source={require('../../assets/Logo sidokmais.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>

            <View style={styles.form}>
              <View style={styles.field}>
                <Text style={styles.label}>Username</Text>
                <View
                  style={[
                    styles.inputWrapper,
                    focusedField === 'username' && styles.inputWrapperFocused,
                  ]}
                >
                  <MaterialIcons
                    name="person"
                    size={20}
                    color={focusedField === 'username' ? colors.primary : colors.outline}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    value={username}
                    onChangeText={setUsername}
                    onFocus={() => setFocusedField('username')}
                    onBlur={() => setFocusedField(null)}
                    placeholder="Masukkan ID atau Email"
                    placeholderTextColor={colors.outlineVariant}
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={styles.input}
                  />
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Password</Text>
                <View
                  style={[
                    styles.inputWrapper,
                    focusedField === 'password' && styles.inputWrapperFocused,
                  ]}
                >
                  <MaterialIcons
                    name="lock"
                    size={20}
                    color={focusedField === 'password' ? colors.primary : colors.outline}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                    placeholder="Masukkan Password"
                    placeholderTextColor={colors.outlineVariant}
                    secureTextEntry={!showPassword}
                    style={styles.input}
                  />
                  <Pressable
                    onPress={() => setShowPassword((v) => !v)}
                    hitSlop={8}
                    style={styles.inputIconRightButton}
                  >
                    <MaterialIcons
                      name={showPassword ? 'visibility' : 'visibility-off'}
                      size={20}
                      color={colors.outline}
                    />
                  </Pressable>
                </View>
              </View>

              <View style={styles.optionsRow}>
                <Pressable style={styles.rememberMe} onPress={() => setRememberMe((v) => !v)}>
                  <MaterialIcons
                    name={rememberMe ? 'check-box' : 'check-box-outline-blank'}
                    size={18}
                    color={rememberMe ? colors.primary : colors.outline}
                  />
                  <Text style={styles.rememberMeText}>Ingat Saya</Text>
                </Pressable>
              </View>

              {error ? (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <Pressable
                onPress={handleLogin}
                disabled={loading || !username || !password}
                style={({ pressed }) => [
                  styles.submitButton,
                  (loading || !username || !password) && styles.submitButtonDisabled,
                  pressed && styles.submitButtonPressed,
                ]}
              >
                <Text style={styles.submitButtonText}>{loading ? 'MEMPROSES...' : 'MASUK'}</Text>
                {!loading && (
                  <MaterialIcons name="arrow-forward" size={18} color={colors.onPrimary} />
                )}
              </Pressable>
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Versi 1.0.0</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gradient: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  glow: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
  },
  glowTopLeft: {
    top: -100,
    left: -100,
    backgroundColor: colors.surfaceBright,
    opacity: 0.35,
  },
  glowBottomRight: {
    bottom: -100,
    right: -100,
    backgroundColor: colors.primary,
    opacity: 0.18,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 32,
    padding: 24,
    gap: 24,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  header: {
    alignItems: 'center',
    marginTop: 8,
  },
  logoImage: {
    width: 360,
    height: 123,
    marginBottom: 8,
  },
  form: {
    gap: 16,
  },
  field: {
    gap: 8,
  },
  label: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: colors.onSurface,
    paddingHorizontal: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSoft,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: 'transparent',
    paddingHorizontal: 16,
  },
  inputWrapperFocused: {
    borderColor: colors.primary,
  },
  inputIcon: {
    marginRight: 12,
  },
  inputIconRightButton: {
    marginLeft: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '300',
    color: colors.onSurface,
    paddingVertical: 14,
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    marginTop: -4,
  },
  rememberMe: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rememberMeText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '300',
    color: colors.onSurfaceVariant,
  },
  errorBanner: {
    backgroundColor: colors.errorContainer,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  errorText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.onErrorContainer,
  },
  submitButton: {
    marginTop: 4,
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 4,
  },
  submitButtonPressed: {
    backgroundColor: colors.onPrimaryContainer,
    transform: [{ scale: 0.98 }],
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    letterSpacing: 1,
    color: colors.onPrimary,
    textTransform: 'uppercase',
  },
  footer: {
    marginTop: 8,
    paddingTop: 20,
    paddingBottom: 4,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceVariant,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '300',
    color: colors.outline,
  },
});
