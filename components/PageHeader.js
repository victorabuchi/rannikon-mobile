import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import LanguageSelector from './LanguageSelector';
import PagesMenu from './PagesMenu';
import { useAuth } from '../lib/auth';
import { useLanguage } from '../lib/i18n';
import { COLORS, FONTS } from '../lib/theme';

// Shared top bar replacing the old bottom tab navigator, matching web's
// per-page header: a title, an admin-only "All pages" dropdown, a
// "My timesheet" back-link for other secondary-role pages, a profile
// shortcut (mobile-only - web has no profile page), a language switcher
// and sign out - all in one row like every web page has.
export default function PageHeader({ title, showMyTimesheet = false, showArchiveLink = false }) {
  const router = useRouter();
  const { worker, signOut } = useAuth();
  const { t } = useLanguage();
  const role = worker?.role;

  return (
    <View style={styles.container}>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.actions}>
        <PagesMenu role={role} />
        {showMyTimesheet && role !== 'admin' && (
          <Pressable
            style={({ pressed }) => [styles.outlineButton, pressed && styles.outlineButtonPressed]}
            onPress={() => router.push('/days')}
          >
            <Text style={styles.outlineButtonText}>{t('nav.myTimesheet')}</Text>
          </Pressable>
        )}
        {showArchiveLink && (
          <Pressable
            style={({ pressed }) => [styles.archiveButton, pressed && styles.archiveButtonPressed]}
            onPress={() => router.push('/archive')}
          >
            <Text style={styles.archiveButtonText}>{t('nav.archive')}</Text>
          </Pressable>
        )}
        <Pressable
          style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
          onPress={() => router.push('/profile')}
          hitSlop={6}
        >
          <Ionicons name="person-circle-outline" size={22} color={COLORS.text} />
        </Pressable>
        <LanguageSelector />
        <Pressable
          style={({ pressed }) => [styles.signOutButton, pressed && styles.signOutButtonPressed]}
          onPress={signOut}
        >
          <Text style={styles.signOutButtonText}>{t('nav.signOut')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 17,
    color: COLORS.text,
    flexShrink: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  outlineButton: {
    borderWidth: 1,
    borderColor: '#dddddd',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  outlineButtonPressed: {
    backgroundColor: COLORS.surface,
  },
  outlineButtonText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: '#333333',
  },
  archiveButton: {
    borderWidth: 1,
    borderColor: '#0277bd',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  archiveButtonPressed: {
    backgroundColor: '#e3f2fd',
  },
  archiveButtonText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: '#0277bd',
  },
  iconButton: {
    padding: 4,
  },
  iconButtonPressed: {
    opacity: 0.6,
  },
  signOutButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  signOutButtonPressed: {
    backgroundColor: COLORS.primaryDark,
  },
  signOutButtonText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.white,
  },
});
