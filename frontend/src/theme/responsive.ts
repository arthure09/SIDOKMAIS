import { Dimensions, PixelRatio } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const BASE_WIDTH = 375;
const BASE_HEIGHT = 812;

export function scale(size: number): number {
  return (SCREEN_WIDTH / BASE_WIDTH) * size;
}

export function verticalScale(size: number): number {
  return (SCREEN_HEIGHT / BASE_HEIGHT) * size;
}

export function moderateScale(size: number, factor = 0.5): number {
  return size + (scale(size) - size) * factor;
}

export function wp(percent: number): number {
  return PixelRatio.roundToNearestPixel((percent / 100) * SCREEN_WIDTH);
}

export function hp(percent: number): number {
  return PixelRatio.roundToNearestPixel((percent / 100) * SCREEN_HEIGHT);
}

export const ms = moderateScale;
