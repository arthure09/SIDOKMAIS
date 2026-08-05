import { Dimensions } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const BASE_WIDTH = 375;

function scale(size: number): number {
  return (SCREEN_WIDTH / BASE_WIDTH) * size;
}

export function moderateScale(size: number, factor = 0.5): number {
  return size + (scale(size) - size) * factor;
}

export const ms = moderateScale;
