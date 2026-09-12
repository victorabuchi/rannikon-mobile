import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import DatePickerModal from '../components/DatePickerModal';
import PageHeader from '../components/PageHeader';
import api from '../lib/api';
import { MONTH_NAMES, formatDateMedium, todayISODate } from '../lib/dates';
import { exportHoursSummaryExcel } from '../lib/exporters';
import { useLanguage } from '../lib/i18n';
import { COLORS, FONTS } from '../lib/theme';

const SUBMISSION_STATUS_STYLE = {
  submitted: { bg: '#e3f2fd', text: '#1565c0' },
  approved: { bg: '#e8f5e9', text: '#2d6a2d' },
  rejected: { bg: '#fdecea', text: '#c0392b' },
  needs_review: { bg: '#fff3e0', text: '#e65100' },
  default: { bg: '#f5f5f5', text: '#555555' },
};

const VERIFY_STATUS_STYLE = {
  verified: { bg: '#f0faf0', text: '#2d6a2d', border: '#a5d6a7', labelKey: 'verifiedLabel' },
  discrepancies_found: { bg: '#fff0f0', text: '#c0392b', border: '#f5c6c6', labelKey: 'discrepanciesLabel' },
  incomplete: { bg: '#fff8ee', text: '#b45309', border: '#ffcc80', labelKey: 'incompleteLabel' },
};

const MATCH_STATUS_STYLE = {
  match: { bg: '#f4fbf4', accent: '#4caf50' },
  mismatch: { bg: '#fff4f4', accent: '#e53935' },
  missing_supervisor: { bg: '#fffbf0', accent: '#fb8c00' },
  missing_worker: { bg: '#fafafa', accent: '#9e9e9e' },
};

function shiftMonth(month, year, delta) {
  let m = month + delta;
  let y = year;
  if (m < 1) { m = 12; y -= 1; }
  if (m > 12) { m = 1; y += 1; }
  return [m, y];
}

function MonthNav({ month, year, onChange, monthNames }) {
  return (
    <View style={styles.monthNav}>
      <Pressable style={styles.monthNavButton} onPress={() => onChange(...shiftMonth(month, year, -1))} hitSlop={8}>
        <Text style={styles.monthNavButtonText}>{'<'}</Text>
      </Pressable>
      <Text style={styles.monthNavLabel}>{monthNames[month - 1]} {year}</Text>
      <Pressable style={styles.monthNavButton} onPress={() => onChange(...shiftMonth(month, year, 1))} hitSlop={8}>
        <Text style={styles.monthNavButtonText}>{'>'}</Text>
      </Pressable>
    </View>
  );
}

