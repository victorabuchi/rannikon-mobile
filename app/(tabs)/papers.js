import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import api from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { MONTH_NAMES, formatDate, getDaysInMonth } from '../../lib/dates';
import { COLORS, FONTS } from '../../lib/theme';

const PAPER_TYPES = [
  { key: 'white', label: 'White' },
  { key: 'orange', label: 'Orange' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'green', label: 'Green' },
];

const COL = {
  date: 46,
  time: 64,
  breakCol: 78,
  hours: 110,
  work: 160,
  sig: 90,
  type: 140,
  day: 50,
  total: 86,
};

function formatExtraBreak(breakMins) {
  const extra = (breakMins ?? 0) - 30;
  if (extra <= 0) return '';
  const hours = Math.floor(extra / 60);
  const mins = extra % 60;
  return `${hours}:${String(mins).padStart(2, '0')}`;
}

function parseHoursToMinutes(value) {
  if (value == null || value === '') return 0;
  const [h, m] = String(value).split(':');
  return (Number(h) || 0) * 60 + (Number(m) || 0);
}

function formatMinutesToHours(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return `${hours}:${String(mins).padStart(2, '0')}`;
}

function getWeeks(year, month, daysInMonth) {
  const weeks = [];
  let current = null;
  for (let day = 1; day <= daysInMonth; day++) {
    const weekday = new Date(year, month - 1, day).getDay();
    const mondayIndex = (weekday + 6) % 7;
    if (!current || mondayIndex === 0) {
      current = Array(7).fill(null);
      weeks.push(current);
    }
    current[mondayIndex] = day;
  }
  return weeks;
}

const WEEK_ROWS = [
  { field: 'white_hours', label: 'Working hours (max 8)' },
  { field: 'orange_hours', label: 'Extra hours (max 3)' },
  { field: 'total_hours', label: 'Total' },
];

function paperBorder(color) {
  return { borderColor: color };
}

function Cell({ width, text, align = 'center', style }) {
  return (
    <View style={[styles.cell, { width }, style]}>
      <Text
        style={[styles.cellText, align === 'left' && styles.cellTextLeft]}
        numberOfLines={1}
      >
        {text ?? ''}
      </Text>
    </View>
  );
}

