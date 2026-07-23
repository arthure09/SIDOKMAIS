import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius } from '../theme/colors';
import { useTabBarStore } from '../store/tabBarStore';
import { TAB_BAR_FLOAT_GAP, TAB_BAR_FLOAT_SIDE_MARGIN, TAB_BAR_HEIGHT } from './tabBarMetrics';
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
  OperasiTab: 'Operasi',
  NotifikasiTab: 'Notifikasi',
  ProfilTab: 'Profil',
};

const INDICATOR_INSET = 9;
const RIPPLE_SIZE = 78;
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
  const ripple = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    ripple.setValue(0);
    Animated.timing(ripple, { toValue: 1, duration: 380, useNativeDriver: true }).start(() => {
      ripple.setValue(0);
    });
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.88, duration: 70, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 4, tension: 80 }),
    ]).start();
    onPress();
  };

  const rippleScale = ripple.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1.8] });
  const rippleOpacity = ripple.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.28, 0.14, 0] });
  const color = isFocused ? colors.primary : colors.outline;

  return (
    <Pressable onPress={handlePress} style={[styles.tabButton, { width: itemWidth }]} hitSlop={8}>
      <View style={styles.rippleContainer} pointerEvents="none">
        <Animated.View
          style={[
            styles.ripple,
            {
              backgroundColor: colors.primaryContainer,
              opacity: rippleOpacity,
              transform: [{ scale: rippleScale }],
            },
          ]}
        />
      </View>
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
  const [barWidth, setBarWidth] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;
  const dockAnim = useRef(new Animated.Value(0)).current;
  const docked = useTabBarStore((s) => s.docked);
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

  // Ganti tab lain = layar baru, mulai lagi dari floating.
  useEffect(() => {
    useTabBarStore.getState().setDocked(false);
  }, [state.index]);

  useEffect(() => {
    Animated.timing(dockAnim, {
      toValue: docked ? 1 : 0,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [docked, dockAnim]);

  const onLayout = (e: LayoutChangeEvent) => setBarWidth(e.nativeEvent.layout.width);

  const animatedSide = dockAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [TAB_BAR_FLOAT_SIDE_MARGIN, 0],
  });
  const animatedBottom = dockAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [insets.bottom + TAB_BAR_FLOAT_GAP, insets.bottom],
  });
  const animatedBottomRadius = dockAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [radius.lg, 0],
  });

  return (
    <Animated.View
      style={[styles.wrapper, { left: animatedSide, right: animatedSide, bottom: animatedBottom }]}
      pointerEvents="box-none"
    >
      <Animated.View
        style={[
          styles.bar,
          {
            borderBottomLeftRadius: animatedBottomRadius,
            borderBottomRightRadius: animatedBottomRadius,
          },
        ]}
        onLayout={onLayout}
      >
        <BlurView intensity={55} tint="light" style={StyleSheet.absoluteFillObject} />
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
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    alignItems: 'center',
  },
  bar: {
    flexDirection: 'row',
    width: '100%',
    height: TAB_BAR_HEIGHT,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    elevation: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    overflow: 'hidden',
  },
  indicator: {
    position: 'absolute',
    top: INDICATOR_INSET,
    bottom: INDICATOR_INSET,
    left: 0,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  tabButton: {
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rippleContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  ripple: {
    width: RIPPLE_SIZE,
    height: RIPPLE_SIZE,
    borderRadius: RIPPLE_SIZE / 2,
  },
  label: {
    marginTop: 3,
    fontSize: 13,
    fontWeight: '600',
  },
});
