import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { LANGUAGES, useLanguage } from '../lib/i18n';
import { COLORS, FONTS } from '../lib/theme';

export default function LanguageSelector() {
  const { lang, setLang, t } = useLanguage();
  const [visible, setVisible] = useState(false);

  const current = LANGUAGES.find((l) => l.code === lang) || LANGUAGES[0];

  return (
    <>
      <Pressable
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        onPress={() => setVisible(true)}
        hitSlop={8}
      >
        <Text style={styles.flag}>{current.flag}</Text>
      </Pressable>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <Pressable style={styles.overlay} onPress={() => setVisible(false)}>
          <View style={styles.card}>
            <Text style={styles.title}>{t('lang.selectLanguage')}</Text>
            {LANGUAGES.map((l) => (
              <Pressable
                key={l.code}
                style={({ pressed }) => [
                  styles.option,
                  l.code === lang && styles.optionActive,
                  pressed && styles.optionPressed,
                ]}
                onPress={() => {
                  setLang(l.code);
                  setVisible(false);
                }}
              >
                <Text style={styles.optionFlag}>{l.flag}</Text>
                <Text style={[styles.optionText, l.code === lang && styles.optionTextActive]}>
                  {l.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  buttonPressed: {
    opacity: 0.6,
  },
  flag: {
    fontSize: 20,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 12,
    width: '100%',
    maxWidth: 320,
  },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 8,
    paddingHorizontal: 8,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  optionActive: {
    backgroundColor: COLORS.surface,
  },
  optionPressed: {
    opacity: 0.6,
  },
  optionFlag: {
    fontSize: 22,
  },
  optionText: {
    fontFamily: FONTS.medium,
    fontSize: 15,
    color: COLORS.text,
  },
  optionTextActive: {
    fontFamily: FONTS.bold,
    color: COLORS.primary,
  },
});
