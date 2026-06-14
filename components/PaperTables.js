import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { formatDate } from '../lib/dates';
import { blankIfZeroHours, hasOrangeWork, minsToHHMM, parseHoursToMinutes } from '../lib/timesheet';
import { COLORS, FONTS } from '../lib/theme';

export const COL = {
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

export const PAPER_COLORS = {
  white: { border: '#333333', header: '#e0e0e0' },
  orange: { border: '#c97d00', header: '#ffe0a0', cell: '#fffbf0' },
  blue: { border: '#1565c0', header: '#bbdefb', cell: '#f0f7ff' },
  green: { border: '#2d6a2d', header: '#e8f5e9' },
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Mirrors the week chunking in PapersFullView's weekly tab: consecutive
// 7-day blocks starting at day 1, capped at 4 weeks — not Mon-Sun aligned.
export function getWeekChunks(year, month, daysInMonth) {
  const weekCount = Math.min(Math.ceil(daysInMonth / 7), 4);
  return Array.from({ length: weekCount }, (_, weekIdx) => {
    const weekStart = weekIdx * 7 + 1;
    return Array.from({ length: 7 }, (_, i) => {
      const day = weekStart + i;
      const exists = day <= daysInMonth;
      const dow = exists ? new Date(year, month - 1, day).getDay() : null;
      return {
        day,
        exists,
        dow,
        name: dow !== null ? DAY_NAMES[dow] : '',
        isSun: dow === 0,
        isSat: dow === 6,
      };
    });
  });
}

export function Cell({ width, text, sub, align = 'center', style, textStyle }) {
  return (
    <View style={[styles.cell, { width }, style]}>
      <Text
        style={[styles.cellText, align === 'left' && styles.cellTextLeft, textStyle]}
        numberOfLines={1}
      >
        {text ?? ''}
      </Text>
      {!!sub && (
        <Text style={styles.cellSub} numberOfLines={1}>
          {sub}
        </Text>
      )}
    </View>
  );
}

export function HeaderCell({ width, label, sub, style, textStyle }) {
  return (
    <View style={[styles.cell, styles.headerCell, { width }, style]}>
      {!!label && (
        <Text style={[styles.headerCellText, textStyle]} numberOfLines={2}>
          {label}
        </Text>
      )}
      {!!sub && (
        <Text style={styles.headerCellSub} numberOfLines={1}>
          {sub}
        </Text>
      )}
    </View>
  );
}

export function EditableCell({
  width,
  value,
  editable,
  onSave,
  align = 'center',
  keyboardType = 'default',
  style,
  textStyle,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value != null ? String(value) : '');

  useEffect(() => {
    if (!editing) {
      setDraft(value != null ? String(value) : '');
    }
  }, [value, editing]);

  if (!editable) {
    return <Cell width={width} text={value} align={align} style={style} textStyle={textStyle} />;
  }

  if (editing) {
    return (
      <View style={[styles.cell, { width }, style]}>
        <TextInput
          style={[
            styles.cellText,
            styles.cellInput,
            align === 'left' && styles.cellTextLeft,
            textStyle,
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
      style={({ pressed }) => [styles.cell, { width }, style, pressed && styles.cellPressed]}
      onPress={() => setEditing(true)}
    >
      <Text
        style={[styles.cellText, align === 'left' && styles.cellTextLeft, textStyle]}
        numberOfLines={1}
      >
        {value != null && value !== '' ? String(value) : ''}
      </Text>
    </Pressable>
  );
}

export function WhitePaperTable({ days, year, month, entries, editable = false, onSave }) {
  const c = PAPER_COLORS.white;
  const border = { borderColor: c.border };
  return (
    <View style={[styles.table, border]}>
      <View style={[styles.headerRow, { backgroundColor: c.header }]}>
        <HeaderCell width={COL.date} label="Date" style={border} />
        <HeaderCell width={COL.time} label="Start" style={border} />
        <HeaderCell width={COL.time} label="Finish" style={border} />
        <HeaderCell width={COL.breakCol} label="Must have Eating break" style={border} />
        <HeaderCell width={COL.hours} label="Hours minus breaks" style={border} />
        <HeaderCell width={COL.work} label="What work" style={border} />
      </View>
      {days.map((day) => {
        const date = formatDate(year, month, day);
        const entry = entries[date];
        const hasEntry = !!entry;
        return (
          <View
            key={date}
            style={[styles.row, { backgroundColor: hasEntry ? '#fafafa' : '#ffffff' }]}
          >
            <Cell width={COL.date} text={String(day)} textStyle={styles.bold} style={border} />
            <EditableCell
              width={COL.time}
              value={entry?.white_start?.slice(0, 5)}
              editable={editable && hasEntry}
              onSave={(v) => onSave(date, 'white_start', v)}
              style={border}
            />
            <EditableCell
              width={COL.time}
              value={entry?.white_finish?.slice(0, 5)}
              editable={editable && hasEntry}
              onSave={(v) => onSave(date, 'white_finish', v)}
              style={border}
            />
            <Cell width={COL.breakCol} text="30 min" style={border} />
            <EditableCell
              width={COL.hours}
              value={hasEntry ? entry.white_hours || '8:00' : ''}
              editable={editable && hasEntry}
              onSave={(v) => onSave(date, 'white_hours', v)}
              keyboardType="decimal-pad"
              textStyle={hasEntry && { fontWeight: '700', color: '#2d6a2d' }}
              style={border}
            />
            <EditableCell
              width={COL.work}
              value={entry?.what_work}
              editable={editable && hasEntry}
              onSave={(v) => onSave(date, 'what_work', v)}
              align="left"
              style={border}
            />
          </View>
        );
      })}
    </View>
  );
}

export function OrangePaperTable({ days, year, month, entries, editable = false, onSave }) {
  const c = PAPER_COLORS.orange;
  const cellStyle = { borderColor: c.border, backgroundColor: c.cell };
  return (
    <View style={[styles.table, { borderColor: c.border }]}>
      <View style={[styles.headerRow, { backgroundColor: c.header }]}>
        <HeaderCell width={COL.date} label="Date" style={{ borderColor: c.border }} />
        <HeaderCell width={COL.time} label="Start" style={{ borderColor: c.border }} />
        <HeaderCell width={COL.time} label="Finish" style={{ borderColor: c.border }} />
        <HeaderCell width={COL.breakCol} label="Break" style={{ borderColor: c.border }} />
        <HeaderCell width={COL.hours} label="Hours minus breaks" style={{ borderColor: c.border }} />
        <HeaderCell width={COL.work} label="What work" style={{ borderColor: c.border }} />
        <HeaderCell width={COL.sig} label="Signature" style={{ borderColor: c.border }} />
      </View>
      {days.map((day) => {
        const date = formatDate(year, month, day);
        const entry = entries[date];
        const hasOrange = hasOrangeWork(entry);
        return (
          <View key={date} style={styles.row}>
            <Cell width={COL.date} text={String(day)} textStyle={styles.bold} style={cellStyle} />
            <EditableCell
              width={COL.time}
              value={hasOrange ? entry.orange_start?.slice(0, 5) : ''}
              editable={editable && hasOrange}
              onSave={(v) => onSave(date, 'orange_start', v)}
              style={cellStyle}
            />
            <EditableCell
              width={COL.time}
              value={hasOrange ? entry.orange_finish?.slice(0, 5) : ''}
              editable={editable && hasOrange}
              onSave={(v) => onSave(date, 'orange_finish', v)}
              style={cellStyle}
            />
            <Cell width={COL.breakCol} text={hasOrange ? blankIfZeroHours(entry.orange_break) : ''} style={cellStyle} />
            <EditableCell
              width={COL.hours}
              value={hasOrange ? entry.orange_hours : ''}
              editable={editable && hasOrange}
              onSave={(v) => onSave(date, 'orange_hours', v)}
              keyboardType="decimal-pad"
              textStyle={hasOrange && { fontWeight: '700', color: '#b45309' }}
              style={cellStyle}
            />
            <EditableCell
              width={COL.work}
              value={hasOrange ? entry.what_work : ''}
              editable={editable && hasOrange}
              onSave={(v) => onSave(date, 'what_work', v)}
              align="left"
              style={cellStyle}
            />
            <Cell width={COL.sig} text="" style={cellStyle} />
          </View>
        );
      })}
    </View>
  );
}

export function GreenPaperTable({ days, year, month, greenEntries, editable = false, onSave }) {
  const c = PAPER_COLORS.green;
  const border = { borderColor: c.border };
  return (
    <View style={[styles.table, border]}>
      <View style={[styles.headerRow, { backgroundColor: c.header }]}>
        <HeaderCell width={COL.date} label="Date" style={border} />
        <HeaderCell width={COL.time} label="Start" style={border} />
        <HeaderCell width={COL.time} label="Finish" style={border} />
        <HeaderCell width={COL.breakCol} label="Must have Eating break" style={border} />
        <HeaderCell width={COL.breakCol} label="Extra Breaks" style={border} />
        <HeaderCell width={COL.hours} label="Hours minus breaks" style={border} />
        <HeaderCell width={COL.work} label="What was picked up" style={border} />
        <HeaderCell width={COL.hours} label="Kg picked" style={border} />
      </View>
      {days.map((day) => {
        const date = formatDate(year, month, day);
        const ge = greenEntries?.[date];
        const hasEntry = !!ge;
        return (
          <View key={date} style={[styles.row, { backgroundColor: hasEntry ? '#f6fff6' : '#ffffff' }]}>
            <Cell width={COL.date} text={String(day)} textStyle={styles.bold} style={border} />
            <EditableCell
              width={COL.time}
              value={ge?.start_time?.slice(0, 5)}
              editable={editable && hasEntry}
              onSave={(v) => onSave(date, 'start_time', v)}
              style={border}
            />
            <EditableCell
              width={COL.time}
              value={ge?.finish_time?.slice(0, 5)}
              editable={editable && hasEntry}
              onSave={(v) => onSave(date, 'finish_time', v)}
              style={border}
            />
            <Cell width={COL.breakCol} text="1 hour" textStyle={{ color: '#888888' }} style={border} />
            <Cell width={COL.breakCol} text="" style={border} />
            <Cell width={COL.hours} text="" style={border} />
            <EditableCell
              width={COL.work}
              value={ge?.what_picked}
              editable={editable && hasEntry}
              onSave={(v) => onSave(date, 'what_picked', v)}
              align="left"
              style={border}
            />
            <EditableCell
              width={COL.hours}
              value={ge?.kg_picked != null ? String(ge.kg_picked) : ''}
              editable={editable && hasEntry}
              onSave={(v) => onSave(date, 'kg_picked', v)}
              keyboardType="decimal-pad"
              textStyle={hasEntry && ge.kg_picked != null && { fontWeight: '700', color: '#2d6a2d' }}
              style={border}
            />
          </View>
        );
      })}
    </View>
  );
}

const WEEK_DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thur', 'Fri', 'Sat (max 11)', 'Sun'];

// The fixed Mon-Sun summary shown inline below a single day on the Days tab —
// mirrors InlineDayView's weekly summary table (only the Total column and the
// Sun column carry values; the rest of the grid is intentionally blank).
export function InlineWeeklySummary({ entry }) {
  const c = PAPER_COLORS.blue;
  const border = { borderColor: c.border };
  return (
    <View style={[styles.table, border]}>
      <View style={[styles.headerRow, { backgroundColor: c.header }]}>
        <HeaderCell width={COL.type} label="Type" style={border} />
        {WEEK_DAY_LABELS.map((label) => (
          <HeaderCell key={label} width={COL.day} label={label} style={border} />
        ))}
        <HeaderCell width={COL.total} label="Total hours" style={border} />
      </View>
      <InlineWeekRow label="Working hours (max 8)" value={entry.white_hours} valueColor="#2d6a2d" border={border} />
      <InlineWeekRow label="Extra hours (max 3)" value={entry.orange_hours} valueColor="#b45309" border={border} />
      <InlineWeekRow label="Total" value={entry.total_hours} valueColor="#1565c0" border={border} highlight />
    </View>
  );
}

function InlineWeekRow({ label, value, valueColor, border, highlight }) {
  return (
    <View style={[styles.row, highlight && { backgroundColor: '#e3f2fd' }]}>
      <Cell width={COL.type} text={label} align="left" textStyle={styles.bold} style={border} />
      {Array.from({ length: 6 }).map((_, i) => (
        <Cell key={i} width={COL.day} text="" style={border} />
      ))}
      <Cell width={COL.day} text="X" textStyle={{ color: '#999999' }} style={border} />
      <Cell width={COL.total} text={value} textStyle={{ fontWeight: '700', color: valueColor }} style={border} />
    </View>
  );
}

// The full Weekly Summary on the Papers tab — pickup/working/extra rows with
// editable hours, plus a signature row, mirroring PapersFullView's weekly tab.
export function WeeklySummaryFull({ year, month, daysInMonth, entries, greenEntries, onSave }) {
  const weeks = getWeekChunks(year, month, daysInMonth);
  const border = { borderColor: '#333333' };
  const totalWidth = COL.type + COL.day * 7 + COL.total;

  return (
    <View>
      {weeks.map((weekDays, weekIdx) => {
        let totalWorking = 0;
        let totalExtra = 0;
        let totalKg = 0;
        weekDays.forEach((info) => {
          if (!info.exists || info.isSun) return;
          const date = formatDate(year, month, info.day);
          const entry = entries[date];
          if (entry) {
            totalWorking += parseHoursToMinutes(entry.white_hours);
            totalExtra += parseHoursToMinutes(entry.orange_hours);
          }
          const ge = greenEntries?.[date];
          if (ge?.kg_picked != null) totalKg += Number(ge.kg_picked) || 0;
        });

        return (
          <View key={weekIdx} style={weekIdx > 0 && styles.weekSpacing}>
            <Text style={styles.weekLabel}>Week {weekIdx + 1}</Text>
            <View style={[styles.table, border]}>
              <View style={[styles.headerRow, { backgroundColor: '#e0e0e0' }]}>
                <HeaderCell width={COL.type} label="" style={[border, { backgroundColor: '#d0d0d0' }]} />
                {weekDays.map((info, i) => (
                  <HeaderCell
                    key={i}
                    width={COL.day}
                    label={info.name}
                    sub={info.exists && !info.isSun ? (info.isSat ? 'max 11' : 'max 3') : ''}
                    style={[border, { backgroundColor: info.isSun ? '#e8e8e8' : '#e0e0e0' }]}
                    textStyle={{ color: info.isSun ? '#999999' : '#1a1a18' }}
                  />
                ))}
                <HeaderCell width={COL.total} label="total" sub="hours" style={[border, { backgroundColor: '#d0d0d0' }]} />
              </View>

              <View style={styles.row}>
                <Cell
                  width={COL.type}
                  text="Berry picking (kg)"
                  align="left"
                  textStyle={{ fontWeight: '700', color: '#2d6a2d' }}
                  style={{ borderColor: '#2d6a2d', backgroundColor: '#e8f5e9' }}
                />
                {weekDays.map((info, i) => {
                  if (info.isSun) {
                    return (
                      <Cell
                        key={i}
                        width={COL.day}
                        text="X"
                        textStyle={{ fontWeight: '700', color: '#bbbbbb' }}
                        style={{ borderColor: '#2d6a2d', backgroundColor: '#e8f5e9' }}
                      />
                    );
                  }
                  const ge = greenEntries?.[formatDate(year, month, info.day)];
                  return (
                    <Cell
                      key={i}
                      width={COL.day}
                      text={ge?.kg_picked != null ? String(ge.kg_picked) : ''}
                      textStyle={{ fontWeight: '700', color: '#2d6a2d' }}
                      style={{ borderColor: '#2d6a2d', backgroundColor: '#e8f5e9' }}
                    />
                  );
                })}
                <Cell
                  width={COL.total}
                  text={totalKg > 0 ? String(Math.round(totalKg * 100) / 100) : ''}
                  sub="kg"
                  textStyle={{ fontWeight: '700', color: '#2d6a2d' }}
                  style={{ borderColor: '#2d6a2d', backgroundColor: '#e8f5e9' }}
                />
              </View>

              <View style={styles.row}>
                <Cell
                  width={COL.type}
                  text="working hours"
                  sub="max 8"
                  align="left"
                  textStyle={{ fontWeight: '700' }}
                  style={[border, { backgroundColor: '#fafafa' }]}
                />
                {weekDays.map((info, i) => {
                  if (info.isSun) {
                    return (
                      <Cell
                        key={i}
                        width={COL.day}
                        text="X"
                        textStyle={{ color: '#bbbbbb' }}
                        style={[border, { backgroundColor: '#fafafa' }]}
                      />
                    );
                  }
                  const date = formatDate(year, month, info.day);
                  const entry = entries[date];
                  if (!entry) {
                    return <Cell key={i} width={COL.day} text="" style={[border, { backgroundColor: '#fafafa' }]} />;
                  }
                  return (
                    <EditableCell
                      key={i}
                      width={COL.day}
                      value={entry.white_hours || '8:00'}
                      editable
                      onSave={(v) => onSave(date, 'white_hours', v)}
                      keyboardType="decimal-pad"
                      textStyle={{ fontWeight: '700', color: '#1a1a18' }}
                      style={[border, { backgroundColor: '#fafafa' }]}
                    />
                  );
                })}
                <Cell
                  width={COL.total}
                  text={minsToHHMM(totalWorking)}
                  sub="max 40"
                  textStyle={{ fontWeight: '700' }}
                  style={[border, { backgroundColor: '#fafafa' }]}
                />
              </View>

              <View style={styles.row}>
                <Cell
                  width={COL.type}
                  text="extra hours / lisätyö"
                  align="left"
                  textStyle={{ fontWeight: '700', color: '#b45309' }}
                  style={{ borderColor: '#c97d00', backgroundColor: '#fff3e0' }}
                />
                {weekDays.map((info, i) => {
                  if (info.isSun) {
                    return (
                      <Cell
                        key={i}
                        width={COL.day}
                        text="X"
                        textStyle={{ color: '#bbbbbb' }}
                        style={{ borderColor: '#c97d00', backgroundColor: '#fff3e0' }}
                      />
                    );
                  }
                  const date = formatDate(year, month, info.day);
                  const entry = entries[date];
                  if (!entry) {
                    return (
                      <Cell
                        key={i}
                        width={COL.day}
                        text=""
                        style={{ borderColor: '#c97d00', backgroundColor: '#fff3e0' }}
                      />
                    );
                  }
                  return (
                    <EditableCell
                      key={i}
                      width={COL.day}
                      value={blankIfZeroHours(entry.orange_hours)}
                      editable
                      onSave={(v) => onSave(date, 'orange_hours', v)}
                      keyboardType="decimal-pad"
                      textStyle={{ fontWeight: '700', color: '#b45309' }}
                      style={{ borderColor: '#c97d00', backgroundColor: '#fff3e0' }}
                    />
                  );
                })}
                <Cell
                  width={COL.total}
                  text={minsToHHMM(totalExtra)}
                  sub="max 17/week"
                  textStyle={{ fontWeight: '700', color: '#b45309' }}
                  style={{ borderColor: '#c97d00', backgroundColor: '#fff3e0' }}
                />
              </View>

              <View style={styles.row}>
                <View style={[styles.cell, styles.signatureCell, border, { width: totalWidth }]}>
                  <Text style={styles.cellText} numberOfLines={1}>
                    yes, I want to work extra hours   ☐   Signature: _______________________
                  </Text>
                </View>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  table: {
    borderTopWidth: 1,
    borderLeftWidth: 1,
  },
  weekSpacing: {
    marginTop: 16,
  },
  weekLabel: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: COLORS.text,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
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
  headerCellSub: {
    fontFamily: FONTS.regular,
    fontSize: 9,
    color: '#888888',
    marginTop: 2,
    textAlign: 'center',
  },
  cellText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.text,
    textAlign: 'center',
  },
  cellSub: {
    fontFamily: FONTS.regular,
    fontSize: 9,
    color: '#888888',
    marginTop: 2,
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
  bold: {
    fontWeight: '700',
  },
  signatureCell: {
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#ffffff',
  },
});
