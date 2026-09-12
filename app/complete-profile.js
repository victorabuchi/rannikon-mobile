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

import api from '../lib/api';
import { useAuth } from '../lib/auth';
import { useLanguage } from '../lib/i18n';
import { COLORS, FONTS } from '../lib/theme';

export default function CompleteProfileScreen() {
  const { signIn } = useAuth();
  const { t } = useLanguage();
  const [workNumber, setWorkNumber] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!workNumber.trim()) {
      setError(t('completeProfile.required'));
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      const { data } = await api.patch('/api/auth/work-number', {
        work_number: workNumber.trim(),
      });
      await signIn(data.token, data.worker);
    } catch (err) {
      setError(err.response?.data?.error || t('completeProfile.error'));
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
        <Text style={styles.title}>{t('completeProfile.title')}</Text>
        <Text style={styles.hint}>{t('completeProfile.hint')}</Text>

        <View style={styles.field}>
          <TextInput
            style={styles.input}
            value={workNumber}
            onChangeText={setWorkNumber}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            placeholder={t('completeProfile.placeholder')}
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
            {submitting ? t('completeProfile.submitting') : t('completeProfile.submit')}
          </Text>
        </Pressable>
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
    marginBottom: 8,
  },
  hint: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: 32,
    paddingHorizontal: 8,
  },
  field: {
    marginBottom: 16,
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
});
