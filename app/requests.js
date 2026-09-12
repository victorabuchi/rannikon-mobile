import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import DashboardViewSwitcher from '../components/DashboardViewSwitcher';
import DatePickerModal from '../components/DatePickerModal';
import PageHeader from '../components/PageHeader';
import api from '../lib/api';
import { todayISODate } from '../lib/dates';
import { useLanguage } from '../lib/i18n';
import { COLORS, FONTS } from '../lib/theme';

const REQUEST_TYPES = ['holiday', 'break', 'leave', 'other'];

const STATUS_STYLE = {
  pending_housemaster: { bg: '#fff3e0', text: '#b45309', labelKey: 'requests.statusPendingHousemaster' },
  pending_admin: { bg: '#e3f2fd', text: '#1565c0', labelKey: 'requests.statusPendingAdmin' },
  approved: { bg: '#e8f5e9', text: '#2d6a2d', labelKey: 'requests.statusApproved' },
  rejected: { bg: '#fdecea', text: '#c0392b', labelKey: 'requests.statusRejected' },
};

function RequestStatusBadge({ status }) {
  const { t } = useLanguage();
  const st = STATUS_STYLE[status] || STATUS_STYLE.pending_housemaster;
  return (
    <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
      <Text style={[styles.statusBadgeText, { color: st.text }]}>{t(st.labelKey)}</Text>
    </View>
  );
}

