import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors } from '../theme/colors';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Welcome'>;

const ZOOM_FROM = 1.6;
const ZOOM_DURATION = 900;
const HOLD_BEFORE_NAVIGATE = 600;
const LOGO_ASPECT_RATIO = 1920 / 1080;

export function WelcomeScreen({ navigation }: Props) {
  const { width: windowWidth } = useWindowDimensions();
  const logoWidth = Math.min(windowWidth * 1.0, 15500);
  const scale = useRef(new Animated.Value(ZOOM_FROM)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 500,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: ZOOM_DURATION,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);

    animation.start();
    const timer = setTimeout(() => {
      navigation.replace('Login');
    }, ZOOM_DURATION + HOLD_BEFORE_NAVIGATE);

    return () => {
      animation.stop();
      clearTimeout(timer);
    };
  }, [navigation, opacity, scale]);

  return (
    <View style={styles.background}>
      <Animated.Image
        source={require('../../assets/logo dharmais + sidokmais(2)(1).png')}
        style={[
          {
            width: logoWidth,
            height: logoWidth / LOGO_ASPECT_RATIO,
            opacity,
            transform: [{ scale }],
          },
        ]}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundWhite,
  },
});
