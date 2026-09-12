import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useLanguage } from '../lib/i18n';
import { COLORS, FONTS } from '../lib/theme';

const VIEWS = [
  { key: 'days', path: '/days', labelKey: 'dashboardNav.daysTab' },
  { key: 'papers', path: '/papers', labelKey: 'dashboardNav.papersTab' },
  { key: 'requests', path: '/requests', labelKey: 'dashboardNav.requestsTab' },
];

// Mirrors the Days / Papers / Requests toggle row on web's dashboard.js -
// mobile keeps these as separate routes (pre-existing split), so this just
// switches between them instead of swapping client-side view state.
export default function DashboardViewSwitcher({ active, showRequests = false }) {
  const router = useRouter();
  const { t } = useLanguage();
  const views = showRequests ? VIEWS : VIEWS.filter((v) => v.key !== 'requests');

  return (
    <View style={styles.row}>
      {views.map((v) => (
        <Pressable
          key={v.key}
          style={[styles.button, active === v.key && styles.buttonActive]}
          onPress={() => {
            if (active !== v.key) router.replace(v.path);
          }}
        >
          <Text style={[styles.buttonText, active === v.key && styles.buttonTextActive]}>
            {t(v.labelKey)}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  button: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cccccc',
    backgroundColor: COLORS.background,
  },
  buttonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  buttonText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: '#333333',
  },
  buttonTextActive: {
    color: COLORS.white,
  },
});
