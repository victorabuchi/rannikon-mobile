import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { GroupPill } from '../../components/Badges';
import api from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { formatDateLong, formatDateMedium } from '../../lib/dates';
import { exportWorkLogExcel, exportWorkLogPdf } from '../../lib/exporters';
import { GROUP_COLORS, getHouseGroup } from '../../lib/houseGroups';
import { useLanguage } from '../../lib/i18n';
import { COLORS, FONTS } from '../../lib/theme';

const BREAK_QUICK_OPTIONS = [10, 15, 20, 30, 45];

const COLW = {
  workNum: 56,
  name: 110,
  group: 140,
  time: 60,
  breakCol: 64,
  hours: 64,
  work: 150,
  remove: 36,
};

const TABLE_HEADERS = [
  { key: 'work', labelKey: 'sup.colWorkNum', width: COLW.workNum },
  { key: 'name', labelKey: 'sup.colName', width: COLW.name },
  { key: 'group', labelKey: 'sup.colGroup', width: COLW.group },
  { key: 'start', labelKey: 'sup.colStart', width: COLW.time },
  { key: 'finish', labelKey: 'sup.colFinish', width: COLW.time },
  { key: 'break', labelKey: 'sup.colBreak', width: COLW.breakCol },
  { key: 'white', labelKey: 'sup.colWhiteHrs', width: COLW.hours },
  { key: 'orange', labelKey: 'sup.colOrangeHrs', width: COLW.hours },
  { key: 'total', labelKey: 'sup.colTotal', width: COLW.hours },
  { key: 'workdone', labelKey: 'sup.colWorkDone', width: COLW.work },
  { key: 'remove', labelKey: null, width: COLW.remove },
];

