import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAuth } from '../../lib/auth';
import { useLanguage } from '../../lib/i18n';
import { COLORS, FONTS } from '../../lib/theme';

const ROLE_LABEL_KEY = {
  worker: 'profile.roleWorker',
  supervisor: 'profile.roleSupervisor',
  housemaster: 'profile.roleHousemaster',
  admin: 'profile.roleAdmin',
};

export default function ProfileScreen() {
  const { t } = useLanguage();
  const { worker, signOut, refreshWorker } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshWorker();
    } finally {
      setRefreshing(false);
    }
  }, [refreshWorker]);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  };

  if (!worker) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={COLORS.primary}
        />
      }
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {(worker.full_name || '?').charAt(0).toUpperCase()}
        </Text>
      </View>

      <Text style={styles.name}>{worker.full_name}</Text>
      {!!worker.role && (
        <Text style={styles.role}>{t(ROLE_LABEL_KEY[worker.role] || ROLE_LABEL_KEY.worker)}</Text>
      )}

      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.label}>{t('profile.workNumber')}</Text>
          <Text style={styles.value}>{worker.work_number}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={styles.label}>{t('profile.email')}</Text>
          <Text style={styles.value}>{worker.email}</Text>
        </View>
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.signOutButton,
          pressed && styles.signOutButtonPressed,
          signingOut && styles.buttonDisabled,
        ]}
        onPress={handleSignOut}
        disabled={signingOut}
      >
        <Text style={styles.signOutButtonText}>
          {signingOut ? t('profile.signingOut') : t('profile.signOut')}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 24,
    alignItems: 'center',
  },
  centered: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    marginBottom: 12,
  },
  avatarText: {
    fontFamily: FONTS.bold,
    fontSize: 28,
    color: COLORS.white,
  },
  name: {
    fontFamily: FONTS.bold,
    fontSize: 20,
    color: COLORS.text,
  },
  role: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: COLORS.primary,
    marginTop: 4,
  },
  card: {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 24,
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
  },
  label: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textMuted,
  },
  value: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: COLORS.text,
  },
  signOutButton: {
    width: '100%',
    borderWidth: 1,
    borderColor: COLORS.error,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 32,
  },
  signOutButtonPressed: {
    backgroundColor: COLORS.surface,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  signOutButtonText: {
    fontFamily: FONTS.medium,
    fontSize: 16,
    color: COLORS.error,
  },
});
