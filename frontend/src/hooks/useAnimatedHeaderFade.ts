import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { colors } from '../theme/colors';

// Animasi transisi header dari transparan/background ke putih + shadow saat konten discroll dari posisi
// paling atas; dipasang ke Animated.View header fixed di atas ScrollView/FlatList.
export function useAnimatedHeaderFade(scrolled: boolean) {
  const headerFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(headerFade, {
      toValue: scrolled ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [scrolled, headerFade]);

  const headerBackgroundColor = headerFade.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.background, colors.backgroundWhite],
  });
  const headerShadowOpacity = headerFade.interpolate({ inputRange: [0, 1], outputRange: [0, 0.1] });
  const headerElevation = headerFade.interpolate({ inputRange: [0, 1], outputRange: [0, 4] });

  return { headerBackgroundColor, headerShadowOpacity, headerElevation };
}
