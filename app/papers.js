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
import { SafeAreaView } from 'react-native-safe-area-context';

import DashboardViewSwitcher from '../components/DashboardViewSwitcher';
import {
  GreenPaperTable,
  OrangePaperTable,
  WeeklySummaryFull,
  WhitePaperTable,
} from '../components/PaperTables';
import PageHeader from '../components/PageHeader';
import api from '../lib/api';
import { useAuth } from '../lib/auth';
import { MONTH_NAMES, formatDate, getDaysInMonth } from '../lib/dates';
import { exportPaperExcel, exportPaperPdf } from '../lib/exporters';
import { useLanguage } from '../lib/i18n';
import { COLORS, FONTS } from '../lib/theme';
import { computeEntry } from '../lib/timesheet';

const SUBMISSION_STATUS_STYLE = {
  submitted: { bg: '#e3f2fd', text: '#1565c0' },
  approved: { bg: '#e8f5e9', text: '#2d6a2d' },
  rejected: { bg: '#fdecea', text: '#c0392b' },
  needs_review: { bg: '#fff3e0', text: '#e65100' },
  default: { bg: '#f5f5f5', text: '#555555' },
};

function statusKeySuffix(status) {
  return {
    submitted: 'Submitted',
    approved: 'Approved',
    rejected: 'Rejected',
    needs_review: 'NeedsReview',
  }[status] || 'Submitted';
}

const VERIFY_STATUS_STYLE = {
  verified: { bg: '#e8f5e9', text: '#2d6a2d', labelKey: 'verifiedStatus' },
  discrepancies_found: { bg: '#fdecea', text: '#c0392b', labelKey: 'discrepanciesFound' },
  incomplete: { bg: '#fff3e0', text: '#e65100', labelKey: 'noSupervisorDataYet' },
};

const MATCH_STATUS_STYLE = {
  match: { bg: '#e8f5e9', text: '#2d6a2d', labelKey: 'verifyStatusMatch' },
  mismatch: { bg: '#fdecea', text: '#c0392b', labelKey: 'verifyStatusMismatch' },
  missing_supervisor: { bg: '#fff3e0', text: '#e65100', labelKey: 'verifyStatusMissingSupervisor' },
  missing_worker: { bg: '#f3f3f3', text: '#666666', labelKey: 'verifyStatusMissingWorker' },
  default: { bg: '#ffffff', text: '#333333', labelKey: 'verifyStatusMismatch' },
};

const PAPER_TYPES = [
  { key: 'white', labelKey: 'papers.whitePaper', subKey: 'papers.workPaidByHourSub' },
  { key: 'orange', labelKey: 'papers.orangePaper', subKey: 'papers.extraworkSub' },
  { key: 'weekly', labelKey: 'papers.weeklySummary', subKey: 'papers.monToSunSub' },
  { key: 'green', labelKey: 'papers.greenPaper', subKey: 'papers.berryPickingSub' },
];

function WorkerInfo({ worker }) {
  const { t } = useLanguage();
  return (
    <Text style={styles.workerInfo}>
      {t('papers.name')}: <Text style={styles.bold}>{worker?.full_name || '-'}</Text>     {t('papers.workNumber')}:{' '}
      <Text style={styles.bold}>{worker?.work_number || '-'}</Text>
    </Text>
  );
}

