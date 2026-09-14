import { useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { LANGUAGES, useLanguage } from '../lib/i18n';
import { COLORS, FONTS } from '../lib/theme';

const DROPDOWN_WIDTH = 180;

export default function LanguageSelector() {
  const { lang, setLang } = useLanguage();
  const [visible, setVisible] = useState(false);
  const [anchor, setAnchor] = useState(null);
  const buttonRef = useRef(null);

  const current = LANGUAGES.find((l) => l.code === lang) || LANGUAGES[0];

  const open = () => {
    buttonRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y: y + height, width });
      setVisible(true);
    });
  };

  return (
    <>
      <Pressable
        ref={buttonRef}
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        onPress={open}
        hitSlop={8}
      >
        <Text style={styles.flag}>{current.flag}</Text>
      </Pressable>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <Pressable style={styles.overlay} onPress={() => setVisible(false)}>
          {anchor && (
            <View
              style={[
                styles.dropdown,
                {
                  top: anchor.y + 4,
                  left: Math.max(12, anchor.x + anchor.width - DROPDOWN_WIDTH),
                },
              ]}
            >
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
          )}
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
  },
  dropdown: {
    position: 'absolute',
    width: DROPDOWN_WIDTH,
    backgroundColor: COLORS.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
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