export default function SupervisorScreen() {
  const { worker } = useAuth();
  const { t } = useLanguage();
  const [session, setSession] = useState(null);
  const [batches, setBatches] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [view, setView] = useState('session'); // 'session' | 'worklog'

  // Add workers modal
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchNumbers, setBatchNumbers] = useState('');
  const [batchStart, setBatchStart] = useState('');
  const [batchWork, setBatchWork] = useState('');
  const [batchSaving, setBatchSaving] = useState(false);
  const [batchError, setBatchError] = useState('');

  // Break modal
  const [showBreakModal, setShowBreakModal] = useState(false);
  const [breakMins, setBreakMins] = useState('');
  const [breakSaving, setBreakSaving] = useState(false);

  // Finish batch modal
  const [finishBatchId, setFinishBatchId] = useState(null);
  const [finishTime, setFinishTime] = useState('');
  const [finishSaving, setFinishSaving] = useState(false);

  // Send to admin / export
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [exporting, setExporting] = useState(false);

  const loadBatches = async (sid) => {
    const { data } = await api.get(`/api/supervisor/session/${sid}/batches`);
    setBatches(data.batches || []);
  };

  const loadLogs = async (sid) => {
    const { data } = await api.get(`/api/supervisor/session/${sid}/logs`);
    setLogs(data.logs || []);
  };

  const loadToday = useCallback(async () => {
    try {
      const { data } = await api.get('/api/supervisor/session/today');
      if (data.session) {
        setSession(data.session);
        setSent(data.session.status === 'sent');
        await Promise.all([loadBatches(data.session.id), loadLogs(data.session.id)]);
      } else {
        setSession(null);
        setBatches([]);
        setLogs([]);
        setSent(false);
      }
    } catch {
      // keep previous state on transient errors
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadToday();
      setLoading(false);
    })();
  }, [loadToday]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadToday();
    setRefreshing(false);
  }, [loadToday]);

  const startSession = async () => {
    setLoading(true);
    try {
      const { data } = await api.post('/api/supervisor/session', {});
      setSession(data.session);
      setBatches([]);
      setLogs([]);
      setSent(data.session.status === 'sent');
    } finally {
      setLoading(false);
    }
  };

  const batchNumbersList = batchNumbers
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const addBatch = async () => {
    setBatchError('');
    if (!batchNumbersList.length) {
      setBatchError(t('sup.enterWorkerNumber'));
      return;
    }
    if (!batchStart) {
      setBatchError(t('sup.startTimeRequired'));
      return;
    }
    setBatchSaving(true);
    try {
      await api.post('/api/supervisor/batch', {
        session_id: session.id,
        worker_numbers: batchNumbersList,
        start_time: batchStart,
        what_work: batchWork,
      });
      setShowBatchModal(false);
      setBatchNumbers('');
      setBatchStart('');
      setBatchWork('');
      await Promise.all([loadBatches(session.id), loadLogs(session.id)]);
    } catch (e) {
      setBatchError(e.response?.data?.error || t('sup.failedAddBatch'));
    } finally {
      setBatchSaving(false);
    }
  };

  const addBreak = async () => {
    if (!breakMins || parseInt(breakMins, 10) <= 0) return;
    setBreakSaving(true);
    try {
      const { data } = await api.post('/api/supervisor/break', {
        session_id: session.id,
        break_mins: parseInt(breakMins, 10),
      });
      setSession((s) => ({ ...s, total_break_mins: data.total_break_mins }));
      setShowBreakModal(false);
      setBreakMins('');
    } finally {
      setBreakSaving(false);
    }
  };

  const setFinish = async () => {
    if (!finishTime) return;
    setFinishSaving(true);
    try {
      await api.patch(`/api/supervisor/batch/${finishBatchId}/finish`, { finish_time: finishTime });
      setFinishBatchId(null);
      setFinishTime('');
      await Promise.all([loadBatches(session.id), loadLogs(session.id)]);
    } finally {
      setFinishSaving(false);
    }
  };

  const sendToAdmin = async () => {
    setSending(true);
    try {
      await api.post(`/api/supervisor/session/${session.id}/send-to-admin`, {});
      setSent(true);
      setSession((s) => ({ ...s, status: 'sent' }));
    } catch (e) {
      Alert.alert(t('common.error'), e.response?.data?.error || t('sup.failedToSend'));
    } finally {
      setSending(false);
    }
  };

  const removeWorker = async (wn) => {
    await api.delete(`/api/supervisor/session/${session.id}/log/${wn}`);
    await loadLogs(session.id);
  };

  const handleDownloadPdf = async () => {
    setExporting(true);
    try {
      await exportWorkLogPdf({ worker, session, logs, dateLabel: formatDateMedium(new Date()) });
    } catch {
      Alert.alert(t('common.exportFailed'), t('common.exportPdfError'));
    } finally {
      setExporting(false);
    }
  };

  const handleDownloadExcel = async () => {
    setExporting(true);
    try {
      await exportWorkLogExcel({ worker, session, logs, dateLabel: formatDateMedium(new Date()) });
    } catch {
      Alert.alert(t('common.exportFailed'), t('common.exportExcelError'));
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        <View style={styles.header}>
          <Text style={styles.title}>{t('sup.panel')}</Text>
          <Text style={styles.subtitle}>{formatDateLong(new Date())}</Text>
        </View>

        {!session && (
          <View style={[styles.card, styles.emptyCard]}>
            <Text style={styles.emptyTitle}>{t('sup.noActiveSession')}</Text>
            <Text style={styles.emptyText}>{t('sup.startSessionDesc')}</Text>
            <Pressable style={styles.primaryButton} onPress={startSession}>
              <Text style={styles.primaryButtonText}>{t('sup.startSession')}</Text>
            </Pressable>
          </View>
        )}

        {session && (
          <>
            <View style={[styles.card, styles.summaryCard]}>
              <View style={styles.summaryStats}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>{t('sup.workersRecorded')}</Text>
                  <Text style={[styles.summaryValue, { color: COLORS.primary }]}>{logs.length}</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>{t('sup.totalBreak')}</Text>
                  <Text style={[styles.summaryValue, { color: '#b45309' }]}>
                    {session.total_break_mins || 0} {t('sup.min')}
                  </Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>{t('sup.batches')}</Text>
                  <Text style={[styles.summaryValue, { color: '#555555' }]}>{batches.length}</Text>
                </View>
                {sent && (
                  <View style={styles.sentBadge}>
                    <Text style={styles.sentBadgeText}>{t('sup.sentToAdmin')}</Text>
                  </View>
                )}
              </View>
              <View style={styles.summaryActions}>
                <Pressable style={styles.breakButton} onPress={() => setShowBreakModal(true)}>
                  <Text style={styles.breakButtonText}>{t('sup.addBreak')}</Text>
                </Pressable>
                <Pressable style={styles.primaryButtonSmall} onPress={() => setShowBatchModal(true)}>
                  <Text style={styles.primaryButtonSmallText}>{t('sup.addWorkers')}</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.toggleRow}>
              <Pressable
                style={[styles.toggleButton, view === 'session' && styles.toggleButtonActive]}
                onPress={() => setView('session')}
              >
                <Text style={[styles.toggleText, view === 'session' && styles.toggleTextActive]}>{t('sup.batches')}</Text>
              </Pressable>
              <Pressable
                style={[styles.toggleButton, view === 'worklog' && styles.toggleButtonActive]}
                onPress={() => setView('worklog')}
              >
                <Text style={[styles.toggleText, view === 'worklog' && styles.toggleTextActive]}>{t('sup.workLogTab')}</Text>
              </Pressable>
            </View>

            {view === 'session' && (
              <View style={styles.batchList}>
                {batches.length === 0 && (
                  <View style={[styles.card, styles.emptyBatchCard]}>
                    <Text style={styles.emptyBatchText}>{t('sup.noBatchesYet')}</Text>
                  </View>
                )}
                {batches.map((b) => {
                  const hasFinish = !!b.finish_time;
                  return (
                    <View
                      key={b.id}
                      style={[
                        styles.card,
                        styles.batchCard,
                        { borderLeftColor: hasFinish ? COLORS.primary : '#f59e0b' },
                      ]}
                    >
                      <View style={styles.batchHeader}>
                        <View style={styles.batchTimes}>
                          <Text style={styles.batchTimeText}>
                            {t('sup.startLabel')} <Text style={{ color: COLORS.primary }}>{b.start_time?.slice(0, 5)}</Text>
                          </Text>
                          {hasFinish ? (
                            <Text style={styles.batchTimeText}>
                              {t('sup.finishLabel')} <Text style={{ color: '#b45309' }}>{b.finish_time?.slice(0, 5)}</Text>
                            </Text>
                          ) : (
                            <View style={styles.pendingBadge}>
                              <Text style={styles.pendingBadgeText}>{t('sup.noFinishYet')}</Text>
                            </View>
                          )}
                        </View>
                        <Pressable
                          style={hasFinish ? styles.outlineButton : styles.primaryButtonSmall}
                          onPress={() => {
                            setFinishBatchId(b.id);
                            setFinishTime(hasFinish ? b.finish_time?.slice(0, 5) || '' : '');
                          }}
                        >
                          <Text style={hasFinish ? styles.outlineButtonText : styles.primaryButtonSmallText}>
                            {hasFinish ? t('sup.editFinish') : t('sup.setFinishTime')}
                          </Text>
                        </Pressable>
                      </View>
                      <View style={styles.chipRow}>
                        {(b.worker_numbers || []).map((wn) => {
                          const c = GROUP_COLORS[getHouseGroup(wn)] || GROUP_COLORS.Unknown;
                          return (
                            <View
                              key={wn}
                              style={[styles.workerChip, { backgroundColor: c.bg, borderColor: c.border }]}
                            >
                              <Text style={[styles.workerChipText, { color: c.text }]}>#{wn}</Text>
                            </View>
                          );
                        })}
                      </View>
                      <Text style={styles.batchCount}>
                        {b.worker_numbers?.length || 0} {(b.worker_numbers?.length || 0) !== 1 ? t('sup.workers') : t('sup.worker')}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}

            {view === 'worklog' && (
              <View>
                <View style={[styles.card, styles.tableCard]}>
                  {logs.length === 0 ? (
                    <Text style={styles.emptyTableText}>{t('sup.noWorkersRecorded')}</Text>
                  ) : (
                    <ScrollView horizontal showsHorizontalScrollIndicator>
                      <View>
                        <View style={styles.tableHeaderRow}>
                          {TABLE_HEADERS.map((h) => (
                            <View key={h.key} style={[styles.th, { width: h.width }]}>
                              <Text style={styles.thText}>{h.labelKey ? t(h.labelKey) : ''}</Text>
                            </View>
                          ))}
                        </View>
                        {logs.map((r, i) => (
                          <View
                            key={r.id}
                            style={[styles.tableRow, { backgroundColor: i % 2 === 0 ? COLORS.background : '#fafaf8' }]}
                          >
                            <View style={[styles.td, { width: COLW.workNum }]}>
                              <Text style={styles.tdBold}>#{r.worker_number}</Text>
                            </View>
                            <View style={[styles.td, { width: COLW.name }]}>
                              <Text style={r.worker_name ? styles.tdText : styles.tdMuted} numberOfLines={1}>
                                {r.worker_name || t('common.unknown')}
                              </Text>
                            </View>
                            <View style={[styles.td, { width: COLW.group }]}>
                              <GroupPill group={r.house_group} />
                            </View>
                            <View style={[styles.td, { width: COLW.time }]}>
                              <Text style={styles.tdMono}>{r.start_time?.slice(0, 5) || ''}</Text>
                            </View>
                            <View style={[styles.td, { width: COLW.time }]}>
                              <Text style={r.finish_time ? styles.tdMono : styles.tdMuted}>
                                {r.finish_time?.slice(0, 5) || t('common.pending')}
                              </Text>
                            </View>
                            <View style={[styles.td, { width: COLW.breakCol }]}>
                              <Text style={styles.tdBreak}>
                                {r.total_break_mins > 0 ? `${r.total_break_mins} ${t('sup.min')}` : ''}
                              </Text>
                            </View>
                            <View style={[styles.td, { width: COLW.hours }]}>
                              <Text style={styles.tdWhite}>{r.white_hours || ''}</Text>
                            </View>
                            <View style={[styles.td, { width: COLW.hours }]}>
                              <Text style={styles.tdOrange}>{r.orange_hours || ''}</Text>
                            </View>
                            <View style={[styles.td, { width: COLW.hours }]}>
                              <Text style={styles.tdTotal}>{r.total_hours || ''}</Text>
                            </View>
                            <View style={[styles.td, { width: COLW.work }]}>
                              <Text style={styles.tdWork} numberOfLines={1}>
                                {r.what_work || ''}
                              </Text>
                            </View>
                            <View style={[styles.td, { width: COLW.remove }]}>
                              <Pressable onPress={() => removeWorker(r.worker_number)} hitSlop={8}>
                                <Text style={styles.removeText}>×</Text>
                              </Pressable>
                            </View>
                          </View>
                        ))}
                      </View>
                    </ScrollView>
                  )}
                </View>

                {logs.length > 0 && (
                  <View style={styles.exportRow}>
                    <Pressable
                      style={({ pressed }) => [styles.outlineButton, pressed && styles.outlineButtonPressed]}
                      onPress={handleDownloadPdf}
                      disabled={exporting}
                    >
                      <Text style={styles.outlineButtonText}>{t('common.downloadPDF')}</Text>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [styles.outlineButton, pressed && styles.outlineButtonPressed]}
                      onPress={handleDownloadExcel}
                      disabled={exporting}
                    >
                      <Text style={styles.outlineButtonText}>{t('common.downloadExcel')}</Text>
                    </Pressable>
                    {exporting && <ActivityIndicator size="small" color={COLORS.primary} />}
                    <View style={{ flex: 1 }} />
                    {!sent ? (
                      <Pressable style={styles.sendButton} onPress={sendToAdmin} disabled={sending}>
                        <Text style={styles.sendButtonText}>{sending ? t('sup.sending') : t('sup.sendToAdmin')}</Text>
                      </Pressable>
                    ) : (
                      <View style={styles.sentBadgeLarge}>
                        <Text style={styles.sentBadgeLargeText}>{t('sup.sentToAdmin')}</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* ADD WORKERS MODAL */}
      <Modal
        visible={showBatchModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowBatchModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalCard}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>{t('sup.addWorkersTitle')}</Text>

              <View style={styles.field}>
                <Text style={styles.label}>{t('sup.workerNumbers')}</Text>
                <TextInput
                  style={[styles.input, styles.textarea]}
                  placeholder={t('sup.workerNumbersPlaceholder')}
                  placeholderTextColor={COLORS.textMuted}
                  value={batchNumbers}
                  onChangeText={setBatchNumbers}
                  multiline
                />
                <Text style={styles.helperText}>{batchNumbersList.length} {t('sup.workersEntered')}</Text>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>{t('sup.startTime')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={t('sup.startTimePlaceholder')}
                  placeholderTextColor={COLORS.textMuted}
                  value={batchStart}
                  onChangeText={setBatchStart}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>
                  {t('sup.whatWork')} <Text style={styles.optionalText}>{t('sup.optional')}</Text>
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder={t('sup.whatWorkPlaceholder')}
                  placeholderTextColor={COLORS.textMuted}
                  value={batchWork}
                  onChangeText={setBatchWork}
                />
              </View>

              {!!batchError && <Text style={styles.formError}>{batchError}</Text>}

              {batchNumbersList.length > 0 && (
                <View style={styles.groupPreview}>
                  <Text style={styles.groupPreviewLabel}>{t('sup.groupsDetected')}</Text>
                  <View style={styles.chipRow}>
                    {batchNumbersList.map((wn) => (
                      <View key={wn} style={styles.groupPreviewItem}>
                        <Text style={styles.groupPreviewNumber}>#{wn}</Text>
                        <GroupPill group={getHouseGroup(wn)} />
                      </View>
                    ))}
                  </View>
                </View>
              )}

              <View style={styles.modalButtons}>
                <Pressable
                  style={styles.cancelButton}
                  onPress={() => {
                    setShowBatchModal(false);
                    setBatchError('');
                  }}
                >
                  <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
                </Pressable>
                <Pressable
                  style={[styles.primaryButton, styles.modalPrimaryButton]}
                  onPress={addBatch}
                  disabled={batchSaving}
                >
                  <Text style={styles.primaryButtonText}>{batchSaving ? t('common.saving') : t('sup.addBatch')}</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* BREAK MODAL */}
      <Modal
        visible={showBreakModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowBreakModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, styles.smallModalCard]}>
            <Text style={styles.modalTitle}>{t('sup.recordBreak')}</Text>
            <Text style={styles.modalSubtitle}>
              {t('sup.currentTotal')} <Text style={styles.bold}>{session?.total_break_mins || 0} {t('sup.min')}</Text>
            </Text>

            <View style={styles.field}>
              <Text style={styles.label}>{t('sup.breakDuration')}</Text>
              <TextInput
                style={[styles.input, styles.bigCenterInput]}
                placeholder={t('sup.breakPlaceholder')}
                placeholderTextColor={COLORS.textMuted}
                value={breakMins}
                onChangeText={(val) => setBreakMins(val.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
              />
            </View>

            <View style={styles.quickRow}>
              {BREAK_QUICK_OPTIONS.map((m) => (
                <Pressable
                  key={m}
                  style={[styles.quickButton, breakMins === String(m) && styles.quickButtonActive]}
                  onPress={() => setBreakMins(String(m))}
                >
                  <Text style={[styles.quickButtonText, breakMins === String(m) && styles.quickButtonTextActive]}>
                    {m}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.modalButtons}>
              <Pressable style={styles.cancelButton} onPress={() => setShowBreakModal(false)}>
                <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
              </Pressable>
              <Pressable
                style={[styles.primaryButton, styles.modalPrimaryButton]}
                onPress={addBreak}
                disabled={breakSaving || !breakMins}
              >
                <Text style={styles.primaryButtonText}>
                  {breakSaving ? t('common.saving') : `${t('sup.addBreakPrefix')} ${breakMins || '—'} ${t('sup.minBreakSuffix')}`}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* FINISH TIME MODAL */}
      <Modal
        visible={finishBatchId != null}
        transparent
        animationType="fade"
        onRequestClose={() => setFinishBatchId(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, styles.smallModalCard]}>
            <Text style={styles.modalTitle}>{t('sup.setFinishTime')}</Text>
            <Text style={styles.modalSubtitle}>{t('sup.applyToAllWorkers')}</Text>

            <View style={styles.field}>
              <Text style={styles.label}>{t('sup.finishTime')}</Text>
              <TextInput
                style={[styles.input, styles.bigCenterInput]}
                placeholder={t('sup.finishTimePlaceholder')}
                placeholderTextColor={COLORS.textMuted}
                value={finishTime}
                onChangeText={setFinishTime}
              />
            </View>

            <View style={styles.modalButtons}>
              <Pressable style={styles.cancelButton} onPress={() => setFinishBatchId(null)}>
                <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
              </Pressable>
              <Pressable
                style={[styles.primaryButton, styles.modalPrimaryButton]}
                onPress={setFinish}
                disabled={finishSaving || !finishTime}
              >
                <Text style={styles.primaryButtonText}>{finishSaving ? t('common.saving') : t('sup.setFinish')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  centered: {
    flex: 1,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 20,
    color: COLORS.text,
    marginBottom: 2,
  },
  subtitle: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: '#666666',
  },
  card: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: '#e8e8e3',
    borderRadius: 14,
    padding: 16,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: COLORS.text,
    marginBottom: 6,
  },
  emptyText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: '#666666',
    marginBottom: 20,
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  primaryButtonText: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: COLORS.white,
    textAlign: 'center',
  },
  primaryButtonSmall: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  primaryButtonSmallText: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: COLORS.white,
  },
  summaryCard: {
    marginBottom: 16,
    gap: 14,
  },
  summaryStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
    alignItems: 'center',
  },
  summaryItem: {
    minWidth: 70,
  },
  summaryLabel: {
    fontFamily: FONTS.bold,
    fontSize: 10,
    color: '#888888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  summaryValue: {
    fontFamily: FONTS.bold,
    fontSize: 22,
  },
  sentBadge: {
    backgroundColor: '#e8f5e9',
    borderWidth: 1,
    borderColor: '#c8e6c9',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  sentBadgeText: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: COLORS.primary,
  },
  summaryActions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  breakButton: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#f59e0b',
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  breakButtonText: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: '#b45309',
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 16,
  },
  toggleButton: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dddddd',
    backgroundColor: COLORS.background,
  },
  toggleButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  toggleText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: '#333333',
  },
  toggleTextActive: {
    color: COLORS.white,
  },
  batchList: {
    gap: 12,
  },
  emptyBatchCard: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyBatchText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: '#888888',
    textAlign: 'center',
  },
  batchCard: {
    borderLeftWidth: 4,
  },
  batchHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  batchTimes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'center',
  },
  batchTimeText: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: COLORS.text,
  },
  pendingBadge: {
    backgroundColor: '#fff3e0',
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  pendingBadgeText: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: '#b45309',
  },
  outlineButton: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: '#dddddd',
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  outlineButtonPressed: {
    backgroundColor: COLORS.surface,
  },
  outlineButtonText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: '#333333',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  workerChip: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  workerChipText: {
    fontFamily: FONTS.bold,
    fontSize: 13,
  },
  batchCount: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#888888',
    marginTop: 8,
  },
  tableCard: {
    padding: 0,
    marginBottom: 12,
    overflow: 'hidden',
  },
  emptyTableText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: '#888888',
    textAlign: 'center',
    padding: 24,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f0',
  },
  th: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e8e8e3',
  },
  thText: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: '#555555',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0ec',
  },
  td: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    justifyContent: 'center',
  },
  tdBold: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: COLORS.text,
  },
  tdText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: '#333333',
  },
  tdMuted: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: '#cccccc',
  },
  tdMono: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.text,
  },
  tdBreak: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: '#b45309',
  },
  tdWhite: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.primary,
  },
  tdOrange: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: '#b45309',
  },
  tdTotal: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: '#1565c0',
  },
  tdWork: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: '#555555',
  },
  removeText: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: '#cccccc',
  },
  exportRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  sendButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  sendButtonText: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: COLORS.white,
  },
  sentBadgeLarge: {
    backgroundColor: '#e8f5e9',
    borderWidth: 1,
    borderColor: '#c8e6c9',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  sentBadgeLargeText: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: COLORS.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: COLORS.background,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 440,
    maxHeight: '85%',
  },
  smallModalCard: {
    maxWidth: 340,
  },
  modalTitle: {
    fontFamily: FONTS.bold,
    fontSize: 17,
    color: COLORS.text,
    marginBottom: 6,
  },
  modalSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: '#666666',
    marginBottom: 16,
  },
  bold: {
    fontFamily: FONTS.bold,
  },
  field: {
    marginBottom: 14,
    marginTop: 8,
  },
  label: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: '#333333',
    marginBottom: 6,
  },
  optionalText: {
    fontFamily: FONTS.regular,
    color: '#888888',
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
  textarea: {
    height: 80,
    textAlignVertical: 'top',
  },
  bigCenterInput: {
    fontSize: 20,
    fontFamily: FONTS.bold,
    textAlign: 'center',
  },
  helperText: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: '#888888',
    marginTop: 4,
  },
  formError: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.error,
    marginBottom: 12,
  },
  groupPreview: {
    backgroundColor: '#f5f5f0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  groupPreviewLabel: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: '#555555',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  groupPreviewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  groupPreviewNumber: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: COLORS.text,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  cancelButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#dddddd',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  cancelButtonText: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: '#333333',
  },
  modalPrimaryButton: {
    flex: 2,
    paddingVertical: 12,
  },
  quickRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 16,
  },
  quickButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#dddddd',
    backgroundColor: COLORS.background,
    alignItems: 'center',
  },
  quickButtonActive: {
    borderColor: COLORS.primary,
    backgroundColor: '#f0fff0',
  },
  quickButtonText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: '#555555',
  },
  quickButtonTextActive: {
    color: COLORS.primary,
  },
});