export default function PapersScreen() {
  const { worker } = useAuth();
  const { t } = useLanguage();
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());
  const [entries, setEntries] = useState({});
  const [greenEntries, setGreenEntries] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [paperType, setPaperType] = useState('white');
  const [exporting, setExporting] = useState(false);

  const [payrollPapers, setPayrollPapers] = useState([]);
  const [payrollNotes, setPayrollNotes] = useState('');
  const [payrollSubmitting, setPayrollSubmitting] = useState(false);
  const [payrollSuccess, setPayrollSuccess] = useState('');
  const [payrollError, setPayrollError] = useState('');
  const [mySubmissions, setMySubmissions] = useState([]);

  const [selfVerifyResult, setSelfVerifyResult] = useState(null);
  const [selfVerifying, setSelfVerifying] = useState(false);
  const [selfVerifyError, setSelfVerifyError] = useState('');

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
      setError(t('papers.loadError'));
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

  const loadMySubmissions = useCallback(async () => {
    try {
      const { data } = await api.get('/api/timesheet/my-submissions');
      setMySubmissions(data.submissions || []);
    } catch {
      // keep previous submissions on transient errors
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    loadEntries();
    loadGreenEntries();
    loadMySubmissions();
  }, [loadEntries, loadGreenEntries, loadMySubmissions]);

  useEffect(() => {
    setSelfVerifyResult(null);
    setSelfVerifyError('');
  }, [month, year]);

  const togglePayrollPaper = (key) => {
    setPayrollPapers((prev) => (prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]));
  };

  const submitToPayroll = async () => {
    if (!payrollPapers.length) {
      setPayrollError(t('papers.selectAtLeastOnePaper'));
      return;
    }
    setPayrollError('');
    setPayrollSuccess('');
    setPayrollSubmitting(true);
    try {
      await api.post('/api/timesheet/submit-to-payroll', {
        month,
        year,
        papers: payrollPapers,
        notes: payrollNotes,
      });
      setPayrollSuccess(`${t('papers.submittedForPrefix')} ${MONTH_NAMES[month - 1]} ${year}`);
      setPayrollNotes('');
      await loadMySubmissions();
    } catch (e) {
      setPayrollError(e.response?.data?.error || t('papers.submitToPayrollFailed'));
    } finally {
      setPayrollSubmitting(false);
    }
  };

  const runSelfVerify = async () => {
    setSelfVerifying(true);
    setSelfVerifyError('');
    try {
      const { data } = await api.get(`/api/timesheet/self-verify/${month}/${year}`);
      setSelfVerifyResult(data);
    } catch (e) {
      setSelfVerifyError(e.response?.data?.error || t('papers.verificationFailed'));
    } finally {
      setSelfVerifying(false);
    }
  };

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
      Alert.alert(t('common.exportFailed'), t('common.exportPdfError'));
    } finally {
      setExporting(false);
    }
  };

  const handleDownloadExcel = async () => {
    setExporting(true);
    try {
      await exportPaperExcel(paperType, { month, year, worker, entries, greenEntries, daysInMonth });
    } catch {
      Alert.alert(t('common.exportFailed'), t('common.exportExcelError'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <PageHeader title={t('tabs.papers')} />
      <DashboardViewSwitcher active="papers" showRequests />
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
              {t(p.labelKey)}
            </Text>
            <Text style={[styles.selectorSub, paperType === p.key && styles.selectorSubActive]}>
              {t(p.subKey)}
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
              <Text style={styles.title}>{t('papers.workPaidByHour')}</Text>
              <Text style={styles.subtitle}>{t('papers.hoursPerDayWeek')}</Text>
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
              <Text style={styles.footerItalic}>{t('papers.eatingBreakShort')}</Text>
              <Text style={styles.footerItalic}>{t('papers.startWorkCaps')}</Text>
            </View>
          )}

          {paperType === 'orange' && (
            <View>
              <Text style={[styles.title, { color: '#b45309' }]}>{t('papers.extraWorkPaidByHour')}</Text>
              <Text style={styles.subtitle}>{t('papers.maxHoursWeekday')}</Text>
              <Text style={styles.subtitle}>{t('papers.maxHoursSaturday')}</Text>
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
              <Text style={styles.footerItalic}>{t('papers.startWorkNote')}</Text>
            </View>
          )}

          {paperType === 'weekly' && (
            <View>
              <Text style={[styles.title, { color: '#1565c0' }]}>{t('papers.weeklySummaryTitle')}</Text>
              <WorkerInfo worker={worker} />
              <ScrollView horizontal showsHorizontalScrollIndicator style={styles.table}>
                <WeeklySummaryFull
                  year={year}
                  month={month}
                  daysInMonth={daysInMonth}
                  entries={entries}
                  greenEntries={greenEntries}
                  onSave={handleFieldSave}
                />
              </ScrollView>
            </View>
          )}

          {paperType === 'green' && (
            <View>
              <Text style={[styles.title, { color: '#2d6a2d' }]}>{t('papers.greenPaperTitle')}</Text>
              <Text style={styles.subtitle}>{t('papers.hoursPerDayWeek')}</Text>
              <Text style={[styles.subtitle, { color: '#c0392b' }]}>{t('papers.kiloPerHourNote')}</Text>
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
              <Text style={styles.footerItalic}>{t('papers.eatingBreakShort')}</Text>
              <Text style={styles.footerItalic}>{t('papers.startWorkCaps')}</Text>
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
              <Text style={styles.downloadButtonText}>{t('common.downloadPDF')}</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.downloadButton, pressed && styles.downloadButtonPressed]}
              onPress={handleDownloadExcel}
              disabled={exporting}
            >
              <View style={[styles.iconBox, { backgroundColor: '#217346' }]}>
                <Text style={styles.iconText}>XLS</Text>
              </View>
              <Text style={styles.downloadButtonText}>{t('common.downloadExcel')}</Text>
            </Pressable>
            {exporting && <ActivityIndicator size="small" color={COLORS.primary} />}
          </View>

          <View style={styles.sectionCard}>
            <View style={[styles.sectionHeader, { backgroundColor: COLORS.primary }]}>
              <Text style={styles.sectionHeaderText}>{t('papers.submitToPayrollTitle')}</Text>
            </View>
            <View style={styles.sectionBody}>
              <View style={styles.submittingForRow}>
                <Text style={styles.submittingForLabel}>{t('papers.submittingFor')}</Text>
                <View style={styles.monthPill}>
                  <Text style={styles.monthPillText}>{MONTH_NAMES[month - 1]} {year}</Text>
                </View>
                <Text style={styles.navigateHint}>{t('papers.navigateMonthsHint')}</Text>
              </View>

              <Text style={styles.fieldLabel}>{t('papers.papersToInclude')}</Text>
              <View style={styles.checkboxRow}>
                {[
                  ['white', t('papers.whitePaper')],
                  ['orange', t('papers.orangePaper')],
                  ['weekly', t('papers.weeklySummaryOption')],
                  ['green', t('papers.greenPaper')],
                ].map(([key, label]) => {
                  const checked = payrollPapers.includes(key);
                  return (
                    <Pressable
                      key={key}
                      style={[styles.checkboxChip, checked && styles.checkboxChipActive]}
                      onPress={() => togglePayrollPaper(key)}
                    >
                      <Text style={[styles.checkboxChipText, checked && styles.checkboxChipTextActive]}>
                        {checked ? '☑' : '☐'} {label}
                      </Text>
                    </Pressable>
                  );
                })}
                <Pressable
                  style={styles.checkboxChip}
                  onPress={() =>
                    setPayrollPapers((prev) =>
                      prev.length === 4 ? [] : ['white', 'orange', 'weekly', 'green']
                    )
                  }
                >
                  <Text style={styles.checkboxChipText}>
                    {payrollPapers.length === 4 ? '☑' : '☐'} {t('papers.selectAll')}
                  </Text>
                </Pressable>
              </View>

              <Text style={styles.fieldLabel}>{t('papers.notesForPayroll')}</Text>
              <TextInput
                style={[styles.notesInput]}
                placeholder={t('papers.notesPlaceholder')}
                placeholderTextColor={COLORS.textMuted}
                value={payrollNotes}
                onChangeText={setPayrollNotes}
                multiline
              />

              {!!payrollError && <Text style={styles.sectionError}>{payrollError}</Text>}
              {!!payrollSuccess && (
                <View style={styles.successBanner}>
                  <Text style={styles.successBannerText}>✓ {payrollSuccess}</Text>
                </View>
              )}

              <Pressable
                style={[
                  styles.primaryButton,
                  (payrollSubmitting || !payrollPapers.length) && styles.buttonDisabled,
                ]}
                onPress={submitToPayroll}
                disabled={payrollSubmitting || !payrollPapers.length}
              >
                <Text style={styles.primaryButtonText}>
                  {payrollSubmitting ? t('papers.submittingToPayroll') : t('papers.submitToPayroll')}
                </Text>
              </Pressable>

              {mySubmissions.length > 0 && (
                <View style={styles.previousSubmissions}>
                  <Text style={styles.previousSubmissionsTitle}>{t('papers.previousSubmissions')}</Text>
                  {mySubmissions.map((sub) => {
                    const st = SUBMISSION_STATUS_STYLE[sub.status] || SUBMISSION_STATUS_STYLE.default;
                    return (
                      <View key={sub.id} style={styles.submissionRow}>
                        <Text style={styles.submissionMonth}>
                          {MONTH_NAMES[sub.month - 1]} {sub.year}
                        </Text>
                        <Text style={styles.submissionPapers}>
                          {(sub.papers_included || [])
                            .map((p) => t(`papers.paperLabel${p.charAt(0).toUpperCase()}${p.slice(1)}`))
                            .join(', ')}
                        </Text>
                        <View style={[styles.submissionStatusBadge, { backgroundColor: st.bg }]}>
                          <Text style={[styles.submissionStatusText, { color: st.text }]}>
                            {t(`papers.submissionStatus${statusKeySuffix(sub.status)}`)}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          </View>

          <View style={styles.sectionCard}>
            <View style={[styles.sectionHeader, styles.verifyHeader]}>
              <Text style={styles.sectionHeaderText}>
                {t('papers.verifyTitle')} — {MONTH_NAMES[month - 1]} {year}
              </Text>
              <Pressable
                style={styles.verifyButton}
                onPress={runSelfVerify}
                disabled={selfVerifying}
              >
                <Text style={styles.verifyButtonText}>
                  {selfVerifying ? t('papers.checkingVerification') : t('papers.runVerification')}
                </Text>
              </Pressable>
            </View>

            {!!selfVerifyError && (
              <View style={styles.sectionBody}>
                <Text style={styles.sectionError}>{selfVerifyError}</Text>
              </View>
            )}

            {selfVerifyResult && (
              <View style={styles.sectionBody}>
                <View style={styles.verifySummaryRow}>
                  <View style={[styles.verifyStatusBadge, { backgroundColor: VERIFY_STATUS_STYLE[selfVerifyResult.summary.verification_status]?.bg }]}>
                    <Text style={[styles.verifyStatusText, { color: VERIFY_STATUS_STYLE[selfVerifyResult.summary.verification_status]?.text }]}>
                      {t(`papers.${VERIFY_STATUS_STYLE[selfVerifyResult.summary.verification_status]?.labelKey}`)}
                    </Text>
                  </View>
                  {[
                    ['verifyDays', 'total_days_worked', COLORS.text],
                    ['verifyMatch', 'days_match', COLORS.primary],
                    ['verifyMismatch', 'days_mismatch', '#c0392b'],
                    ['verifyMissing', 'days_missing', '#e65100'],
                    ['verifyTotalHrs', 'total_hours', '#1565c0'],
                  ].map(([labelKey, field, color]) => (
                    <View key={field} style={styles.verifyStatItem}>
                      <Text style={[styles.verifyStatValue, { color }]}>{selfVerifyResult.summary[field]}</Text>
                      <Text style={styles.verifyStatLabel}>{t(`papers.${labelKey}`)}</Text>
                    </View>
                  ))}
                </View>

                {selfVerifyResult.matches.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator style={styles.table}>
                    <View>
                      <View style={styles.verifyTableHeaderRow}>
                        {[
                          'verifyColDate',
                          'verifyColSupStart',
                          'verifyColSupFinish',
                          'verifyColSupTotal',
                          'verifyColYourStart',
                          'verifyColYourFinish',
                          'verifyColYourTotal',
                          'verifyColStatus',
                        ].map((k) => (
                          <Text key={k} style={styles.verifyTh}>{t(`papers.${k}`)}</Text>
                        ))}
                      </View>
                      {selfVerifyResult.matches.map((m, i) => {
                        const vs = MATCH_STATUS_STYLE[m.status] || MATCH_STATUS_STYLE.default;
                        return (
                          <View key={i} style={[styles.verifyTableRow, { backgroundColor: vs.bg }]}>
                            <Text style={styles.verifyTdBold}>{m.date}</Text>
                            <Text style={styles.verifyTd}>{m.supervisor_recorded?.start || '—'}</Text>
                            <Text style={styles.verifyTd}>{m.supervisor_recorded?.finish || '—'}</Text>
                            <Text style={styles.verifyTdBold}>{m.supervisor_recorded?.total || '—'}</Text>
                            <Text style={styles.verifyTd}>{m.worker_submitted?.start || '—'}</Text>
                            <Text style={styles.verifyTd}>{m.worker_submitted?.finish || '—'}</Text>
                            <Text style={styles.verifyTdBold}>{m.worker_submitted?.total || '—'}</Text>
                            <Text style={[styles.verifyTd, { color: vs.text, fontFamily: FONTS.bold }]}>
                              {t(`papers.${vs.labelKey}`)}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  </ScrollView>
                )}
              </View>
            )}

            {!selfVerifyResult && !selfVerifying && !selfVerifyError && (
              <View style={styles.sectionBody}>
                <Text style={styles.verifyHintText}>{t('papers.verifyHint')}</Text>
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
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
  sectionCard: {
    marginTop: 20,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: '#e8e8e3',
    borderRadius: 10,
    overflow: 'hidden',
  },
  sectionHeader: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  verifyHeader: {
    backgroundColor: '#1565c0',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  sectionHeaderText: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: COLORS.white,
  },
  sectionBody: {
    padding: 16,
  },
  submittingForRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  submittingForLabel: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: '#555555',
  },
  monthPill: {
    backgroundColor: '#e8f5e9',
    borderWidth: 1,
    borderColor: '#a5d6a7',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  monthPillText: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: COLORS.primary,
  },
  navigateHint: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: '#888888',
  },
  fieldLabel: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: '#555555',
    marginBottom: 8,
  },
  checkboxRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  checkboxChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#dddddd',
    borderRadius: 6,
    backgroundColor: COLORS.background,
  },
  checkboxChipActive: {
    borderColor: COLORS.primary,
    backgroundColor: '#e8f5e9',
  },
  checkboxChipText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: '#555555',
  },
  checkboxChipTextActive: {
    color: COLORS.primary,
  },
  notesInput: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: '#cccccc',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 60,
    textAlignVertical: 'top',
    marginBottom: 14,
    backgroundColor: COLORS.background,
  },
  sectionError: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.error,
    marginBottom: 12,
  },
  successBanner: {
    backgroundColor: '#e8f5e9',
    borderWidth: 1,
    borderColor: '#a5d6a7',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  successBannerText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.primary,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignSelf: 'flex-start',
  },
  primaryButtonText: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: COLORS.white,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  previousSubmissions: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  previousSubmissionsTitle: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: '#555555',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  submissionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  submissionMonth: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: COLORS.primary,
  },
  submissionPapers: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: '#888888',
  },
  submissionStatusBadge: {
    borderRadius: 8,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  submissionStatusText: {
    fontFamily: FONTS.bold,
    fontSize: 11,
  },
  verifyButton: {
    backgroundColor: COLORS.background,
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  verifyButtonText: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: '#1565c0',
  },
  verifySummaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 16,
    marginBottom: 14,
  },
  verifyStatusBadge: {
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  verifyStatusText: {
    fontFamily: FONTS.bold,
    fontSize: 13,
  },
  verifyStatItem: {
    alignItems: 'center',
  },
  verifyStatValue: {
    fontFamily: FONTS.bold,
    fontSize: 16,
  },
  verifyStatLabel: {
    fontFamily: FONTS.regular,
    fontSize: 10,
    color: '#888888',
  },
  verifyTableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#1565c0',
  },
  verifyTh: {
    fontFamily: FONTS.bold,
    fontSize: 10,
    color: COLORS.white,
    paddingVertical: 7,
    paddingHorizontal: 10,
    width: 90,
  },
  verifyTableRow: {
    flexDirection: 'row',
  },
  verifyTd: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: '#333333',
    paddingVertical: 6,
    paddingHorizontal: 10,
    width: 90,
    textAlign: 'center',
  },
  verifyTdBold: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: COLORS.text,
    paddingVertical: 6,
    paddingHorizontal: 10,
    width: 90,
    textAlign: 'center',
  },
  verifyHintText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: '#888888',
  },
});
