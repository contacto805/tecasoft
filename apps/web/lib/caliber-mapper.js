// Mapping between old system (uppercase codes) and new caliber names
export const CALIBER_NAMES = {
  'Super (40\'s)': 'SUPER',
  'Extra (48\'s)': 'EXTRA',
  'Primera (60\'s)': 'PRIMERA',
  'Mediano (70\'s)': 'MEDIANO',
  'Tercera (84\'s)': 'TERCERA',
  'Cuarta': 'CUARTA'
};

export const REVERSE_CALIBER_NAMES = {
  'SUPER': 'Super (40\'s)',
  'EXTRA': 'Extra (48\'s)',
  'PRIMERA': 'Primera (60\'s)',
  'MEDIANO': 'Mediano (70\'s)',
  'TERCERA': 'Tercera (84\'s)',
  'CUARTA': 'Cuarta'
};

export const CALIBERS_10KG = [
  'Super (40\'s)',
  'Extra (48\'s)',
  'Primera (60\'s)',
  'Mediano (70\'s)',
  'Tercera (84\'s)',
  'Cuarta'
];

export const CALIBERS_6KG = [
  'Extra (48\'s)',
  'Primera (60\'s)',
  'Mediano (70\'s)',
  'Tercera (84\'s)'
];

export const QUALITY_OPTIONS = [
  'Calidad A',
  'Calidad B',
  'Calidad C',
  'Proceso',
  'Desecho'
];

// Convert between formats
export const toNewFormat = (oldCode) => {
  return REVERSE_CALIBER_NAMES[oldCode] || oldCode;
};

export const toOldFormat = (newName) => {
  return CALIBER_NAMES[newName] || newName;
};
