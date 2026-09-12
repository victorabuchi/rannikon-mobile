import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { formatDate, getDaysInMonth, MONTH_NAMES } from '../lib/dates';
import { useLanguage } from '../lib/i18n';
import { COLORS, FONTS } from '../lib/theme';

const DAY_LABEL_KEYS = [
  'tables.daySun',
  'tables.dayMon',
  'tables.dayTue',
  'tables.dayWed',
  'tables.dayThu',
  'tables.dayFri',
  'tables.daySat',
];

// A single-select month calendar, defaulting its view to `selectedDate` and
// disabling any day after `maxDate` (both "YYYY-MM-DD").
export default function DatePickerModal({ visible, selectedDate, maxDate, onSelect, onClose }) {
  const { t } = useLanguage();
  const [year, month] = selectedDate.split('-').slice(0, 2).map(Number);
  const [viewYear, setViewYear] = useState(year);
  const [viewMonth, setViewMonth] = useState(month);

  const shiftMonth = (delta) => {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    setViewMonth(m);
    setViewYear(y);
  };

  const daysInMonth = getDaysInMonth(viewMonth, viewYear);
  const firstWeekday = new Date(viewYear, viewMonth - 1, 1).getDay();
  const cells = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.title}>{t('sup.selectDate')}</Text>

          <View style={styles.monthNav}>
            <Pressable onPress={() => shiftMonth(-1)} hitSlop={10} style={styles.navButton}>
              <Text style={styles.navButtonText}>‹</Text>
            </Pressable>
            <Text style={styles.monthLabel}>
              {MONTH_NAMES[viewMonth - 1]} {viewYear}
            </Text>
            <Pressable onPress={() => shiftMonth(1)} hitSlop={10} style={styles.navButton}>
              <Text style={styles.navButtonText}>›</Text>
            </Pressable>
          </View>

          <View style={styles.weekRow}>
            {DAY_LABEL_KEYS.map((key) => (
              <Text key={key} style={styles.weekLabel}>{t(key)}</Text>
            ))}
          </View>

          <View style={styles.grid}>
            {cells.map((day, i) => {
              if (day == null) return <View key={`empty-${i}`} style={styles.cell} />;
              const iso = formatDate(viewYear, viewMonth, day);
              const isSelected = iso === selectedDate;
              const isDisabled = !!maxDate && iso > maxDate;
              return (
                <Pressable
                  key={iso}
                  disabled={isDisabled}
                  onPress={() => onSelect(iso)}
                  style={[
                    styles.cell,
                    styles.dayCell,
                    isSelected && styles.dayCellSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.dayText,
                      isDisabled && styles.dayTextDisabled,
                      isSelected && styles.dayTextSelected,
                    ]}
                  >
                    {day}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const CELL_SIZE = 40;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    backgroundColor: COLORS.background,
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 360,
  },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: COLORS.text,
    marginBottom: 14,
    textAlign: 'center',
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  navButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navButtonText: {
    fontFamily: FONTS.bold,
    fontSize: 22,
    color: COLORS.primary,
  },
  monthLabel: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: COLORS.text,
  },
  weekRow: {
    flexDirection: 'row',
  },
  weekLabel: {
    width: CELL_SIZE,
    textAlign: 'center',
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: '#888888',
    marginBottom: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCell: {
    borderRadius: CELL_SIZE / 2,
  },
  dayCellSelected: {
    backgroundColor: COLORS.primary,
  },
  dayText: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: COLORS.text,
  },
  dayTextDisabled: {
    color: '#dddddd',
  },
  dayTextSelected: {
    color: COLORS.white,
    fontFamily: FONTS.bold,
  },
});
