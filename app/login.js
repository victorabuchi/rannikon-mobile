import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { useEffect, useState } from 'react';
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

import LanguageSelector from '../components/LanguageSelector';
import api from '../lib/api';
import { useAuth } from '../lib/auth';
import { useLanguage } from '../lib/i18n';
import { COLORS, FONTS } from '../lib/theme';

const WEB_CLIENT_ID = '380566128812-qqg1ivithniltf4f1kmqcskb3k4686so.apps.googleusercontent.com';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const { t } = useLanguage();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  useEffect(() => {
    GoogleSignin.configure({
      webClientId: WEB_CLIENT_ID,
      offlineAccess: true,
    });
  }, []);

  const handleLogin = async () => {
    if (!identifier.trim() || !password) {
      setError(t('auth.enterCredentials'));
      return;
    }

    setError('');
    setSubmitting(true);

    const isEmail = identifier.includes('@');
    const payload = {
      password,
      ...(isEmail
        ? { email: identifier.trim() }
        : { work_number: identifier.trim() }),
    };

    try {
      const { data } = await api.post('/api/auth/login', payload);
      await signIn(data.token, data.worker);
    } catch (err) {
      setError(err.response?.data?.message || t('auth.loginError'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setGoogleBusy(true);
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const result = await GoogleSignin.signIn();
      if (result.type !== 'success') return;
      const idToken = result.data?.idToken;
      if (!idToken) {
        setError(t('auth.loginError'));
        return;
      }
      const { data } = await api.post('/api/auth/google/mobile', { idToken });
      await signIn(data.token, data.worker);
    } catch (err) {
      if (err.code === statusCodes.SIGN_IN_CANCELLED) {
        // user dismissed — no error shown
      } else if (err.code === statusCodes.IN_PROGRESS) {
        // sign in already in progress
      } else {
        setError(err.response?.data?.error || t('auth.loginError'));
      }
    } finally {
      setGoogleBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.langBar}>
        <LanguageSelector />
      </View>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>{t('auth.appName')}</Text>
        <Text style={styles.subtitle}>{t('auth.signInSubtitle')}</Text>

        <View style={styles.field}>
          <Text style={styles.label}>{t('auth.workNumberOrEmail')}</Text>
          <TextInput
            style={styles.input}
            value={identifier}
            onChangeText={setIdentifier}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            placeholder={t('auth.workNumberOrEmailPlaceholder')}
            placeholderTextColor={COLORS.textMuted}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>{t('auth.password')}</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder={t('auth.password')}
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
          onPress={handleLogin}
          disabled={submitting}
        >
          <Text style={styles.buttonText}>
            {submitting ? t('auth.signingIn') : t('auth.signIn')}
          </Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.googleButton,
            pressed && styles.googleButtonPressed,
            googleBusy && styles.buttonDisabled,
          ]}
          onPress={handleGoogleSignIn}
          disabled={googleBusy}
        >
          <View style={styles.googleLogo}>
            <Text style={styles.googleLogoBlue}>G</Text>
          </View>
          <Text style={styles.googleButtonText}>
            {googleBusy ? t('auth.signingIn') : t('auth.continueWithGoogle')}
          </Text>
        </Pressable>

        <View style={styles.footer}>
          <Text style={styles.footerText}>{t('auth.noAccount')}</Text>
          <Link href="/register" style={styles.link}>
            {t('auth.registerLink')}
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
  langBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 32,
    color: COLORS.primary,
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: FONTS.regular,
    fontSize: 16,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: 32,
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
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: '#dadce0',
    borderRadius: 8,
    paddingVertical: 13,
    paddingHorizontal: 16,
    marginTop: 12,
  },
  googleButtonPressed: {
    backgroundColor: '#f8f8f8',
  },
  googleLogo: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#4285F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleLogoBlue: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: COLORS.white,
    lineHeight: 22,
  },
  googleButtonText: {
    fontFamily: FONTS.medium,
    fontSize: 15,
    color: '#3c4043',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  footerText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textMuted,
  },
  link: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: COLORS.primary,
  },
});
