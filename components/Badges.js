import { StyleSheet, Text, View } from 'react-native';

import { GROUP_COLORS } from '../lib/houseGroups';
import { useLanguage } from '../lib/i18n';
import { COLORS, FONTS } from '../lib/theme';

export function GroupPill({ group, style }) {
  const c = GROUP_COLORS[group];
  if (!c) {
    return <Text style={styles.unknownText}>{group || '—'}</Text>;
  }
  return (
    <View style={[styles.pill, { backgroundColor: c.bg, borderColor: c.border }, style]}>
      <Text style={[styles.pillText, { color: c.text }]} numberOfLines={1}>
        {group}
      </Text>
    </View>
  );
}

const ROLE_STYLE = {
  worker: { bg: '#f5f5f5', text: '#555555', border: '#dddddd' },
  supervisor: { bg: '#e3f2fd', text: '#1565c0', border: '#90caf9' },
  housemaster: { bg: '#f3e5f5', text: '#7b1fa2', border: '#ce93d8' },
  admin: { bg: '#e8f5e9', text: '#2d6a2d', border: '#a5d6a7' },
};

const ROLE_LABEL_KEY = {
  worker: 'admin.roleWorker',
  supervisor: 'admin.roleSupervisor',
  housemaster: 'admin.roleHousemaster',
  admin: 'admin.roleAdmin',
};

export function RoleBadge({ role }) {
  const { t } = useLanguage();
  const s = ROLE_STYLE[role] || ROLE_STYLE.worker;
  return (
    <View style={[styles.pill, { backgroundColor: s.bg, borderColor: s.border }]}>
      <Text style={[styles.pillText, { color: s.text }]} numberOfLines={1}>
        {t(ROLE_LABEL_KEY[role] || ROLE_LABEL_KEY.worker)}
      </Text>
    </View>
  );
}

export function StatCard({ label, value, accent }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, accent && { color: accent }]}>
        {value ?? '—'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  pillText: {
    fontFamily: FONTS.bold,
    fontSize: 11,
  },
  unknownText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#888888',
  },
  statCard: {
    flexGrow: 1,
    minWidth: 100,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  statLabel: {
    fontFamily: FONTS.bold,
    fontSize: 10,
    color: '#888888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  statValue: {
    fontFamily: FONTS.bold,
    fontSize: 24,
    color: COLORS.text,
  },
});
