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
import { useLanguage } from '../lib/i18n';
import { COLORS, FONTS } from '../lib/theme';

export default function HousemasterScreen() {
  const { t } = useLanguage();
  const [worklogs, setWorklogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

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
