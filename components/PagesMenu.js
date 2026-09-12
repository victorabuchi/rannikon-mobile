import { useState } from 'react';
import { useRouter, usePathname } from 'expo-router';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { useLanguage } from '../lib/i18n';
import { COLORS, FONTS } from '../lib/theme';

// Mirrors web's PagesMenu: only admins get a jump-to-any-page dropdown.
// Every other role reaches other pages only via a single "My timesheet"
// back-link (see PageHeader), matching web's actual navigable surface.
export default function PagesMenu({ role }) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);

  if (role !== 'admin') return null;

  const items = [
    { path: '/days', label: t('nav.myTimesheet') },
    { path: '/supervisor', label: t('nav.supervisor') },
    { path: '/housemaster', label: t('nav.housemaster') },
    { path: '/archive', label: t('nav.archive') },
    { path: '/board', label: t('nav.board') },
    { path: '/payroll', label: t('nav.payroll') },
    { path: '/admin', label: t('nav.admin') },
  ];

  return (
    <>
      <Pressable
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        onPress={() => setOpen(true)}
      >
        <Text style={styles.buttonText}>{t('nav.pages')}</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <View style={styles.card}>
            {items.map((item) => {
              const active = pathname === item.path;
              return (
                <Pressable
                  key={item.path}
                  disabled={active}
                  onPress={() => {
                    setOpen(false);
                    router.push(item.path);
                  }}
                  style={({ pressed }) => [
                    styles.item,
                    active && styles.itemActive,
                    pressed && !active && styles.itemPressed,
                  ]}
                >
                  <Text style={[styles.itemText, active && styles.itemTextActive]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  buttonPressed: {
    backgroundColor: '#f0f7f0',
  },
  buttonText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.primary,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'flex-end',
    padding: 16,
  },
  card: {
    marginTop: 56,
    backgroundColor: COLORS.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dddddd',
    width: 220,
    overflow: 'hidden',
  },
  item: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0ec',
  },
  itemActive: {
    backgroundColor: '#f0f7f0',
  },
  itemPressed: {
    backgroundColor: COLORS.surface,
  },
  itemText: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: COLORS.text,
  },
  itemTextActive: {
    fontFamily: FONTS.bold,
    color: COLORS.primary,
  },
});