export default function RequestsScreen() {
  const { t } = useLanguage();
  const [reqType, setReqType] = useState('holiday');
  const [reqStart, setReqStart] = useState('');
  const [reqEnd, setReqEnd] = useState('');
  const [reqReason, setReqReason] = useState('');
  const [reqError, setReqError] = useState('');
  const [reqSubmitting, setReqSubmitting] = useState(false);
  const [pickingDate, setPickingDate] = useState(null); // 'start' | 'end' | null

  const [myRequests, setMyRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [absenceStatus, setAbsenceStatus] = useState(null);

  const loadMyRequests = useCallback(async () => {
    try {
      const { data } = await api.get('/api/leave-requests/mine');
      setMyRequests(data.requests || []);
    } catch {
      // keep previous list on transient errors
    }
  }, []);

  const loadAbsenceStatus = useCallback(async () => {
    try {
      const { data } = await api.get('/api/leave-requests/my-absence-status');
      setAbsenceStatus(data.status);
    } catch {
      // non-critical - skip the banner on failure
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([loadMyRequests(), loadAbsenceStatus()]);
      setLoading(false);
    })();
  }, [loadMyRequests, loadAbsenceStatus]);

  const submitRequest = async () => {
    setReqError('');
    if (!reqStart || !reqEnd) {
      setReqError(t('requests.invalidDates'));
      return;
    }
    if (reqStart > reqEnd) {
      setReqError(t('requests.invalidDates'));
      return;
    }
    setReqSubmitting(true);
    try {
      await api.post('/api/leave-requests', {
        request_type: reqType,
        reason: reqReason,
        start_date: reqStart,
        end_date: reqEnd,
      });
      setReqReason('');
      setReqStart('');
      setReqEnd('');
      setReqType('holiday');
      await loadMyRequests();
    } catch (err) {
      setReqError(err.response?.data?.error || t('requests.submitFailed'));
    } finally {
      setReqSubmitting(false);
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
    <SafeAreaView style={styles.container} edges={['top']}>
      <PageHeader title={t('requests.tabLabel')} />
      <DashboardViewSwitcher active="requests" showRequests />

      {absenceStatus && (
        <View
          style={[
            styles.absenceBanner,
            { backgroundColor: absenceStatus.level === 'flagged' ? '#fdecea' : '#fff3e0' },
          ]}
        >
          <Text
            style={[
              styles.absenceBannerText,
              { color: absenceStatus.level === 'flagged' ? '#c0392b' : '#b45309' },
            ]}
          >
            {(absenceStatus.level === 'flagged'
              ? t('requests.absenceFlaggedBanner')
              : t('requests.absenceWarningBanner')
            ).replace('{days}', absenceStatus.consecutive_days)}
          </Text>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>{t('requests.newRequest')}</Text>
          </View>
          <View style={styles.sectionBody}>
            <Text style={styles.fieldLabel}>{t('requests.typeLabel')}</Text>
            <View style={styles.typeRow}>
              {REQUEST_TYPES.map((type) => (
                <Pressable
                  key={type}
                  style={[styles.typeChip, reqType === type && styles.typeChipActive]}
                  onPress={() => setReqType(type)}
                >
                  <Text style={[styles.typeChipText, reqType === type && styles.typeChipTextActive]}>
                    {t(`requests.type${type.charAt(0).toUpperCase()}${type.slice(1)}`)}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.dateFieldsRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>{t('requests.startDate')}</Text>
                <Pressable style={styles.dateInput} onPress={() => setPickingDate('start')}>
                  <Text style={reqStart ? styles.dateInputText : styles.dateInputPlaceholder}>
                    {reqStart || 'YYYY-MM-DD'}
                  </Text>
                </Pressable>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>{t('requests.endDate')}</Text>
                <Pressable style={styles.dateInput} onPress={() => setPickingDate('end')}>
                  <Text style={reqEnd ? styles.dateInputText : styles.dateInputPlaceholder}>
                    {reqEnd || 'YYYY-MM-DD'}
                  </Text>
                </Pressable>
              </View>
            </View>

            <Text style={styles.fieldLabel}>{t('requests.reasonLabel')}</Text>
            <TextInput
              style={styles.reasonInput}
              placeholder={t('requests.reasonPlaceholder')}
              placeholderTextColor={COLORS.textMuted}
              value={reqReason}
              onChangeText={setReqReason}
              multiline
            />

            {!!reqError && <Text style={styles.errorText}>{reqError}</Text>}

            <Pressable
              style={[styles.primaryButton, reqSubmitting && styles.buttonDisabled]}
              onPress={submitRequest}
              disabled={reqSubmitting}
            >
              <Text style={styles.primaryButtonText}>
                {reqSubmitting ? t('requests.submitting') : t('requests.submit')}
              </Text>
            </Pressable>
          </View>
        </View>

        <Text style={styles.myRequestsTitle}>{t('requests.myRequests')}</Text>
        {myRequests.length === 0 ? (
          <View style={[styles.card, styles.emptyCard]}>
            <Text style={styles.emptyTitle}>{t('requests.noRequestsYet')}</Text>
            <Text style={styles.emptySubtitle}>{t('requests.noRequestsYetDesc')}</Text>
          </View>
        ) : (
          myRequests.map((r) => (
            <View key={r.id} style={[styles.card, styles.requestRow]}>
              <Text style={styles.requestType}>
                {t(`requests.type${r.request_type.charAt(0).toUpperCase()}${r.request_type.slice(1)}`)}
              </Text>
              <Text style={styles.requestPeriod}>{r.start_date} → {r.end_date}</Text>
              {!!r.reason && (
                <Text style={styles.requestReason} numberOfLines={1}>{r.reason}</Text>
              )}
              <RequestStatusBadge status={r.status} />
            </View>
          ))
        )}
      </ScrollView>

      <DatePickerModal
        visible={!!pickingDate}
        selectedDate={(pickingDate === 'start' ? reqStart : reqEnd) || todayISODate()}
        onSelect={(date) => {
          if (pickingDate === 'start') setReqStart(date);
          else setReqEnd(date);
          setPickingDate(null);
        }}
        onClose={() => setPickingDate(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: { flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingBottom: 32 },
  absenceBanner: { paddingVertical: 10, paddingHorizontal: 16 },
  absenceBannerText: { fontFamily: FONTS.medium, fontSize: 13 },
  sectionCard: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: '#e8e8e3',
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 20,
  },
  sectionHeader: { backgroundColor: COLORS.primary, paddingVertical: 12, paddingHorizontal: 16 },
  sectionHeaderText: { fontFamily: FONTS.bold, fontSize: 14, color: COLORS.white },
  sectionBody: { padding: 16 },
  fieldLabel: { fontFamily: FONTS.medium, fontSize: 12, color: '#555555', marginBottom: 8 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  typeChip: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#dddddd',
    backgroundColor: COLORS.background,
  },
  typeChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  typeChipText: { fontFamily: FONTS.medium, fontSize: 13, color: '#555555' },
  typeChipTextActive: { color: COLORS.white },
  dateFieldsRow: { flexDirection: 'row', gap: 12, marginBottom: 4 },
  dateInput: {
    borderWidth: 1,
    borderColor: '#cccccc',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: COLORS.background,
    marginBottom: 16,
  },
  dateInputText: { fontFamily: FONTS.medium, fontSize: 14, color: COLORS.text },
  dateInputPlaceholder: { fontFamily: FONTS.regular, fontSize: 14, color: COLORS.textMuted },
  reasonInput: {
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
  errorText: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.error, marginBottom: 12 },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignSelf: 'flex-start',
  },
  primaryButtonText: { fontFamily: FONTS.bold, fontSize: 14, color: COLORS.white },
  buttonDisabled: { opacity: 0.6 },
  myRequestsTitle: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: '#555555',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  card: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: '#e8e8e3',
    borderRadius: 8,
    padding: 14,
    marginBottom: 8,
  },
  emptyCard: { alignItems: 'center', paddingVertical: 24 },
  emptyTitle: { fontFamily: FONTS.medium, fontSize: 14, color: '#888888' },
  emptySubtitle: { fontFamily: FONTS.regular, fontSize: 12, color: '#aaaaaa', marginTop: 4 },
  requestRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  requestType: { fontFamily: FONTS.bold, fontSize: 13, color: COLORS.text, textTransform: 'capitalize' },
  requestPeriod: { fontFamily: FONTS.regular, fontSize: 12, color: '#666666' },
  requestReason: { fontFamily: FONTS.regular, fontSize: 12, color: '#888888', flex: 1, minWidth: 100 },
  statusBadge: { borderRadius: 8, paddingVertical: 3, paddingHorizontal: 9 },
  statusBadgeText: { fontFamily: FONTS.bold, fontSize: 11 },
});
