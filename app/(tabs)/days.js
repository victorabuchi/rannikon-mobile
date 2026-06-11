import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import api from '../../lib/api';
import { MONTH_NAMES, formatDate, getDaysInMonth } from '../../lib/dates';
import { COLORS, FONTS } from '../../lib/theme';

const EMPTY_FORM = {
  actual_start: '',
  actual_finish: '',
  what_work: '',
  break_mins: '',
};

export default function DaysScreen() {
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());
  const [entries, setEntries] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const loadEntries = useCallback(async () => {
    setError('');
    try {
      const { data } = await api.get(`/api/timesheet/${month}/${year}`);
      const map = {};
      (data.entries || []).forEach((entry) => {
        map[entry.entry_date] = entry;
      });
      setEntries(map);
    } catch {
      setError('Could not load timesheet entries.');
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    setLoading(true);
    loadEntries();
  }, [loadEntries]);

  const goToPreviousMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const goToNextMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  const openModal = (date) => {
    const entry = entries[date];
    setSelectedDate(date);
    setForm({
      actual_start: entry?.actual_start || '',
      actual_finish: entry?.actual_finish || '',
      what_work: entry?.what_work || '',
      break_mins: entry?.break_mins != null ? String(entry.break_mins) : '',
    });
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setSelectedDate(null);
    setForm(EMPTY_FORM);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post('/api/timesheet/entry', {
        entry_date: selectedDate,
        actual_start: form.actual_start,
        actual_finish: form.actual_finish,
        what_work: form.what_work,
        break_mins: form.break_mins ? Number(form.break_mins) : 0,
      });
      await loadEntries();
      closeModal();
    } catch {
      Alert.alert('Error', 'Could not save the entry. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await api.delete(`/api/timesheet/entry/${selectedDate}`);
      await loadEntries();
      closeModal();
    } catch {
      Alert.alert('Error', 'Could not delete the entry. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const daysInMonth = getDaysInMonth(month, year);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const selectedEntry = selectedDate ? entries[selectedDate] : null;

  return (
    <View style={styles.container}>
      <View style={styles.monthHeader}>
        <Pressable onPress={goToPreviousMonth} style={styles.monthButton} hitSlop={8}>
          <Text style={styles.monthButtonText}>{'<'}</Text>
        </Pressable>
        <Text style={styles.monthTitle}>
          {MONTH_NAMES[month - 1]} {year}
        </Text>
        <Pressable onPress={goToNextMonth} style={styles.monthButton} hitSlop={8}>
          <Text style={styles.monthButtonText}>{'>'}</Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={styles.loading} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <FlatList
          data={days}
          keyExtractor={(day) => String(day)}
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={loadEntries}
              tintColor={COLORS.primary}
            />
          }
          renderItem={({ item: day }) => {
            const date = formatDate(year, month, day);
            const entry = entries[date];
            return (
              <Pressable style={styles.row} onPress={() => openModal(date)}>
                <View style={styles.rowDate}>
                  <Text style={styles.rowDay}>{day}</Text>
                </View>
                <View style={styles.rowDetails}>
                  {entry ? (
                    <>
                      <Text style={styles.rowText}>
                        {entry.actual_start} - {entry.actual_finish}
                        {entry.break_mins ? `  ·  ${entry.break_mins} min break` : ''}
                      </Text>
                      {!!entry.what_work && (
                        <Text style={styles.rowSubtext}>{entry.what_work}</Text>
                      )}
                    </>
                  ) : (
                    <Text style={styles.rowEmpty}>No entry</Text>
                  )}
                </View>
              </Pressable>
            );
          }}
        />
      )}

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{selectedDate}</Text>

            <View style={styles.field}>
              <Text style={styles.label}>Start time</Text>
              <TextInput
                style={styles.input}
                value={form.actual_start}
                onChangeText={(text) =>
                  setForm((f) => ({ ...f, actual_start: text }))
                }
                placeholder="08:00"
                placeholderTextColor={COLORS.textMuted}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Finish time</Text>
              <TextInput
                style={styles.input}
                value={form.actual_finish}
                onChangeText={(text) =>
                  setForm((f) => ({ ...f, actual_finish: text }))
                }
                placeholder="16:00"
                placeholderTextColor={COLORS.textMuted}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Break (minutes)</Text>
              <TextInput
                style={styles.input}
                value={form.break_mins}
                onChangeText={(text) =>
                  setForm((f) => ({
                    ...f,
                    break_mins: text.replace(/[^0-9]/g, ''),
                  }))
                }
                keyboardType="number-pad"
                placeholder="30"
                placeholderTextColor={COLORS.textMuted}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>What work</Text>
              <TextInput
                style={styles.input}
                value={form.what_work}
                onChangeText={(text) =>
                  setForm((f) => ({ ...f, what_work: text }))
                }
                placeholder="Describe the work"
                placeholderTextColor={COLORS.textMuted}
              />
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.button,
                pressed && styles.buttonPressed,
                saving && styles.buttonDisabled,
              ]}
              onPress={handleSave}
              disabled={saving}
            >
              <Text style={styles.buttonText}>
                {saving ? 'Saving...' : 'Save'}
              </Text>
            </Pressable>

            {!!selectedEntry && (
              <Pressable
                style={({ pressed }) => [
                  styles.deleteButton,
                  pressed && styles.deleteButtonPressed,
                  saving && styles.buttonDisabled,
                ]}
                onPress={handleDelete}
                disabled={saving}
              >
                <Text style={styles.deleteButtonText}>Delete entry</Text>
              </Pressable>
            )}

            <Pressable style={styles.cancelButton} onPress={closeModal}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  monthButton: {
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  monthButtonText: {
    fontFamily: FONTS.bold,
    fontSize: 22,
    color: COLORS.primary,
  },
  monthTitle: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: COLORS.text,
  },
  loading: {
    marginTop: 32,
  },
  error: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.error,
    textAlign: 'center',
    marginTop: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  rowDate: {
    width: 40,
    alignItems: 'center',
  },
  rowDay: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: COLORS.primary,
  },
  rowDetails: {
    flex: 1,
    marginLeft: 16,
  },
  rowText: {
    fontFamily: FONTS.medium,
    fontSize: 15,
    color: COLORS.text,
  },
  rowSubtext: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  rowEmpty: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: COLORS.textMuted,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 24,
  },
  modalTitle: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: COLORS.primary,
    marginBottom: 16,
  },
  field: {
    marginBottom: 14,
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
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
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
  deleteButton: {
    borderWidth: 1,
    borderColor: COLORS.error,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  deleteButtonPressed: {
    backgroundColor: COLORS.surface,
  },
  deleteButtonText: {
    fontFamily: FONTS.medium,
    fontSize: 16,
    color: COLORS.error,
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 4,
  },
  cancelButtonText: {
    fontFamily: FONTS.medium,
    fontSize: 16,
    color: COLORS.textMuted,
  },
});
