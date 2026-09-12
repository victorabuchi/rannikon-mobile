import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';

import PageHeader from '../components/PageHeader';
import api from '../lib/api';
import { useAuth } from '../lib/auth';
import { useLanguage } from '../lib/i18n';
import { COLORS, FONTS } from '../lib/theme';

const ROLE_LABEL_KEY = {
  worker: 'profile.roleWorker',
  supervisor: 'profile.roleSupervisor',
  housemaster: 'profile.roleHousemaster',
  admin: 'profile.roleAdmin',
  payroll: 'profile.rolePayroll',
};

export default function ProfileScreen() {
  const { t } = useLanguage();
  const { worker, signOut, refreshWorker, signIn } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState('');

  const [editingEmail, setEditingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailSubmitting, setEmailSubmitting] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [emailSent, setEmailSent] = useState(false);

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

  const handleChangePhoto = async () => {
    setPhotoError('');
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setPhotoError(t('profile.photoPermissionNeeded'));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    const formData = new FormData();
    formData.append('file', {
      uri: asset.uri,
      name: asset.fileName || 'avatar.jpg',
      type: asset.mimeType || 'image/jpeg',
    });

    setUploadingPhoto(true);
    try {
      const { data } = await api.post('/api/auth/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await signIn(data.token, data.worker);
    } catch {
      setPhotoError(t('profile.photoUpdateFailed'));
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSendEmailChange = async () => {
    if (!newEmail.trim()) return;
    setEmailError('');
    setEmailSubmitting(true);
    try {
      await api.post('/api/auth/email/request-change', { new_email: newEmail.trim() });
      setEmailSent(true);
    } catch (err) {
      setEmailError(err.response?.data?.error || t('profile.emailChangeFailed'));
    } finally {
      setEmailSubmitting(false);
    }
  };

  const closeEmailEditor = () => {
    setEditingEmail(false);
    setNewEmail('');
    setEmailError('');
    setEmailSent(false);
  };

  if (!worker) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <PageHeader title={t('tabs.profile')} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={COLORS.primary}
        />
      }
    >
      <Pressable onPress={handleChangePhoto} disabled={uploadingPhoto} style={styles.avatarWrap}>
        <View style={styles.avatar}>
          {worker.avatar_url ? (
            <Image source={{ uri: worker.avatar_url }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarText}>
              {(worker.full_name || '?').charAt(0).toUpperCase()}
            </Text>
          )}
          {uploadingPhoto && (
            <View style={styles.avatarOverlay}>
              <ActivityIndicator color={COLORS.white} size="small" />
            </View>
          )}
        </View>
        <Text style={styles.changePhotoText}>
          {uploadingPhoto ? t('profile.uploadingPhoto') : t('profile.changePhoto')}
        </Text>
      </Pressable>
      {!!photoError && <Text style={styles.error}>{photoError}</Text>}

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
        {editingEmail ? (
          <View style={styles.emailEditor}>
            {emailSent ? (
              <Text style={styles.emailSentText}>{t('profile.emailChangeSent')}</Text>
            ) : (
              <>
                <TextInput
                  style={styles.emailInput}
                  value={newEmail}
                  onChangeText={setNewEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  placeholder={t('profile.newEmail')}
                  placeholderTextColor={COLORS.textMuted}
                />
                {!!emailError && <Text style={styles.error}>{emailError}</Text>}
                <View style={styles.emailActions}>
                  <Pressable onPress={closeEmailEditor} style={styles.emailCancelBtn}>
                    <Text style={styles.emailCancelText}>{t('profile.cancel')}</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleSendEmailChange}
                    disabled={emailSubmitting}
                    style={[styles.emailSendBtn, emailSubmitting && styles.buttonDisabled]}
                  >
                    <Text style={styles.emailSendText}>
                      {emailSubmitting ? t('profile.sendingConfirmation') : t('profile.sendConfirmation')}
                    </Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        ) : (
          <Pressable style={styles.row} onPress={() => setEditingEmail(true)}>
            <Text style={styles.label}>{t('profile.email')}</Text>
            <Text style={styles.value}>{worker.email}</Text>
          </Pressable>
        )}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scroll: {
    flex: 1,
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
  avatarWrap: {
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 4,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  changePhotoText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.primary,
    marginTop: 8,
  },
  error: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.error,
    textAlign: 'center',
    marginTop: 4,
  },
  emailEditor: {
    paddingVertical: 14,
  },
  emailInput: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: COLORS.background,
  },
  emailSentText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.primary,
    lineHeight: 18,
  },
  emailActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
    gap: 12,
  },
  emailCancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  emailCancelText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.textMuted,
  },
  emailSendBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  emailSendText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.white,
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