function HeaderCell({ width, label, style }) {
  return (
    <View style={[styles.cell, styles.headerCell, { width }, style]}>
      <Text style={styles.headerCellText} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

function EditableCell({
  width,
  value,
  editable,
  onSave,
  align = 'center',
  keyboardType = 'default',
  style,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value != null ? String(value) : '');

  useEffect(() => {
    if (!editing) {
      setDraft(value != null ? String(value) : '');
    }
  }, [value, editing]);

  if (!editable) {
    return <Cell width={width} text={value} align={align} style={style} />;
  }

  if (editing) {
    return (
      <View style={[styles.cell, { width }, style]}>
        <TextInput
          style={[
            styles.cellText,
            styles.cellInput,
            align === 'left' && styles.cellTextLeft,
          ]}
          value={draft}
          onChangeText={setDraft}
          keyboardType={keyboardType}
          autoFocus
          onBlur={async () => {
            setEditing(false);
            const previous = value != null ? String(value) : '';
            if (draft !== previous) {
              try {
                await onSave(draft);
              } catch {
                setDraft(previous);
                Alert.alert('Error', 'Could not save the change. Please try again.');
              }
            }
          }}
        />
      </View>
    );
  }

  return (
    <Pressable
      style={({ pressed }) => [
        styles.cell,
        { width },
        style,
        pressed && styles.cellPressed,
      ]}
      onPress={() => setEditing(true)}
    >
      <Text
        style={[styles.cellText, align === 'left' && styles.cellTextLeft]}
        numberOfLines={1}
      >
        {value != null && value !== '' ? String(value) : ''}
      </Text>
    </Pressable>
  );
}

function WhitePaper({ days, year, month, entries, onSave, worker }) {
  const border = '#333333';
  return (
    <View>
      <View style={styles.paperHeader}>
        <Text style={styles.paperWorkerInfo}>
          Name: {worker?.full_name || '-'}    Work number: {worker?.work_number || '-'}
        </Text>
        <Text style={[styles.paperTitle, { color: border }]}>WORK PAID BY THE HOUR</Text>
        <Text style={styles.paperSubtitle}>8 HOURS PER DAY / 40 HOURS PER WEEK</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator>
      <View style={[styles.table, paperBorder(border)]}>
        <View style={[styles.headerRow, { backgroundColor: '#e0e0e0' }]}>
          <HeaderCell width={COL.date} label="Date" style={paperBorder(border)} />
          <HeaderCell width={COL.time} label="Start" style={paperBorder(border)} />
          <HeaderCell width={COL.time} label="Finish" style={paperBorder(border)} />
          <HeaderCell width={COL.breakCol} label="Eating break" style={paperBorder(border)} />
          <HeaderCell width={COL.breakCol} label="Extra breaks" style={paperBorder(border)} />
          <HeaderCell width={COL.hours} label="Hours minus breaks" style={paperBorder(border)} />
          <HeaderCell width={COL.work} label="What work" style={paperBorder(border)} />
        </View>
        {days.map((day) => {
          const date = formatDate(year, month, day);
          const entry = entries[date];
          const hasEntry = !!entry;
          return (
            <View
              key={date}
              style={[styles.row, hasEntry && { backgroundColor: '#fafafa' }]}
            >
              <Cell width={COL.date} text={String(day)} style={paperBorder(border)} />
              <EditableCell
                width={COL.time}
                value={entry?.white_start}
                editable={hasEntry}
                onSave={(v) => onSave(date, 'white_start', v)}
                style={paperBorder(border)}
              />
              <EditableCell
                width={COL.time}
                value={entry?.white_finish}
                editable={hasEntry}
                onSave={(v) => onSave(date, 'white_finish', v)}
                style={paperBorder(border)}
              />
              <Cell width={COL.breakCol} text="30 min" style={paperBorder(border)} />
              <Cell
                width={COL.breakCol}
                text={hasEntry ? formatExtraBreak(entry.break_mins) : ''}
                style={paperBorder(border)}
              />
              <EditableCell
                width={COL.hours}
                value={entry?.white_hours}
                editable={hasEntry}
                onSave={(v) => onSave(date, 'white_hours', v)}
                keyboardType="decimal-pad"
                style={paperBorder(border)}
              />
              <EditableCell
                width={COL.work}
                value={entry?.what_work}
                editable={hasEntry}
                onSave={(v) => onSave(date, 'what_work', v)}
                align="left"
                style={paperBorder(border)}
              />
            </View>
          );
        })}
      </View>
      </ScrollView>
    </View>
  );
}

function OrangePaper({ days, year, month, entries, onSave }) {
  const border = '#c97d00';
  return (
    <View>
      <View style={styles.paperHeader}>
        <Text style={[styles.paperTitle, { color: border }]}>
          ORANGE PAPER — EXTRAWORK PAID BY THE HOUR
        </Text>
        <Text style={styles.paperSubtitle}>
          MAXIMUM 3 HOURS PER DAY (MONDAY-FRIDAY) | MAXIMUM 11 HOURS PER DAY (SATURDAY)
        </Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator>
      <View style={[styles.table, paperBorder(border)]}>
        <View style={[styles.headerRow, { backgroundColor: '#ffe0a0' }]}>
          <HeaderCell width={COL.date} label="Date" style={paperBorder(border)} />
          <HeaderCell width={COL.time} label="Start" style={paperBorder(border)} />
          <HeaderCell width={COL.time} label="Finish" style={paperBorder(border)} />
          <HeaderCell width={COL.breakCol} label="Break" style={paperBorder(border)} />
          <HeaderCell width={COL.hours} label="Hours minus breaks" style={paperBorder(border)} />
          <HeaderCell width={COL.work} label="What work" style={paperBorder(border)} />
          <HeaderCell width={COL.sig} label="Signature" style={paperBorder(border)} />
        </View>
        {days.map((day) => {
          const date = formatDate(year, month, day);
          const entry = entries[date];
          const hasEntry = !!entry;
          return (
            <View
              key={date}
              style={[styles.row, hasEntry && { backgroundColor: '#fffbf0' }]}
            >
              <Cell width={COL.date} text={String(day)} style={paperBorder(border)} />
              <EditableCell
                width={COL.time}
                value={entry?.orange_start}
                editable={hasEntry}
                onSave={(v) => onSave(date, 'orange_start', v)}
                style={paperBorder(border)}
              />
              <EditableCell
                width={COL.time}
                value={entry?.orange_finish}
                editable={hasEntry}
                onSave={(v) => onSave(date, 'orange_finish', v)}
                style={paperBorder(border)}
              />
              <Cell
                width={COL.breakCol}
                text={hasEntry ? formatExtraBreak(entry.break_mins) : ''}
                style={paperBorder(border)}
              />
              <EditableCell
                width={COL.hours}
                value={entry?.orange_hours}
                editable={hasEntry}
                onSave={(v) => onSave(date, 'orange_hours', v)}
                keyboardType="decimal-pad"
                style={paperBorder(border)}
              />
              <EditableCell
                width={COL.work}
                value={entry?.what_work}
                editable={hasEntry}
                onSave={(v) => onSave(date, 'what_work', v)}
                align="left"
                style={paperBorder(border)}
              />
              <Cell width={COL.sig} text="" style={paperBorder(border)} />
            </View>
          );
        })}
      </View>
      </ScrollView>
    </View>
  );
}

function WeeklyPaper({ year, month, daysInMonth, entries }) {
  const border = '#90caf9';
  const weeks = getWeeks(year, month, daysInMonth);

  return (
    <View>
      <View style={styles.paperHeader}>
        <Text style={[styles.paperTitle, { color: '#1565c0' }]}>WEEKLY SUMMARY</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator>
      <View>
        {weeks.map((weekDays, weekIndex) => {
          let workingMinutes = 0;
          let extraMinutes = 0;
          weekDays.forEach((day, i) => {
            if (day == null || i === 6) return;
            const entry = entries[formatDate(year, month, day)];
            workingMinutes += parseHoursToMinutes(entry?.white_hours);
            extraMinutes += parseHoursToMinutes(entry?.orange_hours);
          });
          const weekTotalMinutes = {
            white_hours: workingMinutes,
            orange_hours: extraMinutes,
            total_hours: workingMinutes + extraMinutes,
          };

          return (
            <View
              key={weekIndex}
              style={[styles.table, paperBorder(border), weekIndex > 0 && styles.weekSpacing]}
            >
              <View style={[styles.headerRow, { backgroundColor: '#bbdefb' }]}>
                <HeaderCell width={COL.type} label="" style={paperBorder(border)} />
                {weekDays.map((day, i) => (
                  <HeaderCell
                    key={i}
                    width={COL.day}
                    label={day != null ? String(day) : ''}
                    style={paperBorder(border)}
                  />
                ))}
                <HeaderCell width={COL.total} label="Total hours" style={paperBorder(border)} />
              </View>
              {WEEK_ROWS.map((row) => (
                <View key={row.field} style={styles.row}>
                  <Cell
                    width={COL.type}
                    text={row.label}
                    align="left"
                    style={paperBorder(border)}
                  />
                  {weekDays.map((day, i) => {
                    if (day == null) {
                      return (
                        <Cell key={i} width={COL.day} text="" style={paperBorder(border)} />
                      );
                    }
                    if (i === 6) {
                      return (
                        <Cell key={i} width={COL.day} text="X" style={paperBorder(border)} />
                      );
                    }
                    const date = formatDate(year, month, day);
                    const value = entries[date]?.[row.field];
                    return (
                      <Cell
                        key={i}
                        width={COL.day}
                        text={value != null ? String(value) : ''}
                        style={paperBorder(border)}
                      />
                    );
                  })}
                  <Cell
                    width={COL.total}
                    text={formatMinutesToHours(weekTotalMinutes[row.field])}
                    style={paperBorder(border)}
                  />
                </View>
              ))}
            </View>
          );
        })}
      </View>
      </ScrollView>
    </View>
  );
}

function GreenPaper({ days }) {
  const border = '#2d6a2d';
  return (
    <View>
      <View style={styles.paperHeader}>
        <Text style={[styles.paperTitle, { color: border }]}>
          GREEN PAPER — TIME USED FOR PICKUP (SALARY PAID BY KILOS)
        </Text>
        <Text style={styles.paperSubtitle}>
          Not in use yet — berry picking season coming soon
        </Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator>
      <View style={[styles.table, paperBorder(border)]}>
        <View style={[styles.headerRow, { backgroundColor: '#e8f5e9' }]}>
          <HeaderCell width={COL.date} label="Date" style={paperBorder(border)} />
          <HeaderCell width={COL.time} label="Start" style={paperBorder(border)} />
          <HeaderCell width={COL.time} label="Finish" style={paperBorder(border)} />
          <HeaderCell width={COL.breakCol} label="Eating break" style={paperBorder(border)} />
          <HeaderCell width={COL.breakCol} label="Extra breaks" style={paperBorder(border)} />
          <HeaderCell width={COL.hours} label="Hours minus breaks" style={paperBorder(border)} />
          <HeaderCell width={COL.work} label="What was picked up" style={paperBorder(border)} />
        </View>
        {days.map((day) => (
          <View key={day} style={styles.row}>
            <Cell width={COL.date} text={String(day)} style={paperBorder(border)} />
            <Cell width={COL.time} text="" style={paperBorder(border)} />
            <Cell width={COL.time} text="" style={paperBorder(border)} />
            <Cell width={COL.breakCol} text="1 hour" style={paperBorder(border)} />
            <Cell width={COL.breakCol} text="" style={paperBorder(border)} />
            <Cell width={COL.hours} text="" style={paperBorder(border)} />
            <Cell width={COL.work} text="" style={paperBorder(border)} />
          </View>
        ))}
      </View>
      </ScrollView>
    </View>
  );
}

export default function PapersScreen() {
  const { worker } = useAuth();
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());
  const [entries, setEntries] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [paperType, setPaperType] = useState('white');

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

  const handleFieldSave = useCallback(
    async (date, field, value) => {
      await api.patch(`/api/timesheet/entry/${date}/field`, { field, value });
      await loadEntries();
    },
    [loadEntries]
  );

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

      <View style={styles.selector}>
        {PAPER_TYPES.map((p) => (
          <Pressable
            key={p.key}
            style={[
              styles.selectorButton,
              paperType === p.key && styles.selectorButtonActive,
            ]}
            onPress={() => setPaperType(p.key)}
          >
            <Text
              style={[
                styles.selectorText,
                paperType === p.key && styles.selectorTextActive,
              ]}
            >
              {p.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={styles.loading} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <ScrollView contentContainerStyle={styles.paperContainer}>
          {paperType === 'white' && (
            <WhitePaper
              days={days}
              year={year}
              month={month}
              entries={entries}
              onSave={handleFieldSave}
              worker={worker}
            />
          )}
          {paperType === 'orange' && (
            <OrangePaper
              days={days}
              year={year}
              month={month}
              entries={entries}
              onSave={handleFieldSave}
            />
          )}
          {paperType === 'weekly' && (
            <WeeklyPaper
              year={year}
              month={month}
              daysInMonth={daysInMonth}
              entries={entries}
            />
          )}
          {paperType === 'green' && <GreenPaper days={days} />}
        </ScrollView>
      )}
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
  selector: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  selectorButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  selectorButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  selectorText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.text,
  },
  selectorTextActive: {
    color: COLORS.white,
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
  paperContainer: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  paperHeader: {
    marginBottom: 10,
  },
  paperWorkerInfo: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.text,
    marginBottom: 6,
  },
  paperTitle: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  paperSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  table: {
    borderTopWidth: 1,
    borderLeftWidth: 1,
  },
  weekSpacing: {
    marginTop: 16,
  },
  headerRow: {
    flexDirection: 'row',
  },
  row: {
    flexDirection: 'row',
  },
  cell: {
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#333333',
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 38,
  },
  cellPressed: {
    backgroundColor: COLORS.surface,
  },
  headerCell: {
    paddingVertical: 6,
  },
  headerCellText: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: COLORS.text,
    textAlign: 'center',
  },
  cellText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.text,
    textAlign: 'center',
  },
  cellTextLeft: {
    textAlign: 'left',
    width: '100%',
  },
  cellInput: {
    width: '100%',
    padding: 0,
  },
});
