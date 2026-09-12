import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Link } from 'expo-router';

import api from '../lib/api';
import { useLanguage } from '../lib/i18n';
import { COLORS, FONTS } from '../lib/theme';

export default function ForgotPasswordScreen() {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim()) return;
    setError('');
    setSubmitting(true);
    try {
      await api.post('/api/auth/forgot-password', { email: email.trim() });
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.error || t('auth.forgotEmailFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>{t('auth.resetYourPassword')}</Text>

        {sent ? (
          <>
            <Text style={styles.hint}>
              {t('auth.resetLinkSentTo')} {email.trim()}. {t('auth.clickLinkToReset')}
            </Text>
            <Text style={styles.subHint}>{t('auth.didNotReceive')}</Text>
          </>
        ) : (
          <>
            <Text style={styles.hint}>{t('auth.enterEmailForReset')}</Text>

            <View style={styles.field}>
              <Text style={styles.label}>{t('auth.emailAddress')}</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
                keyboardType="email-address"
                placeholder="you@example.com"
                placeholderTextColor={COLORS.textMuted}
              />
            </View>

            {!!error && <Text style={styles.error}>{error}</Text>}

            <Pressable
              style={({ pressed }) => [
                styles.button,
                pressed && styles.buttonPressed,
                submitting && styles.buttonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              <Text style={styles.buttonText}>
                {submitting ? t('auth.sending') : t('auth.sendResetLink')}
              </Text>
            </Pressable>
          </>
        )}

        <View style={styles.footer}>
          <Link href="/login" style={styles.link}>
            {t('auth.backToSignIn')}
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 24,
    color: COLORS.primary,
    textAlign: 'center',
    marginBottom: 12,
  },
  hint: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  subHint: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: COLORS.text,
    marginBottom: 6,
  },
  input: {
    fontFamily: FONTS.regular,
    fontSize: 16,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: COLORS.surface,
  },
  error: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.error,
    marginBottom: 12,
    textAlign: 'center',
  },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonPressed: {
    backgroundColor: COLORS.primaryDark,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: COLORS.white,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  link: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: COLORS.primary,
  },
});