export default function PayrollScreen() {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState('submissions');

  const today = new Date();
  const [submissions, setSubmissions] = useState([]);
  const [subMonth, setSubMonth] = useState(today.getMonth() + 1);
  const [subYear, setSubYear] = useState(today.getFullYear());
  const [expandedSub, setExpandedSub] = useState(null);
  const [statusUpdating, setStatusUpdating] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [logsDate, setLogsDate] = useState(todayISODate());
  const [showLogsDatePicker, setShowLogsDatePicker] = useState(false);
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const [allWorkers, setAllWorkers] = useState([]);
  const [verifyMonth, setVerifyMonth] = useState(today.getMonth() + 1);
  const [verifyYear, setVerifyYear] = useState(today.getFullYear());
  const [verifyResults, setVerifyResults] = useState({});
  const [verifying, setVerifying] = useState(null);

  const [hoursMonth, setHoursMonth] = useState(today.getMonth() + 1);
  const [hoursYear, setHoursYear] = useState(today.getFullYear());
  const [hoursSummary, setHoursSummary] = useState([]);
  const [hoursLoading, setHoursLoading] = useState(false);
  const [hoursLoaded, setHoursLoaded] = useState(false);
  const [exportingHours, setExportingHours] = useState(false);

  const loadSubmissions = useCallback(async () => {
    try {
      const { data } = await api.get('/api/payroll/submissions');
      setSubmissions(data.submissions || []);
    } catch {
      // keep previous submissions on transient errors
    }
  }, []);

  const loadAllWorkers = useCallback(async () => {
    try {
      const { data } = await api.get('/api/payroll/workers');
      setAllWorkers(data.workers || []);
    } catch {
      // keep previous workers on transient errors
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([loadSubmissions(), loadAllWorkers()]);
      setLoading(false);
    })();
  }, [loadSubmissions, loadAllWorkers]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadSubmissions(), loadAllWorkers()]);
    setRefreshing(false);
  }, [loadSubmissions, loadAllWorkers]);

  const loadLogs = useCallback(async (date) => {
    setLogsLoading(true);
    try {
      const { data } = await api.get(`/api/payroll/worklogs/${date}`);
      setLogs(data.logs || []);
    } catch {
      setLogs([]);
    } finally {
      setLogsLoading(false);
    }
  }, []);

  const handleTabChange = (key) => {
    setTab(key);
    if (key === 'logs' && logs.length === 0) loadLogs(logsDate);
    if (key === 'hours' && !hoursLoaded) loadHoursSummary(hoursMonth, hoursYear);
  };

  const loadHoursSummary = async (month, year) => {
    setHoursLoading(true);
    try {
      const { data } = await api.get(`/api/payroll/hours-summary/${month}/${year}`);
      setHoursSummary(data.summary || []);
      setHoursLoaded(true);
    } catch {
      setHoursSummary([]);
    } finally {
      setHoursLoading(false);
    }
  };

  const changeHoursMonth = (m, y) => {
    setHoursMonth(m);
    setHoursYear(y);
    loadHoursSummary(m, y);
  };

  const deleteSubmission = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/api/payroll/submissions/${deleteTarget.id}`);
      setSubmissions((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      if (expandedSub === deleteTarget.id) setExpandedSub(null);
      setDeleteTarget(null);
    } catch (e) {
      Alert.alert(t('common.error'), e.response?.data?.error || t('payroll.deleteSubmissionFailed'));
    } finally {
      setDeleting(false);
    }
  };

  const updateStatus = async (id, status) => {
    setStatusUpdating(id + status);
    try {
      await api.post(`/api/payroll/submissions/${id}/status`, { status });
      setSubmissions((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)));
    } catch (e) {
      Alert.alert(t('common.error'), e.response?.data?.error);
    } finally {
      setStatusUpdating(null);
    }
  };

  const runVerify = async (worker) => {
    setVerifying(worker.id);
    try {
      const { data } = await api.get(`/api/payroll/verify/${worker.id}/${verifyMonth}/${verifyYear}`);
      setVerifyResults((prev) => ({ ...prev, [`${worker.id}-${verifyMonth}-${verifyYear}`]: data }));
    } catch (e) {
      Alert.alert(t('common.error'), e.response?.data?.error);
    } finally {
      setVerifying(null);
    }
  };

  const handleDownloadHours = async () => {
    setExportingHours(true);
    try {
      await exportHoursSummaryExcel({ summary: hoursSummary, month: hoursMonth, year: hoursYear });
    } catch {
      Alert.alert(t('common.exportFailed'), t('payroll.exportFailed'));
    } finally {
      setExportingHours(false);
    }
  };

  const subMonthSubs = submissions.filter((s) => s.month === subMonth && s.year === subYear);
  const subMonthGrouped = {};
  subMonthSubs.forEach((s) => {
    const g = s.house_group || '—';
    if (!subMonthGrouped[g]) subMonthGrouped[g] = [];
    subMonthGrouped[g].push(s);
  });

  const subLookup = {};
  submissions.forEach((s) => { subLookup[`${s.worker_id}-${s.month}-${s.year}`] = s; });
  const verifyWorkers = allWorkers.filter((w) => subLookup[`${w.id}-${verifyMonth}-${verifyYear}`]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <PageHeader title={t('payroll.panel')} showMyTimesheet />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        <View style={styles.tabRow}>
          {[
            ['submissions', 'payroll.tabSubmissions'],
            ['logs', 'payroll.tabLogs'],
            ['verify', 'payroll.tabVerify'],
            ['hours', 'payroll.tabHours'],
          ].map(([key, labelKey]) => (
            <Pressable
              key={key}
              style={[styles.tabButton, tab === key && styles.tabButtonActive]}
              onPress={() => handleTabChange(key)}
            >
              <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>{t(labelKey)}</Text>
            </Pressable>
          ))}
        </View>

        {tab === 'submissions' && (
          <View>
            <MonthNav month={subMonth} year={subYear} monthNames={MONTH_NAMES} onChange={(m, y) => { setSubMonth(m); setSubYear(y); }} />

            {Object.keys(subMonthGrouped).length === 0 ? (
              <View style={[styles.card, styles.emptyCard]}>
                <Text style={styles.emptyText}>
                  {t('payroll.noSubmissionsFor')} {MONTH_NAMES[subMonth - 1]} {subYear}
                </Text>
              </View>
            ) : (
              Object.entries(subMonthGrouped).map(([group, subs]) => (
                <View key={group} style={styles.groupSection}>
                  <View style={styles.groupDivider}>
                    <Text style={styles.groupDividerText}>{group}</Text>
                    <View style={styles.groupCountBadge}>
                      <Text style={styles.groupCountText}>{subs.length}</Text>
                    </View>
                  </View>
                  {subs.map((sub) => {
                    const isExpanded = expandedSub === sub.id;
                    const st = SUBMISSION_STATUS_STYLE[sub.status] || SUBMISSION_STATUS_STYLE.default;
                    return (
                      <View key={sub.id} style={styles.card}>
                        <View style={styles.subRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.subWorker}>
                              #{sub.work_number} <Text style={styles.subWorkerName}>{sub.full_name}</Text>
                            </Text>
                            <Text style={styles.subMeta}>
                              {(sub.papers_included || []).map((p) => t(`papers.paperLabel${p.charAt(0).toUpperCase()}${p.slice(1)}`)).join(', ')}
                              {'  ·  '}
                              {new Date(sub.submitted_at).toLocaleDateString('en-GB')}
                            </Text>
                          </View>
                          <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
                            <Text style={[styles.statusBadgeText, { color: st.text }]}>{sub.status}</Text>
                          </View>
                        </View>
                        <View style={styles.subActionsRow}>
                          <Pressable
                            style={styles.outlineButton}
                            onPress={() => setExpandedSub(isExpanded ? null : sub.id)}
                          >
                            <Text style={styles.outlineButtonText}>{isExpanded ? t('payroll.close') : t('payroll.open')}</Text>
                          </Pressable>
                          <Pressable
                            style={styles.dangerOutlineButton}
                            onPress={() => setDeleteTarget(sub)}
                          >
                            <Text style={styles.dangerOutlineButtonText}>{t('payroll.delete')}</Text>
                          </Pressable>
                        </View>

                        {isExpanded && (
                          <View style={styles.subExpanded}>
                            {!!sub.notes && (
                              <Text style={styles.subNotes}>{t('payroll.notesPrefix')} {sub.notes}</Text>
                            )}
                            <View style={styles.statusActionsRow}>
                              {['approved', 'rejected', 'needs_review'].map((s) => {
                                const busy = statusUpdating === sub.id + s;
                                const active = sub.status === s;
                                const sst = SUBMISSION_STATUS_STYLE[s];
                                const labelKey = s === 'approved' ? 'payroll.statusApproved' : s === 'rejected' ? 'payroll.statusRejected' : 'payroll.statusNeedsReview';
                                return (
                                  <Pressable
                                    key={s}
                                    disabled={!!statusUpdating || active}
                                    onPress={() => updateStatus(sub.id, s)}
                                    style={[
                                      styles.statusActionButton,
                                      active && { backgroundColor: sst.bg, borderColor: sst.text },
                                    ]}
                                  >
                                    <Text style={[styles.statusActionText, active && { color: sst.text }]}>
                                      {busy ? '…' : t(labelKey)}
                                    </Text>
                                  </Pressable>
                                );
                              })}
                            </View>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              ))
            )}
          </View>
        )}

        {tab === 'logs' && (
          <View>
            <View style={styles.dateRow}>
              <Text style={styles.dateValue}>{formatDateMedium(logsDate)}</Text>
              <Pressable style={styles.outlineButton} onPress={() => setShowLogsDatePicker(true)}>
                <Text style={styles.outlineButtonText}>{t('sup.pickDate')}</Text>
              </Pressable>
              <Pressable style={styles.outlineButton} onPress={() => loadLogs(logsDate)}>
                <Text style={styles.outlineButtonText}>{t('payroll.load')}</Text>
              </Pressable>
            </View>

            {logsLoading && <Text style={styles.loadingText}>{t('common.loading')}</Text>}
            {!logsLoading && logs.length === 0 && (
              <View style={[styles.card, styles.emptyCard]}>
                <Text style={styles.emptyText}>{t('payroll.noLogsForDate')}</Text>
              </View>
            )}
            {!logsLoading && logs.length > 0 && (
              <View style={[styles.card, styles.tableCard]}>
                <ScrollView horizontal showsHorizontalScrollIndicator>
                  <View>
                    <View style={styles.tableHeaderRow}>
                      {[
                        ['Work#', 56], ['Name', 110], ['Group', 130], ['Start', 60],
                        ['Finish', 60], ['Break', 64], ['Total hrs', 70], ['Work done', 150],
                      ].map(([label, width]) => (
                        <View key={label} style={[styles.th, { width }]}>
                          <Text style={styles.thText}>{label}</Text>
                        </View>
                      ))}
                    </View>
                    {logs.map((r, i) => (
                      <View key={i} style={[styles.tableRow, { backgroundColor: i % 2 === 0 ? COLORS.background : '#fafaf8' }]}>
                        <View style={[styles.td, { width: 56 }]}><Text style={styles.tdBold}>#{r.worker_number}</Text></View>
                        <View style={[styles.td, { width: 110 }]}><Text style={styles.tdText} numberOfLines={1}>{r.worker_name || '—'}</Text></View>
                        <View style={[styles.td, { width: 130 }]}><Text style={styles.tdMutedSmall} numberOfLines={1}>{r.house_group || '—'}</Text></View>
                        <View style={[styles.td, { width: 60 }]}><Text style={styles.tdMono}>{String(r.start_time || '').slice(0, 5)}</Text></View>
                        <View style={[styles.td, { width: 60 }]}><Text style={styles.tdMono}>{String(r.finish_time || '').slice(0, 5)}</Text></View>
                        <View style={[styles.td, { width: 64 }]}><Text style={styles.tdBreak}>{r.total_break_mins || r.session_break || 0} min</Text></View>
                        <View style={[styles.td, { width: 70 }]}><Text style={styles.tdTotal}>{r.total_hours}</Text></View>
                        <View style={[styles.td, { width: 150 }]}><Text style={styles.tdWork} numberOfLines={1}>{r.what_work}</Text></View>
                      </View>
                    ))}
                  </View>
                </ScrollView>
                <Text style={styles.tableFooterText}>{logs.length} {t('payroll.workersRecordedSuffix')}</Text>
              </View>
            )}
          </View>
        )}

        {tab === 'verify' && (
          <View>
            <MonthNav month={verifyMonth} year={verifyYear} monthNames={MONTH_NAMES} onChange={(m, y) => { setVerifyMonth(m); setVerifyYear(y); }} />
            <Text style={styles.hintText}>
              {t('payroll.submittedForMonth')} {MONTH_NAMES[verifyMonth - 1]} {verifyYear} — {t('payroll.tapVerifyHint')}
            </Text>

            {verifyWorkers.length === 0 && (
              <View style={[styles.card, styles.emptyCard]}>
                <Text style={styles.emptyText}>
                  {t('payroll.noSubmissionsForMonth')} {MONTH_NAMES[verifyMonth - 1]} {verifyYear}
                </Text>
              </View>
            )}

            {verifyWorkers.map((worker) => {
              const cacheKey = `${worker.id}-${verifyMonth}-${verifyYear}`;
              const result = verifyResults[cacheKey];
              const isVerifying = verifying === worker.id;
              const vs = result?.summary?.verification_status;
              const vst = VERIFY_STATUS_STYLE[vs];
              return (
                <View key={worker.id} style={[styles.card, styles.verifyCard]}>
                  <View style={styles.verifyCardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.verifyWorkerName}>
                        {worker.full_name} <Text style={styles.verifyWorkNum}>#{worker.work_number}</Text>
                      </Text>
                      {!!worker.house_group && <Text style={styles.subMeta}>{worker.house_group}</Text>}
                    </View>
                    <Pressable
                      style={[styles.primaryButtonSmall, isVerifying && styles.buttonDisabled]}
                      onPress={() => runVerify(worker)}
                      disabled={isVerifying}
                    >
                      <Text style={styles.primaryButtonSmallText}>
                        {isVerifying ? t('payroll.verifying') : result ? t('payroll.reverify') : t('payroll.verify')}
                      </Text>
                    </Pressable>
                  </View>

                  {result && vst && (
                    <View style={[styles.verifyResult, { borderTopColor: vst.border }]}>
                      <View style={[styles.verifyStatusBanner, { backgroundColor: vst.bg }]}>
                        <Text style={[styles.verifyStatusBannerText, { color: vst.text }]}>{t(`payroll.${vst.labelKey}`)}</Text>
                      </View>
                      <View style={styles.verifyStatTiles}>
                        {[
                          ['payroll.daysWorked', result.summary.total_days_worked, '#333333'],
                          ['payroll.match', result.summary.days_match, '#2d6a2d'],
                          ['payroll.mismatch', result.summary.days_mismatch, '#c0392b'],
                          ['payroll.missing', result.summary.days_missing, '#b45309'],
                          ['payroll.regularHours', result.summary.total_white_hours, '#1565c0'],
                          ['payroll.extraHours', result.summary.total_orange_hours, '#b45309'],
                        ].map(([labelKey, value, color]) => (
                          <View key={labelKey} style={styles.verifyStatTile}>
                            <Text style={[styles.verifyStatValue, { color }]}>{value}</Text>
                            <Text style={styles.verifyStatLabel}>{t(labelKey)}</Text>
                          </View>
                        ))}
                      </View>
                      {result.matches.length > 0 && (
                        <ScrollView horizontal showsHorizontalScrollIndicator>
                          <View>
                            <View style={styles.verifyTableHeaderRow}>
                              {['Date', 'S.Start', 'S.Finish', 'S.Total', 'W.Start', 'W.Finish', 'W.Total', 'Status'].map((h) => (
                                <Text key={h} style={styles.verifyTh}>{h}</Text>
                              ))}
                            </View>
                            {result.matches.map((m, i) => {
                              const mst = MATCH_STATUS_STYLE[m.status] || MATCH_STATUS_STYLE.missing_worker;
                              return (
                                <View key={i} style={[styles.verifyTableRow, { backgroundColor: mst.bg, borderLeftColor: mst.accent }]}>
                                  <Text style={styles.verifyTdBold}>{m.date}</Text>
                                  <Text style={styles.verifyTd}>{m.supervisor_recorded?.start || '—'}</Text>
                                  <Text style={styles.verifyTd}>{m.supervisor_recorded?.finish || '—'}</Text>
                                  <Text style={styles.verifyTdBold}>{m.supervisor_recorded?.total || '—'}</Text>
                                  <Text style={styles.verifyTd}>{m.worker_submitted?.start || '—'}</Text>
                                  <Text style={styles.verifyTd}>{m.worker_submitted?.finish || '—'}</Text>
                                  <Text style={styles.verifyTdBold}>{m.worker_submitted?.total || '—'}</Text>
                                  <Text style={styles.verifyTd}>{m.status}</Text>
                                </View>
                              );
                            })}
                          </View>
                        </ScrollView>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {tab === 'hours' && (
          <View>
            <View style={styles.hoursHeaderRow}>
              <Text style={styles.sectionTitle}>{t('payroll.monthlyHours')}</Text>
              <Pressable
                style={[styles.primaryButtonSmall, (!hoursSummary.length || exportingHours) && styles.buttonDisabled]}
                onPress={handleDownloadHours}
                disabled={!hoursSummary.length || exportingHours}
              >
                <Text style={styles.primaryButtonSmallText}>{t('payroll.downloadAllExcel')}</Text>
              </Pressable>
            </View>

            <MonthNav month={hoursMonth} year={hoursYear} monthNames={MONTH_NAMES} onChange={changeHoursMonth} />
            <Text style={styles.hintText}>
              {t('payroll.everyWorkerHoursFor')} {MONTH_NAMES[hoursMonth - 1]} {hoursYear}.
            </Text>

            {hoursLoading ? (
              <Text style={styles.loadingText}>{t('common.loading')}</Text>
            ) : hoursSummary.length === 0 ? (
              <View style={[styles.card, styles.emptyCard]}>
                <Text style={styles.emptyText}>{t('payroll.noActiveWorkers')}</Text>
              </View>
            ) : (
              <View style={[styles.card, styles.tableCard]}>
                <ScrollView horizontal showsHorizontalScrollIndicator>
                  <View>
                    <View style={styles.tableHeaderRow}>
                      {[
                        [t('payroll.colWorkNum'), 70], [t('payroll.colName'), 130],
                        [t('payroll.colWhiteHrs'), 100], [t('payroll.colOrangeHrs'), 100],
                        [t('payroll.colGreenHrs'), 100], [t('payroll.colTotalHrs'), 90],
                      ].map(([label, width]) => (
                        <View key={label} style={[styles.th, { width }]}>
                          <Text style={styles.thText}>{label}</Text>
                        </View>
                      ))}
                    </View>
                    {hoursSummary.map((r) => (
                      <View key={r.worker_id} style={styles.tableRow}>
                        <View style={[styles.td, { width: 70 }]}><Text style={styles.tdBold}>#{r.work_number}</Text></View>
                        <View style={[styles.td, { width: 130 }]}><Text style={styles.tdText} numberOfLines={1}>{r.full_name}</Text></View>
                        <View style={[styles.td, { width: 100 }]}><Text style={styles.tdBold}>{r.white_hours}</Text></View>
                        <View style={[styles.td, { width: 100 }]}><Text style={[styles.tdBold, { color: '#b45309' }]}>{r.orange_hours}</Text></View>
                        <View style={[styles.td, { width: 100 }]}><Text style={[styles.tdBold, { color: COLORS.primary }]}>{r.green_hours}</Text></View>
                        <View style={[styles.td, { width: 90 }]}><Text style={[styles.tdBold, { color: '#1565c0' }]}>{r.total_hours}</Text></View>
                      </View>
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      <DatePickerModal
        visible={showLogsDatePicker}
        selectedDate={logsDate}
        maxDate={todayISODate()}
        onSelect={(date) => {
          setLogsDate(date);
          setShowLogsDatePicker(false);
          loadLogs(date);
        }}
        onClose={() => setShowLogsDatePicker(false)}
      />

      <Modal visible={!!deleteTarget} transparent animationType="fade" onRequestClose={() => !deleting && setDeleteTarget(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('payroll.deleteSubmissionTitle')}</Text>
            <Text style={styles.modalSubtitle}>{t('payroll.deleteSubmissionDesc')}</Text>
            <View style={styles.modalButtons}>
              <Pressable style={styles.cancelButton} onPress={() => setDeleteTarget(null)} disabled={deleting}>
                <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
              </Pressable>
              <Pressable style={[styles.modalPrimaryButton, styles.dangerButton]} onPress={deleteSubmission} disabled={deleting}>
                <Text style={styles.dangerButtonText}>{deleting ? '…' : t('payroll.delete')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  centered: { flex: 1, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingBottom: 32 },
  tabRow: { flexDirection: 'row', gap: 6, marginBottom: 16, flexWrap: 'wrap' },
  tabButton: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: '#dddddd', backgroundColor: COLORS.background },
  tabButtonActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tabText: { fontFamily: FONTS.medium, fontSize: 13, color: '#555555' },
  tabTextActive: { color: COLORS.white },
  monthNav: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 12 },
  monthNavButton: { width: 32, height: 32, borderRadius: 8, borderWidth: 1, borderColor: '#dddddd', backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' },
  monthNavButtonText: { fontFamily: FONTS.bold, fontSize: 16, color: COLORS.text },
  monthNavLabel: { fontFamily: FONTS.bold, fontSize: 15, color: COLORS.text },
  hintText: { fontFamily: FONTS.regular, fontSize: 12, color: '#888888', marginBottom: 16 },
  card: { backgroundColor: COLORS.background, borderWidth: 1, borderColor: '#e8e8e3', borderRadius: 12, padding: 14, marginBottom: 10 },
  emptyCard: { alignItems: 'center', paddingVertical: 32 },
  emptyText: { fontFamily: FONTS.regular, fontSize: 14, color: '#999999', textAlign: 'center' },
  loadingText: { fontFamily: FONTS.regular, fontSize: 14, color: '#888888', marginBottom: 12 },
  groupSection: { marginBottom: 8 },
  groupDivider: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  groupDividerText: { fontFamily: FONTS.bold, fontSize: 11, color: COLORS.primary, textTransform: 'uppercase', letterSpacing: 0.6 },
  groupCountBadge: { backgroundColor: '#f0f7f0', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 1 },
  groupCountText: { fontFamily: FONTS.medium, fontSize: 11, color: '#888888' },
  subRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  subWorker: { fontFamily: FONTS.bold, fontSize: 14, color: COLORS.primary },
  subWorkerName: { color: COLORS.text },
  subMeta: { fontFamily: FONTS.regular, fontSize: 11, color: '#888888', marginTop: 3 },
  statusBadge: { borderRadius: 8, paddingVertical: 3, paddingHorizontal: 9 },
  statusBadgeText: { fontFamily: FONTS.bold, fontSize: 11 },
  subActionsRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  subExpanded: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  subNotes: { fontFamily: FONTS.regular, fontSize: 13, color: '#555555', fontStyle: 'italic', marginBottom: 10 },
  statusActionsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  statusActionButton: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 6, borderWidth: 1, borderColor: '#dddddd', backgroundColor: COLORS.background },
  statusActionText: { fontFamily: FONTS.medium, fontSize: 12, color: '#555555' },
  outlineButton: { backgroundColor: COLORS.background, borderWidth: 1, borderColor: '#dddddd', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14 },
  outlineButtonText: { fontFamily: FONTS.medium, fontSize: 12, color: '#333333' },
  dangerOutlineButton: { backgroundColor: COLORS.background, borderWidth: 1, borderColor: '#f5c2c2', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14 },
  dangerOutlineButtonText: { fontFamily: FONTS.medium, fontSize: 12, color: '#c0392b' },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  dateValue: { fontFamily: FONTS.bold, fontSize: 15, color: COLORS.text, marginRight: 4 },
  tableCard: { padding: 0, overflow: 'hidden' },
  tableHeaderRow: { flexDirection: 'row', backgroundColor: '#f5f5f0' },
  th: { paddingVertical: 8, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: '#e8e8e3' },
  thText: { fontFamily: FONTS.bold, fontSize: 11, color: '#555555' },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f0f0ec' },
  td: { paddingVertical: 8, paddingHorizontal: 10, justifyContent: 'center' },
  tdBold: { fontFamily: FONTS.bold, fontSize: 13, color: COLORS.text },
  tdText: { fontFamily: FONTS.regular, fontSize: 13, color: '#333333' },
  tdMutedSmall: { fontFamily: FONTS.regular, fontSize: 11, color: '#666666' },
  tdMono: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.text },
  tdBreak: { fontFamily: FONTS.regular, fontSize: 13, color: '#b45309' },
  tdTotal: { fontFamily: FONTS.bold, fontSize: 13, color: COLORS.primary },
  tdWork: { fontFamily: FONTS.regular, fontSize: 13, color: '#555555' },
  tableFooterText: { fontFamily: FONTS.regular, fontSize: 12, color: '#666666', padding: 12 },
  primaryButtonSmall: { backgroundColor: COLORS.primary, borderRadius: 8, paddingVertical: 9, paddingHorizontal: 14 },
  primaryButtonSmallText: { fontFamily: FONTS.bold, fontSize: 12, color: COLORS.white },
  buttonDisabled: { opacity: 0.6 },
  verifyCard: { padding: 0, overflow: 'hidden' },
  verifyCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  verifyWorkerName: { fontFamily: FONTS.bold, fontSize: 14, color: COLORS.text },
  verifyWorkNum: { fontFamily: FONTS.medium, fontSize: 12, color: COLORS.primary },
  verifyResult: { borderTopWidth: 2 },
  verifyStatusBanner: { paddingVertical: 10, paddingHorizontal: 14 },
  verifyStatusBannerText: { fontFamily: FONTS.bold, fontSize: 13 },
  verifyStatTiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 14 },
  verifyStatTile: { minWidth: 84, alignItems: 'center' },
  verifyStatValue: { fontFamily: FONTS.bold, fontSize: 18 },
  verifyStatLabel: { fontFamily: FONTS.regular, fontSize: 10, color: '#888888', marginTop: 2 },
  verifyTableHeaderRow: { flexDirection: 'row', backgroundColor: '#1a2e1a' },
  verifyTh: { fontFamily: FONTS.bold, fontSize: 10, color: '#ffffff', paddingVertical: 8, paddingHorizontal: 10, width: 78 },
  verifyTableRow: { flexDirection: 'row', borderLeftWidth: 4, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  verifyTd: { fontFamily: FONTS.regular, fontSize: 11, color: '#333333', paddingVertical: 8, paddingHorizontal: 10, width: 78, textAlign: 'center' },
  verifyTdBold: { fontFamily: FONTS.bold, fontSize: 11, color: COLORS.text, paddingVertical: 8, paddingHorizontal: 10, width: 78, textAlign: 'center' },
  hoursHeaderRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14 },
  sectionTitle: { fontFamily: FONTS.bold, fontSize: 17, color: COLORS.text },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modalCard: { backgroundColor: COLORS.background, borderRadius: 16, padding: 24, width: '100%', maxWidth: 400 },
  modalTitle: { fontFamily: FONTS.bold, fontSize: 17, color: '#c0392b', marginBottom: 8 },
  modalSubtitle: { fontFamily: FONTS.regular, fontSize: 13, color: '#666666', marginBottom: 20, lineHeight: 19 },
  modalButtons: { flexDirection: 'row', gap: 8 },
  cancelButton: { flex: 1, borderWidth: 1, borderColor: '#dddddd', borderRadius: 8, paddingVertical: 12, alignItems: 'center', backgroundColor: COLORS.background },
  cancelButtonText: { fontFamily: FONTS.medium, fontSize: 14, color: '#333333' },
  modalPrimaryButton: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  dangerButton: { backgroundColor: '#c0392b' },
  dangerButtonText: { fontFamily: FONTS.bold, fontSize: 14, color: COLORS.white },
});
