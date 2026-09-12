import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import PageHeader from '../components/PageHeader';
import WorklogCard from '../components/WorklogCard';
import api from '../lib/api';
import { useLanguage } from '../lib/i18n';
import { COLORS, FONTS } from '../lib/theme';

export default function ArchiveScreen() {
  const { t } = useLanguage();
  const [worklogs, setWorklogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadWorklogs = useCallback(async () => {
    try {
      const { data } = await api.get('/api/archive/worklogs');
      setWorklogs(data.worklogs || []);
    } catch {
      // keep previous list on transient errors
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadWorklogs();
      setLoading(false);
    })();
  }, [loadWorklogs]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadWorklogs();
    setRefreshing(false);
  }, [loadWorklogs]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <PageHeader title={t('archive.title')} showMyTimesheet />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        <Text style={styles.desc}>{t('archive.desc')}</Text>

        {worklogs.length === 0 ? (
          <View style={[styles.card, styles.emptyCard]}>
            <Text style={styles.emptyTitle}>{t('archive.noLogsYet')}</Text>
            <Text style={styles.emptySubtitle}>{t('archive.noLogsDesc')}</Text>
          </View>
        ) : (
          worklogs.map((wl) => <WorklogCard key={wl.id} wl={wl} />)
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  centered: { flex: 1, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingBottom: 32 },
  desc: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: '#888888',
    marginBottom: 16,
  },
  card: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 14,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 40,
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
});
