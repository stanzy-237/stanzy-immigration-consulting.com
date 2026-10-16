export type SwatchSpec = { name: string; hex: string; fg: 'white' | 'ink' };

export const SWATCHES: readonly SwatchSpec[] = [
  { name: 'rouge', hex: '#CC1627', fg: 'white' },
  { name: 'crimson', hex: '#D93344', fg: 'white' },
  { name: 'rose', hex: '#EE8A93', fg: 'ink' },
  { name: 'blush', hex: '#FCEDEF', fg: 'ink' },
  { name: 'navy-deep', hex: '#0D1F4E', fg: 'white' },
  { name: 'navy-80', hex: '#1A3065', fg: 'white' },
  { name: 'steel-blue', hex: '#6B88B5', fg: 'white' },
  { name: 'ice-blue', hex: '#E8EDF5', fg: 'ink' },
  { name: 'off-white', hex: '#F7F8FC', fg: 'ink' },
  { name: 'fog', hex: '#CBD5E0', fg: 'ink' },
  { name: 'slate', hex: '#4A5568', fg: 'white' },
  { name: 'ink', hex: '#0D1F4E', fg: 'white' },
];
