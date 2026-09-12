import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import PageHeader from '../components/PageHeader';
import api from '../lib/api';
import { formatDateLong, todayISODate } from '../lib/dates';
import { GROUP_COLORS, HOUSE_GROUPS, getHouseGroup } from '../lib/houseGroups';
import { useLanguage } from '../lib/i18n';
import { COLORS, FONTS } from '../lib/theme';

const HOUSE_ORDER = [...HOUSE_GROUPS, 'Unknown'];
const REFRESH_MS = 30000;

function groupByHouse(batches) {
  const houseGroups = {};
  batches.forEach((b) => {
    (b.worker_numbers || []).forEach((wn) => {
      const house = getHouseGroup(wn);
      if (!houseGroups[house]) houseGroups[house] = {};
      const key = `${b.start_time || ''}|${b.finish_time || ''}`;
      if (!houseGroups[house][key]) {
        houseGroups[house][key] = { start_time: b.start_time, finish_time: b.finish_time, workers: [] };
      }
      houseGroups[house][key].workers.push(wn);
    });
  });
  return houseGroups;
}

export default function BoardScreen() {
  const { t } = useLanguage();
  const [batches, setBatches] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    let cancelled = false;
    const loadBatches = async () => {
      try {
        const { data } = await api.get(`/api/board/batches/${todayISODate()}`);
        if (!cancelled) setBatches(data.batches || []);
      } catch {
        // keep previous batches on transient errors
      } finally {
        if (!cancelled) setLoaded(true);
      }
    };
    loadBatches();
    const dataTimer = setInterval(loadBatches, REFRESH_MS);
    const clockTimer = setInterval(() => setNow(new Date()), 1000);
    return () => {
      cancelled = true;
      clearInterval(dataTimer);
      clearInterval(clockTimer);
    };
  }, []);

  const houseGroups = groupByHouse(batches);
  const activeHouses = HOUSE_ORDER.filter((h) => houseGroups[h]);
  const houseTimeGroups = (house) =>
    Object.values(houseGroups[house] || {})
      .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))
      .map((g) => ({ ...g, workers: [...g.workers].sort((a, b) => parseInt(a, 10) - parseInt(b, 10)) }));

  const timeLabel = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  if (!loaded) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <PageHeader title={t('nav.board')} showMyTimesheet />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.clockRow}>
          <Text style={styles.clockTime}>{timeLabel}</Text>
          <Text style={styles.clockDate}>{formatDateLong(now)}</Text>
        </View>
        <Text style={styles.desc}>{t('board.desc')}</Text>

        {activeHouses.length === 0 ? (
          <View style={[styles.card, styles.emptyCard]}>
            <Text style={styles.emptyTitle}>{t('board.noEntries')}</Text>
            <Text style={styles.emptySubtitle}>{t('board.noEntriesDesc')}</Text>
          </View>
        ) : (
          activeHouses.map((house) => {
            const c = GROUP_COLORS[house];
            const timeGroups = houseTimeGroups(house);
            const workerCount = timeGroups.reduce((s, g) => s + g.workers.length, 0);
            return (
              <View key={house} style={styles.houseSection}>
                <View style={styles.houseHeader}>
                  <View style={[styles.houseDot, { backgroundColor: c.border }]} />
                  <Text style={[styles.houseName, { color: c.text }]}>{house}</Text>
                  <Text style={styles.houseCount}>
                    {workerCount} {workerCount !== 1 ? t('housemaster.workers') : t('housemaster.worker')}
                  </Text>
                </View>
                <View style={[styles.houseCard, { borderColor: c.border }]}>
                  {timeGroups.map((g, i) => {
                    const hasFinish = !!g.finish_time;
                    return (
                      <View
                        key={i}
                        style={[
                          styles.timeGroupRow,
                          i < timeGroups.length - 1 && styles.timeGroupRowDivider,
                        ]}
                      >
                        <Text style={styles.timeRange}>
                          {g.start_time?.slice(0, 5)}
                          <Text style={styles.timeArrow}> → </Text>
                          {hasFinish ? (
                            g.finish_time?.slice(0, 5)
                          ) : (
                            <Text style={styles.inProgressText}>{t('board.inProgress')}</Text>
                          )}
                        </Text>
                        <View style={styles.workerChipsRow}>
                          {g.workers.map((wn) => (
                            <View key={wn} style={[styles.workerChip, { backgroundColor: c.bg, borderColor: c.border }]}>
                              <Text style={[styles.workerChipText, { color: c.text }]}>#{wn}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  centered: { flex: 1, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingBottom: 32 },
  clockRow: { marginBottom: 4 },
  clockTime: {
    fontFamily: FONTS.bold,
    fontSize: 28,
    color: COLORS.text,
    fontVariant: ['tabular-nums'],
  },
  clockDate: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: '#888888',
    marginTop: 2,
  },
  desc: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#999999',
    marginTop: 8,
    marginBottom: 16,
  },
  card: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 14,
  },
  emptyCard: { alignItems: 'center', paddingVertical: 48 },
  emptyTitle: { fontFamily: FONTS.bold, fontSize: 16, color: '#555555', marginBottom: 6 },
  emptySubtitle: { fontFamily: FONTS.regular, fontSize: 13, color: '#999999', textAlign: 'center' },
  houseSection: { marginBottom: 20 },
  houseHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  houseDot: { width: 12, height: 12, borderRadius: 3 },
  houseName: { fontFamily: FONTS.bold, fontSize: 17 },
  houseCount: { fontFamily: FONTS.medium, fontSize: 12, color: '#888888' },
  houseCard: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  timeGroupRow: { gap: 8, paddingBottom: 12, marginBottom: 12 },
  timeGroupRowDivider: { borderBottomWidth: 1, borderBottomColor: '#f0f0ec' },
  timeRange: { fontFamily: FONTS.bold, fontSize: 15, color: COLORS.text, fontVariant: ['tabular-nums'] },
  timeArrow: { color: '#bbbbbb' },
  inProgressText: { fontFamily: FONTS.bold, fontSize: 11, color: '#b45309', textTransform: 'uppercase' },
  workerChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  workerChip: { borderWidth: 1, borderRadius: 8, paddingVertical: 5, paddingHorizontal: 10 },
  workerChipText: { fontFamily: FONTS.bold, fontSize: 13 },
});
