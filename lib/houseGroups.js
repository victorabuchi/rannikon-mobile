export const HOUSE_GROUPS = [
  'Kivilinna/Salo',
  'Karton Cambodia',
  'Karton International',
  'Vassila',
  'Suppala',
  'Salo/Turku',
];

export const GROUP_COLORS = {
  'Kivilinna/Salo': { bg: '#e8f5e9', text: '#1b5e20', border: '#a5d6a7' },
  'Karton Cambodia': { bg: '#e3f2fd', text: '#0d47a1', border: '#90caf9' },
  'Karton International': { bg: '#fff3e0', text: '#e65100', border: '#ffcc80' },
  Vassila: { bg: '#fce4ec', text: '#880e4f', border: '#f48fb1' },
  Suppala: { bg: '#f3e5f5', text: '#4a148c', border: '#ce93d8' },
  'Salo/Turku': { bg: '#e0f7fa', text: '#006064', border: '#80deea' },
  Unknown: { bg: '#f5f5f5', text: '#555555', border: '#cccccc' },
};

export function getHouseGroup(workNumber) {
  const n = parseInt(workNumber, 10);
  if (n >= 100 && n <= 199) return 'Kivilinna/Salo';
  if (n >= 200 && n <= 299) return 'Karton Cambodia';
  if (n >= 300 && n <= 399) return 'Karton International';
  if (n >= 400 && n <= 499) return 'Vassila';
  if (n >= 500 && n <= 599) return 'Suppala';
  if (n >= 600) return 'Salo/Turku';
  return 'Unknown';
}
