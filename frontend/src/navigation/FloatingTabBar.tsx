import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius } from '../theme/colors';
import { useTabBarStore } from '../store/tabBarStore';
import { TAB_BAR_HEIGHT } from './tabBarMetrics';
import type { MainTabParamList } from './types';

const TAB_ICON: Record<keyof MainTabParamList, React.ComponentProps<typeof MaterialIcons>['name']> = {
  HomeTab: 'home',
  PasienTab: 'person-search',
  OperasiTab: 'medical-services',
  NotifikasiTab: 'notifications',
  ProfilTab: 'account-circle',
};

const TAB_LABEL: Record<keyof MainTabParamList, string> = {
  HomeTab: 'Home',
  PasienTab: 'Pasien',
  OperasiTab: 'Jadwal',
  NotifikasiTab: 'Notifikasi',
  ProfilTab: 'Profil',
};

const INDICATOR_INSET = 9;
const ICON_SIZE = 33;

function TabButton({
  routeName,
  isFocused,
  itemWidth,
  onPress,
}: {
  routeName: keyof MainTabParamList;
  isFocused: boolean;
  itemWidth: number;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.88, duration: 70, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 4, tension: 80 }),
    ]).start();
    onPress();
  };

  const color = isFocused ? colors.primary : colors.outline;

  return (
    <Pressable onPress={handlePress} style={[styles.tabButton, { width: itemWidth }]} hitSlop={8}>
      <Animated.View style={{ alignItems: 'center', transform: [{ scale }] }}>
        <MaterialIcons name={TAB_ICON[routeName]} size={ICON_SIZE} color={color} />
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          style={[styles.label, { color }]}
        >
          {TAB_LABEL[routeName]}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

export function FloatingTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const hidden = useTabBarStore((s) => s.hidden);
  const [barWidth, setBarWidth] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;
  // Screen full-bleed (mis. LihatPdfLabScreen) minta tab bar disembunyikan
  // total lewat useHideTabBar — di sini digeser turun keluar layar, bukan
  // instan hilang, supaya transisinya kelihatan sebagai slide-down.
  const translateY = useRef(new Animated.Value(0)).current;
  const itemWidth = barWidth / state.routes.length;
  const indicatorWidth = Math.max(itemWidth - INDICATOR_INSET * 2, 0);

  useEffect(() => {
    if (!itemWidth) return;
    Animated.spring(translateX, {
      toValue: state.index * itemWidth + INDICATOR_INSET,
      useNativeDriver: true,
      friction: 8,
      tension: 60,
    }).start();
  }, [state.index, itemWidth, translateX]);

  useEffect(() => {
    Animated.timing(translateY, {
      // +24 ekstra biar shadow (shadowRadius 12, shadowOffset -4) ikut nggak
      // kelihatan sisa nyembul pas tab bar disembunyikan.
      toValue: hidden ? TAB_BAR_HEIGHT + insets.bottom + 24 : 0,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [hidden, insets.bottom, translateY]);

  const onLayout = (e: LayoutChangeEvent) => setBarWidth(e.nativeEvent.layout.width);

  return (
    <Animated.View
      style={[styles.wrapper, { transform: [{ translateY }] }]}
      pointerEvents={hidden ? 'none' : 'box-none'}
    >
      <View style={[styles.surface, { paddingBottom: insets.bottom }]}>
        <View style={styles.bar} onLayout={onLayout}>
          {barWidth > 0 && (
            <Animated.View
              style={[styles.indicator, { width: indicatorWidth, transform: [{ translateX }] }]}
            />
          )}
          {state.routes.map((route, index) => {
            const isFocused = state.index === index;
            const onPress = () => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            };
            return (
              <TabButton
                key={route.key}
                routeName={route.name as keyof MainTabParamList}
                isFocused={isFocused}
                itemWidth={itemWidth || 1}
                onPress={onPress}
              />
            );
          })}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  surface: {
    backgroundColor: colors.surfaceContainerLowest,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    elevation: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
  },
  bar: {
    flexDirection: 'row',
    width: '100%',
    height: TAB_BAR_HEIGHT,
  },
  indicator: {
    position: 'absolute',
    top: INDICATOR_INSET,
    bottom: INDICATOR_INSET,
    left: 0,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceSoft,
  },
  tabButton: {
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    marginTop: 3,
    fontSize: 13,
    fontWeight: '600',
  },
});
