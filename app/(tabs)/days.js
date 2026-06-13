import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  GreenPaperTable,
  InlineWeeklySummary,
  OrangePaperTable,
  WhitePaperTable,
} from '../../components/PaperTables';
import api from '../../lib/api';
import { MONTH_NAMES, formatDate, getDaysInMonth } from '../../lib/dates';
import { COLORS, FONTS } from '../../lib/theme';
import { VALID_START_TIMES, computeEntry } from '../../lib/timesheet';

const EMPTY_FORM = { start: '', finish: '', break_mins: '30', work: '' };
const EMPTY_GREEN_FORM = { start: '', finish: '', kg: '', what: '' };

export default function DaysScreen() {
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());
  const [entries, setEntries] = useState({});
  const [greenEntries, setGreenEntries] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editDay, setEditDay] = useState(null);
  const [viewDay, setViewDay] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [greenForm, setGreenForm] = useState(EMPTY_GREEN_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDeleteDay, setConfirmDeleteDay] = useState(null);

  const loadEntries = useCallback(async () => {
    setError('');
    try {
      const { data } = await api.get(`/api/timesheet/${month}/${year}`);
      const map = {};
      (data.entries || []).forEach((entry) => {
        map[entry.entry_date] = computeEntry(entry);
      });
      setEntries(map);
    } catch {
      setError('Could not load timesheet entries.');
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  const loadGreenEntries = useCallback(async () => {
    try {
      const { data } = await api.get(`/api/green/${month}/${year}`);
      const map = {};
      (data.entries || []).forEach((entry) => {
        const day = parseInt(entry.entry_date.split('T')[0].split('-')[2], 10);
        map[formatDate(year, month, day)] = entry;
      });
      setGreenEntries(map);
    } catch {
      // green entries are optional - ignore load errors
    }
  }, [month, year]);

  useEffect(() => {
    setLoading(true);
    loadEntries();
    loadGreenEntries();
  }, [loadEntries, loadGreenEntries]);

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

  const toggleEdit = (day) => {
    const next = editDay === day ? null : day;
    const entry = next ? entries[formatDate(year, month, next)] : null;
    const ge = next ? greenEntries[formatDate(year, month, next)] : null;
    setForm({
      start: entry?.actual_start?.slice(0, 5) || '',
      finish: entry?.actual_finish?.slice(0, 5) || '',
      work: entry?.what_work || '',
      break_mins: String(entry?.break_mins || 30),
    });
    setGreenForm({
      start: ge?.start_time?.slice(0, 5) || '',
      finish: ge?.finish_time?.slice(0, 5) || '',
      kg: ge?.kg_picked != null ? String(ge.kg_picked) : '',
      what: ge?.what_picked || '',
    });
    setFormError('');
    setEditDay(next);
    setViewDay(null);
  };

  const toggleView = (day) => {
    setViewDay((current) => (current === day ? null : day));
  };

  const saveEntry = async () => {
    if (!form.start || !form.finish) {
      setFormError('Start and finish time are required');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const date = formatDate(year, month, editDay);
      await api.post('/api/timesheet/entry', {
        entry_date: date,
        actual_start: form.start,
        actual_finish: form.finish,
        what_work: form.work,
        break_mins: parseInt(form.break_mins, 10) || 30,
      });
      await loadEntries();
      if (greenForm.start || greenForm.finish || greenForm.kg || greenForm.what) {
        await api.post('/api/green/entry', {
          entry_date: `${date}T12:00:00.000Z`,
          start_time: greenForm.start || null,
          finish_time: greenForm.finish || null,
          kg_picked: greenForm.kg ? parseFloat(greenForm.kg) : null,
          what_picked: greenForm.what || '',
        });
        await loadGreenEntries();
      }
      setEditDay(null);
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const deleteEntry = async (day) => {
    const date = formatDate(year, month, day);
    try {
      await api.delete(`/api/timesheet/entry/${date}`);
      try {
        await api.delete(`/api/green/entry/${date}T12:00:00.000Z`);
      } catch {
        // no green entry for this day - ignore
      }
      await loadEntries();
      await loadGreenEntries();
      setConfirmDeleteDay(null);
    } catch (err) {
      Alert.alert('Delete failed', err.response?.data?.error || 'Could not delete the entry. Please try again.');
    }
  };

  const daysInMonth = getDaysInMonth(month, year);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

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
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={loadEntries} tintColor={COLORS.primary} />
          }
          renderItem={({ item: day }) => {
            const date = formatDate(year, month, day);
            const entry = entries[date];
            const hasEntry = !!entry;
            const isEditing = editDay === day;
            const isViewing = viewDay === day;

            return (
              <View style={[styles.card, hasEntry ? styles.cardWithEntry : styles.cardEmpty]}>
                <View style={styles.cardTop}>
                  <View style={styles.cardInfo}>
                    <Text style={styles.dayLabel}>Day {day}</Text>
                    {hasEntry ? (
                      <View style={styles.entryInfo}>
                        <Text style={styles.timeRange}>
                          {entry.actual_start?.slice(0, 5)} to {entry.actual_finish?.slice(0, 5)}
                        </Text>
                        <View style={styles.badgeRow}>
                          <View style={[styles.badge, styles.badgeWhite]}>
                            <Text style={[styles.badgeText, styles.badgeWhiteText]}>W: {entry.white_hours}</Text>
                          </View>
                          <View style={[styles.badge, styles.badgeOrange]}>
                            <Text style={[styles.badgeText, styles.badgeOrangeText]}>O: {entry.orange_hours}</Text>
                          </View>
                          <View style={[styles.badge, styles.badgeTotal]}>
                            <Text style={[styles.badgeText, styles.badgeTotalText]}>Total: {entry.total_hours}</Text>
                          </View>
                          {!!greenEntries[date]?.kg_picked && (
                            <View style={[styles.badge, styles.badgeKg]}>
                              <Text style={[styles.badgeText, styles.badgeKgText]}>KG: {greenEntries[date].kg_picked}</Text>
                            </View>
                          )}
                        </View>
                        {!!entry.what_work && <Text style={styles.workText}>{entry.what_work}</Text>}
                      </View>
                    ) : (
                      <Text style={styles.noEntry}>No entry yet</Text>
                    )}
                  </View>

                  <View style={styles.actions}>
                    {hasEntry && (
                      <Pressable
                        style={[styles.actionButton, isViewing ? styles.viewButtonActive : styles.viewButton]}
                        onPress={() => toggleView(day)}
                      >
                        <Text style={[styles.actionButtonText, isViewing ? styles.viewButtonActiveText : styles.viewButtonText]}>
                          {isViewing ? 'Hide' : 'View'}
                        </Text>
                      </Pressable>
                    )}
                    <Pressable
                      style={[styles.actionButton, hasEntry ? styles.editButton : styles.addButton]}
                      onPress={() => toggleEdit(day)}
                    >
                      <Text style={[styles.actionButtonText, hasEntry ? styles.editButtonText : styles.addButtonText]}>
                        {isEditing ? 'Close' : hasEntry ? 'Edit' : '+ Add'}
                      </Text>
                    </Pressable>
                    {hasEntry && (
                      <Pressable
                        style={[styles.actionButton, styles.deleteButton]}
                        onPress={() => setConfirmDeleteDay(day)}
                      >
                        <Text style={styles.deleteButtonText}>Delete</Text>
                      </Pressable>
                    )}
                  </View>
                </View>

                {isEditing && (
                  <View style={styles.editForm}>
                    {!!formError && <Text style={styles.formError}>{formError}</Text>}

                    <View style={styles.field}>
                      <Text style={styles.label}>Actual start time</Text>
                      <TextInput
                        style={styles.input}
                        value={form.start}
                        onChangeText={(text) => setForm((f) => ({ ...f, start: text }))}
                        placeholder="HH:MM e.g. 10:15"
                        placeholderTextColor={COLORS.textMuted}
                      />
                      {!!form.start && !VALID_START_TIMES.includes(form.start) && (
                        <Text style={styles.warningText}>Should be 9:00, 9:15, 9:30, or 9:45</Text>
                      )}
                    </View>

                    <View style={styles.field}>
                      <Text style={styles.label}>Actual finish time</Text>
                      <TextInput
                        style={styles.input}
                        value={form.finish}
                        onChangeText={(text) => setForm((f) => ({ ...f, finish: text }))}
                        placeholder="HH:MM e.g. 20:45"
                        placeholderTextColor={COLORS.textMuted}
                      />
                    </View>

                    <View style={styles.field}>
                      <Text style={styles.label}>Total break (minutes)</Text>
                      <TextInput
                        style={styles.input}
                        value={form.break_mins}
                        onChangeText={(text) =>
                          setForm((f) => ({ ...f, break_mins: text.replace(/[^0-9]/g, '') }))
                        }
                        keyboardType="number-pad"
                        placeholder="30"
                        placeholderTextColor={COLORS.textMuted}
                      />
                      <Text style={styles.helperText}>Min 30 min eating break</Text>
                    </View>

                    <View style={styles.field}>
                      <Text style={styles.label}>What work</Text>
                      <TextInput
                        style={styles.input}
                        value={form.work}
                        onChangeText={(text) => setForm((f) => ({ ...f, work: text }))}
                        placeholder="e.g. cleaning, planting"
                        placeholderTextColor={COLORS.textMuted}
                      />
                    </View>

                    <View style={styles.greenSection}>
                      <Text style={styles.greenSectionTitle}>Berry picking (Green paper)</Text>

                      <View style={styles.field}>
                        <Text style={styles.label}>Start time</Text>
                        <TextInput
                          style={styles.input}
                          value={greenForm.start}
                          onChangeText={(text) => setGreenForm((f) => ({ ...f, start: text }))}
                          placeholder="HH:MM"
                          placeholderTextColor={COLORS.textMuted}
                        />
                      </View>

                      <View style={styles.field}>
                        <Text style={styles.label}>Finish time</Text>
                        <TextInput
                          style={styles.input}
                          value={greenForm.finish}
                          onChangeText={(text) => setGreenForm((f) => ({ ...f, finish: text }))}
                          placeholder="HH:MM"
                          placeholderTextColor={COLORS.textMuted}
                        />
                      </View>

                      <View style={styles.field}>
                        <Text style={styles.label}>Kg picked</Text>
                        <TextInput
                          style={styles.input}
                          value={greenForm.kg}
                          onChangeText={(text) => setGreenForm((f) => ({ ...f, kg: text }))}
                          placeholder="e.g. 24.5"
                          placeholderTextColor={COLORS.textMuted}
                          keyboardType="decimal-pad"
                        />
                      </View>

                      <View style={styles.field}>
                        <Text style={styles.label}>What was picked</Text>
                        <TextInput
                          style={styles.input}
                          value={greenForm.what}
                          onChangeText={(text) => setGreenForm((f) => ({ ...f, what: text }))}
                          placeholder="e.g. strawberries"
                          placeholderTextColor={COLORS.textMuted}
                        />
                      </View>
                    </View>

                    <View style={styles.formButtons}>
                      <Pressable
                        style={({ pressed }) => [
                          styles.saveButton,
                          pressed && styles.saveButtonPressed,
                          saving && styles.saveButtonDisabled,
                        ]}
                        onPress={saveEntry}
                        disabled={saving}
                      >
                        <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save'}</Text>
                      </Pressable>
                      <Pressable
                        style={styles.cancelButton}
                        onPress={() => {
                          setEditDay(null);
                          setFormError('');
                        }}
                      >
                        <Text style={styles.cancelButtonText}>Cancel</Text>
                      </Pressable>
                    </View>
                  </View>
                )}

                {isViewing && hasEntry && (
                  <InlineDayView
                    day={day}
                    year={year}
                    month={month}
                    entry={entry}
                    entries={entries}
                    greenEntries={greenEntries}
                  />
                )}
              </View>
            );
          }}
        />
      )}

      <Modal visible={confirmDeleteDay != null} transparent animationType="fade" onRequestClose={() => setConfirmDeleteDay(null)}>
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Delete Day {confirmDeleteDay}?</Text>
            <Text style={styles.confirmText}>This will permanently remove this entry from all papers.</Text>
            <View style={styles.confirmButtons}>
              <Pressable style={styles.confirmCancelButton} onPress={() => setConfirmDeleteDay(null)}>
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.confirmDeleteButton} onPress={() => deleteEntry(confirmDeleteDay)}>
                <Text style={styles.confirmDeleteText}>Yes, delete</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function InlineDayView({ day, year, month, entry, entries, greenEntries }) {
  return (
    <View style={styles.inlineView}>
      <Text style={styles.inlineTitle}>WHITE PAPER: WORK PAID BY THE HOUR</Text>
      <Text style={styles.inlineSubtitle}>8 HOURS PER DAY / 40 HOURS PER WEEK</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator style={styles.inlineTable}>
        <WhitePaperTable days={[day]} year={year} month={month} entries={entries} />
      </ScrollView>
      <Text style={styles.inlineItalic}>
        When you have worked 4 hours, You need to have an eating break, minimum of 30 mins. START WORK 9:00, 9:15,
        9:30 or 9:45.
      </Text>

      <Text style={[styles.inlineTitle, { color: '#b45309' }]}>ORANGE PAPER: EXTRAWORK PAID BY THE HOUR</Text>
      <Text style={styles.inlineSubtitle}>
        MAXIMUM 3 HOURS PER DAY (MONDAY-FRIDAY) | MAXIMUM 11 HOURS PER DAY (SATURDAY)
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator style={styles.inlineTable}>
        <OrangePaperTable days={[day]} year={year} month={month} entries={entries} />
      </ScrollView>
      <Text style={styles.inlineItalic}>
        Start work 9:00, 9:15, 9:30 or 9:45. Work does not start 9:05, 9:10, 9:20, 9:25 etc.
      </Text>

      <Text style={[styles.inlineTitle, { color: '#1565c0' }]}>WEEKLY SUMMARY</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator style={styles.inlineTable}>
        <InlineWeeklySummary entry={entry} />
      </ScrollView>

      <Text style={[styles.inlineTitle, { color: '#2d6a2d' }]}>
        GREEN PAPER: TIME USED FOR PICKUP (SALARY PAID BY KILOS)
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator style={styles.inlineTable}>
        <GreenPaperTable days={[day]} year={year} month={month} greenEntries={greenEntries} />
      </ScrollView>
      <Text style={[styles.inlineItalic, { marginBottom: 0 }]}>HOX, NEED TO PICKUP 10 KILO PER HOUR!</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: COLORS.background,
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
  listContent: {
    padding: 12,
    gap: 8,
  },
  card: {
    backgroundColor: COLORS.background,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  cardWithEntry: {
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  cardEmpty: {
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardTop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  cardInfo: {
    flex: 1,
    minWidth: 140,
  },
  dayLabel: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: COLORS.text,
  },
  entryInfo: {
    marginTop: 4,
  },
  noEntry: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: '#bbbbbb',
    marginTop: 4,
  },
  timeRange: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#555555',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontFamily: FONTS.bold,
    fontSize: 11,
  },
  badgeWhite: {
    backgroundColor: '#f0f0f0',
  },
  badgeWhiteText: {
    color: '#555555',
  },
  badgeOrange: {
    backgroundColor: '#fff3e0',
  },
  badgeOrangeText: {
    color: '#b45309',
  },
  badgeTotal: {
    backgroundColor: '#e3f2fd',
  },
  badgeTotalText: {
    color: '#1565c0',
  },
  badgeKg: {
    backgroundColor: '#e8f5e9',
    borderWidth: 1,
    borderColor: '#c8e6c9',
  },
  badgeKgText: {
    color: '#2d6a2d',
  },
  workText: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: '#888888',
    marginTop: 6,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  actionButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  actionButtonText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
  },
  viewButton: {
    backgroundColor: '#e8f5e9',
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  viewButtonText: {
    color: COLORS.primary,
  },
  viewButtonActive: {
    backgroundColor: COLORS.primary,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  viewButtonActiveText: {
    color: COLORS.white,
  },
  editButton: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: '#cccccc',
  },
  editButtonText: {
    color: '#333333',
  },
  addButton: {
    backgroundColor: COLORS.primary,
  },
  addButtonText: {
    color: COLORS.white,
  },
  deleteButton: {
    backgroundColor: '#fdecea',
    borderWidth: 1,
    borderColor: '#ffc1c0',
  },
  deleteButtonText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: '#c0392b',
  },
  editForm: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 10,
  },
  formError: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.error,
  },
  field: {},
  label: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.text,
    marginBottom: 4,
  },
  greenSection: {
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 8,
    padding: 12,
    gap: 10,
  },
  greenSectionTitle: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: COLORS.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: '#cccccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: COLORS.background,
  },
  warningText: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: '#e08a00',
    marginTop: 2,
  },
  helperText: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: '#888888',
    marginTop: 2,
  },
  formButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  saveButton: {
    flex: 1,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveButtonPressed: {
    backgroundColor: COLORS.primaryDark,
  },
  saveButtonDisabled: {
    backgroundColor: '#aaaaaa',
  },
  saveButtonText: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: COLORS.white,
  },
  cancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cccccc',
    backgroundColor: COLORS.background,
  },
  cancelButtonText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: '#333333',
  },
  inlineView: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eeeeee',
  },
  inlineTitle: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: COLORS.text,
    marginBottom: 2,
  },
  inlineSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: '#555555',
    marginBottom: 6,
  },
  inlineTable: {
    marginBottom: 12,
  },
  inlineItalic: {
    fontFamily: FONTS.regular,
    fontStyle: 'italic',
    fontSize: 11,
    color: '#555555',
    marginBottom: 16,
  },
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  confirmCard: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    paddingVertical: 28,
    paddingHorizontal: 32,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  confirmTitle: {
    fontFamily: FONTS.bold,
    fontSize: 17,
    color: COLORS.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  confirmText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 20,
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
  },
  confirmCancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dddddd',
    backgroundColor: COLORS.background,
  },
  confirmCancelText: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: COLORS.text,
  },
  confirmDeleteButton: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: '#c0392b',
  },
  confirmDeleteText: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: COLORS.white,
  },
});
