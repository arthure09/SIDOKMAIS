export const colors = {
  primary: '#006a65',
  onPrimary: '#ffffff',
  primaryContainer: '#27b4ac',
  onPrimaryContainer: '#00403d',
  secondary: '#20686e',
  onSecondary: '#ffffff',
  tertiaryFixed: '#e4eb41',
  onTertiaryFixed: '#1c1d00',
  tertiaryFixedDim: '#c8ce22',
  background: '#effbff',
  onBackground: '#011f25',
  backgroundWhite: '#ffffff',
  surfaceBright: '#effbff',
  surfaceSoft: '#EAF6F5',
  surfaceContainerLowest: '#ffffff',
  surfaceContainer: '#d6f3fb',
  surfaceContainerHigh: '#d0edf5',
  surfaceVariant: '#cae8ef',
  onSurface: '#011f25',
  onSurfaceVariant: '#3c4948',
  outline: '#6c7a78',
  outlineVariant: '#bbc9c7',
  error: '#ba1a1a',
  errorContainer: '#ffdad6',
  onErrorContainer: '#93000a',
  deepTealDark: '#0D3D3B',
  tertiaryContainer: '#a3a900',
  onTertiaryContainer: '#393b00',
  tertiary: '#5f6200',
};

export const spacing = {
  base: 8,
  marginMobile: 20,
  gutter: 16,
  cardPadding: 24,
};

export const radius = {
  sm: 16,
  lg: 32,
  xl: 48,
  full: 999,
};

export const shadows = {
  // Dipasang kondisional (`scrolled && shadows.header`) ke View header fixed
  // di atas ScrollView/FlatList, biar header keliatan "terangkat" begitu
  // konten discroll dari posisi paling atas.
  header: {
    backgroundColor: colors.background,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
};
