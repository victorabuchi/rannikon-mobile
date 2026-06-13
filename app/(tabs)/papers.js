import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  GreenPaperTable,
  OrangePaperTable,
  WeeklySummaryFull,
  WhitePaperTable,
} from '../../components/PaperTables';
import api from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { MONTH_NAMES, formatDate, getDaysInMonth } from '../../lib/dates';
import { exportPaperExcel, exportPaperPdf } from '../../lib/exporters';
import { COLORS, FONTS } from '../../lib/theme';
import { computeEntry } from '../../lib/timesheet';

const PAPER_TYPES = [
  { key: 'white', label: 'White Paper', sub: 'Work paid by hour' },
  { key: 'orange', label: 'Orange Paper', sub: 'Extrawork' },
  { key: 'weekly', label: 'Weekly Summary', sub: 'Mon to Sun totals' },
  { key: 'green', label: 'Green Paper', sub: 'Berry picking' },
];

function WorkerInfo({ worker }) {
  return (
    <Text style={styles.workerInfo}>
      Name: <Text style={styles.bold}>{worker?.full_name || '-'}</Text>     Work number:{' '}
      <Text style={styles.bold}>{worker?.work_number || '-'}</Text>
    </Text>
  );
}

export default function PapersScreen() {
  const { worker } = useAuth();
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());
  const [entries, setEntries] = useState({});
  const [greenEntries, setGreenEntries] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [paperType, setPaperType] = useState('white');
  const [exporting, setExporting] = useState(false);

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

  const handleFieldSave = useCallback(
    async (date, field, value) => {
      await api.patch(`/api/timesheet/entry/${date}/field`, { field, value });
      await loadEntries();
    },
    [loadEntries]
  );

  const handleGreenFieldSave = useCallback(
    async (date, field, value) => {
      await api.patch(`/api/green/entry/${date}/field`, { field, value });
      await loadGreenEntries();
    },
    [loadGreenEntries]
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

  const handleDownloadPdf = async () => {
    setExporting(true);
    try {
      await exportPaperPdf(paperType, { month, year, worker, entries, greenEntries, daysInMonth });
    } catch {
      Alert.alert('Export failed', 'Could not generate the PDF. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const handleDownloadExcel = async () => {
    setExporting(true);
    try {
      await exportPaperExcel(paperType, { month, year, worker, entries, greenEntries, daysInMonth });
    } catch {
      Alert.alert('Export failed', 'Could not generate the Excel file. Please try again.');
    } finally {
      setExporting(false);
    }
  };

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
            style={[styles.selectorButton, paperType === p.key && styles.selectorButtonActive]}
            onPress={() => setPaperType(p.key)}
          >
            <Text style={[styles.selectorText, paperType === p.key && styles.selectorTextActive]}>
              {p.label}
            </Text>
            <Text style={[styles.selectorSub, paperType === p.key && styles.selectorSubActive]}>
              {p.sub}
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
            <View>
              <Text style={styles.title}>WORK PAID BY THE HOUR</Text>
              <Text style={styles.subtitle}>8 HOURS PER DAY / 40 HOURS PER WEEK</Text>
              <WorkerInfo worker={worker} />
              <ScrollView horizontal showsHorizontalScrollIndicator style={styles.table}>
                <WhitePaperTable
                  days={days}
                  year={year}
                  month={month}
                  entries={entries}
                  editable
                  onSave={handleFieldSave}
                />
              </ScrollView>
              <Text style={styles.footerItalic}>
                When you have worked 4 hours, You need to have an eating break, minimum of 30 mins.
              </Text>
              <Text style={styles.footerItalic}>
                START WORK 9:00, 9:15, 9:30 or 9:45. WORK DOES NOT START 9:05, 9:10, 9:20, 9:25 etc.
              </Text>
            </View>
          )}

          {paperType === 'orange' && (
            <View>
              <Text style={[styles.title, { color: '#b45309' }]}>EXTRAWORK PAID BY THE HOUR</Text>
              <Text style={styles.subtitle}>MAXIMUM 3 HOURS PER DAY (MONDAY-FRIDAY)</Text>
              <Text style={styles.subtitle}>MAXIMUM 11 HOURS PER DAY (SATURDAY)</Text>
              <WorkerInfo worker={worker} />
              <ScrollView horizontal showsHorizontalScrollIndicator style={styles.table}>
                <OrangePaperTable
                  days={days}
                  year={year}
                  month={month}
                  entries={entries}
                  editable
                  onSave={handleFieldSave}
                />
              </ScrollView>
              <Text style={styles.footerItalic}>
                Start work 9:00, 9:15, 9:30 or 9:45. Work does not start 9:05, 9:10, 9:20, 9:25 etc.
              </Text>
            </View>
          )}

          {paperType === 'weekly' && (
            <View>
              <Text style={[styles.title, { color: '#1565c0' }]}>WEEKLY SUMMARY</Text>
              <WorkerInfo worker={worker} />
              <ScrollView horizontal showsHorizontalScrollIndicator style={styles.table}>
                <WeeklySummaryFull
                  year={year}
                  month={month}
                  daysInMonth={daysInMonth}
                  entries={entries}
                  onSave={handleFieldSave}
                />
              </ScrollView>
            </View>
          )}

          {paperType === 'green' && (
            <View>
              <Text style={[styles.title, { color: '#2d6a2d' }]}>
                TIME USED FOR PICKUP, SALARY IS PAID BY KILOS
              </Text>
              <Text style={styles.subtitle}>8 HOURS PER DAY / 40 HOURS PER WEEK</Text>
              <Text style={[styles.subtitle, { color: '#c0392b' }]}>
                HOX, NEED TO PICKUP 10 KILO PER HOUR!
              </Text>
              <WorkerInfo worker={worker} />
              <ScrollView horizontal showsHorizontalScrollIndicator style={styles.table}>
                <GreenPaperTable
                  days={days}
                  year={year}
                  month={month}
                  greenEntries={greenEntries}
                  editable
                  onSave={handleGreenFieldSave}
                />
              </ScrollView>
              <Text style={styles.footerItalic}>
                When you have worked 4 hours, You need to have an eating break, minimum of 30 mins.
              </Text>
              <Text style={styles.footerItalic}>
                START WORK 9:00, 9:15, 9:30 or 9:45. WORK DOES NOT START 9:05, 9:10, 9:20, 9:25 etc.
              </Text>
            </View>
          )}

          <View style={styles.downloadRow}>
            <Pressable
              style={({ pressed }) => [styles.downloadButton, pressed && styles.downloadButtonPressed]}
              onPress={handleDownloadPdf}
              disabled={exporting}
            >
              <View style={[styles.iconBox, { backgroundColor: '#E53935' }]}>
                <Text style={styles.iconText}>PDF</Text>
              </View>
              <Text style={styles.downloadButtonText}>Download PDF</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.downloadButton, pressed && styles.downloadButtonPressed]}
              onPress={handleDownloadExcel}
              disabled={exporting}
            >
              <View style={[styles.iconBox, { backgroundColor: '#217346' }]}>
                <Text style={styles.iconText}>XLS</Text>
              </View>
              <Text style={styles.downloadButtonText}>Download Excel</Text>
            </Pressable>
            {exporting && <ActivityIndicator size="small" color={COLORS.primary} />}
          </View>
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
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
    backgroundColor: '#f5f5f5',
    borderBottomWidth: 1,
    borderBottomColor: '#cccccc',
  },
  selectorButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#dddddd',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 4,
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  selectorButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  selectorText: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: '#333333',
    textAlign: 'center',
  },
  selectorTextActive: {
    color: COLORS.white,
  },
  selectorSub: {
    fontFamily: FONTS.regular,
    fontSize: 10,
    color: '#aaaaaa',
    marginTop: 2,
    textAlign: 'center',
  },
  selectorSubActive: {
    color: '#cfffcf',
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
    padding: 16,
    paddingBottom: 32,
  },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: COLORS.text,
    marginBottom: 2,
  },
  subtitle: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: COLORS.text,
    marginBottom: 2,
  },
  workerInfo: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: '#333333',
    marginTop: 6,
    marginBottom: 10,
  },
  bold: {
    fontFamily: FONTS.bold,
  },
  table: {
    marginBottom: 4,
  },
  footerItalic: {
    fontFamily: FONTS.regular,
    fontStyle: 'italic',
    fontSize: 11,
    color: '#555555',
    marginTop: 8,
  },
  downloadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eeeeee',
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#cccccc',
    borderRadius: 5,
    backgroundColor: COLORS.background,
  },
  downloadButtonPressed: {
    backgroundColor: COLORS.surface,
  },
  iconBox: {
    width: 16,
    height: 16,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontFamily: FONTS.bold,
    fontSize: 6,
    color: COLORS.white,
  },
  downloadButtonText: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: '#333333',
  },
});
