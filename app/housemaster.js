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

import PageHeader from '../components/PageHeader';
import WorklogCard from '../components/WorklogCard';
import api from '../lib/api';
import { useRoleGuard } from '../lib/auth';
import { useLanguage } from '../lib/i18n';
import { COLORS, FONTS } from '../lib/theme';

export default function HousemasterScreen() {
  useRoleGuard(['housemaster', 'admin']);
  const { t } = useLanguage();
  const [tab, setTab] = useState('worklogs');
  const [worklogs, setWorklogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const [requests, setRequests] = useState([]);
  const [requestsLoaded, setRequestsLoaded] = useState(false);
  const [forwardingId, setForwardingId] = useState(null);

  const loadRequests = useCallback(async () => {
    setRequestsLoaded(true);
    try {
      const { data } = await api.get('/api/leave-requests/housemaster');
      setRequests(data.requests || []);
    } catch {
      // keep previous list on transient errors
    }
  }, []);

  const forwardRequest = async (id) => {
    setForwardingId(id);
    try {
      await api.post(`/api/leave-requests/${id}/forward`);
      setRequests((prev) => prev.filter((r) => r.id !== id));
    } catch {
      Alert.alert(t('common.error'), t('requests.submitFailed'));
    } finally {
      setForwardingId(null);
    }
  };

  const handleTabChange = (key) => {
    setTab(key);
    if (key === 'requests' && !requestsLoaded) loadRequests();
  };

  const loadWorklogs = useCallback(async () => {
    const { data } = await api.get('/api/admin/housemaster-worklogs');
    const sorted = (data.worklogs || []).sort((a, b) => {
      const da = new Date(a.session_date || a.sent_at);
      const db = new Date(b.session_date || b.sent_at);
      return db - da;
    });
    setWorklogs(sorted);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        await loadWorklogs();
      } finally {
        setLoading(false);
      }
    })();
  }, [loadWorklogs]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadWorklogs();
    } finally {
      setRefreshing(false);
    }
  }, [loadWorklogs]);

  const deleteWorklog = async (id) => {
    try {
      await api.delete(`/api/admin/housemaster-worklogs/${id}`);
      setWorklogs((wls) => wls.filter((w) => w.id !== id));
      setConfirmDeleteId(null);
    } catch (err) {
      Alert.alert(t('housemaster.deleteFailedTitle'), err.response?.data?.error || t('housemaster.deleteFailedMessage'));
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
      <PageHeader title={t('housemaster.workLogs')} showMyTimesheet />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
      >
        <View style={styles.tabRow}>
          {[
            ['worklogs', t('housemaster.tabWorklogs')],
            ['requests', t('housemaster.tabRequests')],
          ].map(([key, label]) => (
            <Pressable
              key={key}
              style={[styles.tabButton, tab === key && styles.tabButtonActive]}
              onPress={() => handleTabChange(key)}
            >
              <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {tab === 'worklogs' && (
          <>
            <View style={styles.header}>
              <View>
                <Text style={styles.subtitle}>{t('housemaster.workLogsSentDesc')}</Text>
              </View>
              <Pressable style={styles.outlineButton} onPress={loadWorklogs}>
                <Text style={styles.outlineButtonText}>{t('common.refresh')}</Text>
              </Pressable>
            </View>

            {worklogs.length === 0 ? (
              <View style={[styles.card, styles.emptyCard]}>
                <Text style={styles.emptyTitle}>{t('housemaster.noLogsYet')}</Text>
                <Text style={styles.emptySubtitle}>
                  {t('housemaster.noLogsDesc')}
                </Text>
              </View>
            ) : (
              worklogs.map((wl) => <WorklogCard key={wl.id} wl={wl} onDelete={setConfirmDeleteId} />)
            )}
          </>
        )}

        {tab === 'requests' && (
          <>
            <View style={styles.header}>
              <View>
                <Text style={styles.title}>{t('housemaster.tabRequests')}</Text>
              </View>
              <Pressable style={styles.outlineButton} onPress={loadRequests}>
                <Text style={styles.outlineButtonText}>{t('common.refresh')}</Text>
              </Pressable>
            </View>

            {requests.length === 0 ? (
              <View style={[styles.card, styles.emptyCard]}>
                <Text style={styles.emptyTitle}>{t('requests.noPendingRequests')}</Text>
                <Text style={styles.emptySubtitle}>{t('requests.noPendingRequestsDesc')}</Text>
              </View>
            ) : (
              requests.map((r) => (
                <View key={r.id} style={[styles.card, styles.requestRow]}>
                  <View style={{ flex: 1, minWidth: 160 }}>
                    <Text style={styles.requestWorker}>#{r.work_number} {r.full_name}</Text>
                    <Text style={styles.requestMeta}>
                      {t(`requests.type${r.request_type.charAt(0).toUpperCase()}${r.request_type.slice(1)}`)}
                      {'  ·  '}{r.start_date} → {r.end_date}
                      {r.reason ? `  ·  ${r.reason}` : ''}
                    </Text>
                  </View>
                  <Pressable
                    style={[styles.primaryButtonSmall, forwardingId === r.id && styles.buttonDisabled]}
                    onPress={() => forwardRequest(r.id)}
                    disabled={forwardingId === r.id}
                  >
                    <Text style={styles.primaryButtonSmallText}>
                      {forwardingId === r.id ? t('requests.forwarding') : t('requests.forward')}
                    </Text>
                  </Pressable>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>

      <Modal
        visible={confirmDeleteId != null}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmDeleteId(null)}
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>{t('housemaster.deleteWorklogTitle')}</Text>
            <Text style={styles.confirmText}>{t('housemaster.deleteWorklogDesc')}</Text>
            <View style={styles.confirmButtons}>
              <Pressable style={styles.confirmCancelButton} onPress={() => setConfirmDeleteId(null)}>
                <Text style={styles.confirmCancelText}>{t('common.cancel')}</Text>
              </Pressable>
              <Pressable style={styles.confirmDeleteButton} onPress={() => deleteWorklog(confirmDeleteId)}>
                <Text style={styles.confirmDeleteText}>{t('common.delete')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 16,
  },
  tabButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dddddd',
    backgroundColor: COLORS.background,
  },
  tabButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  tabText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: '#555555',
  },
  tabTextActive: {
    color: COLORS.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 20,
    color: COLORS.text,
  },
  subtitle: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  outlineButton: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: COLORS.background,
  },
  outlineButtonText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.text,
  },
  card: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyTitle: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: COLORS.text,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  requestRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
  },
  requestWorker: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: COLORS.text,
    marginBottom: 2,
  },
  requestMeta: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#888888',
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
  buttonDisabled: {
    opacity: 0.6,
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
