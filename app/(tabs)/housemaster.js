import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import api from '../../lib/api';
import { formatDateMedium } from '../../lib/dates';
import { exportHousemasterWorklogExcel, exportHousemasterWorklogPdf } from '../../lib/exporters';
import { COLORS, FONTS } from '../../lib/theme';

const TABLE_HEADERS = [
  { key: 'work', label: 'Work#', width: 56 },
  { key: 'name', label: 'Name', width: 130 },
  { key: 'start', label: 'Start', width: 60 },
  { key: 'finish', label: 'Finish', width: 60 },
  { key: 'break', label: 'Break', width: 64 },
  { key: 'total', label: 'Total hrs', width: 74 },
  { key: 'work_done', label: 'Work done', width: 160 },
];

function parseLogs(wl) {
  if (Array.isArray(wl.logs)) return wl.logs;
  if (typeof wl.logs === 'string') {
    try {
      return JSON.parse(wl.logs);
    } catch {
      return [];
    }
  }
  return [];
}

function WorklogCard({ wl, onDelete }) {
  const [busy, setBusy] = useState(false);
  const logs = parseLogs(wl);
  const dateLabel = wl.session_date ? formatDateMedium(wl.session_date) : '—';

  const handlePdf = async () => {
    setBusy(true);
    try {
      await exportHousemasterWorklogPdf({ worklog: wl, logs, dateLabel });
    } catch {
      Alert.alert('Export failed', 'Could not generate the PDF. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleExcel = async () => {
    setBusy(true);
    try {
      await exportHousemasterWorklogExcel({ worklog: wl, logs, dateLabel });
    } catch {
      Alert.alert('Export failed', 'Could not generate the Excel file. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleShare = async () => {
    const lines = logs
      .map((r) => (
        `#${r.worker_number} ${r.worker_name || ''} — ${r.start_time?.slice(0, 5) || '?'} to ${r.finish_time?.slice(0, 5) || '?'} — ${r.total_hours || '?'} hrs`
      ))
      .join('\n');
    const text = `Rannikon Puutarha Work Log - ${wl.house_group} - ${dateLabel}\n\n${lines}`;
    try {
      await Share.share({ message: text, title: `Work Log — ${wl.house_group}` });
    } catch {
      // user dismissed the share sheet
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderText}>
          <Text style={styles.cardTitle}>{wl.house_group}</Text>
          <Text style={styles.cardSubtitle}>
            {dateLabel}   |   {logs.length} worker{logs.length !== 1 ? 's' : ''}
          </Text>
        </View>
        <View style={styles.actionsRow}>
          {busy ? (
            <ActivityIndicator color={COLORS.primary} />
          ) : (
            <>
              <Pressable style={styles.outlineButton} onPress={handlePdf}>
                <Text style={styles.outlineButtonText}>PDF</Text>
              </Pressable>
              <Pressable style={styles.outlineButton} onPress={handleExcel}>
                <Text style={styles.outlineButtonText}>Excel</Text>
              </Pressable>
              <Pressable style={styles.outlineButton} onPress={handleShare}>
                <Text style={styles.outlineButtonText}>Share</Text>
              </Pressable>
              <Pressable style={[styles.actionButton, styles.deleteButton]} onPress={() => onDelete(wl.id)}>
                <Text style={styles.deleteButtonText}>Delete</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>

      {logs.length === 0 ? (
        <Text style={styles.emptyText}>No worker data</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator>
          <View>
            <View style={styles.tableHeaderRow}>
              {TABLE_HEADERS.map((h) => (
                <View key={h.key} style={[styles.th, { width: h.width }]}>
                  <Text style={styles.thText}>{h.label}</Text>
                </View>
              ))}
            </View>
            {logs.map((r, i) => (
              <View
                key={i}
                style={[
                  styles.tableRow,
                  { backgroundColor: i % 2 === 0 ? COLORS.background : '#fafaf8' },
                ]}
              >
                <View style={[styles.td, { width: TABLE_HEADERS[0].width }]}>
                  <Text style={styles.tdBold}>#{r.worker_number}</Text>
                </View>
                <View style={[styles.td, { width: TABLE_HEADERS[1].width }]}>
                  <Text style={r.worker_name ? styles.tdText : styles.tdMuted} numberOfLines={1}>
                    {r.worker_name || 'Unknown'}
                  </Text>
                </View>
                <View style={[styles.td, { width: TABLE_HEADERS[2].width }]}>
                  <Text style={styles.tdMono}>{r.start_time?.slice(0, 5) || ''}</Text>
                </View>
                <View style={[styles.td, { width: TABLE_HEADERS[3].width }]}>
                  <Text style={r.finish_time ? styles.tdMono : styles.tdMuted}>
                    {r.finish_time?.slice(0, 5) || '—'}
                  </Text>
                </View>
                <View style={[styles.td, { width: TABLE_HEADERS[4].width }]}>
                  <Text style={styles.tdBreak}>
                    {r.total_break_mins > 0 ? `${r.total_break_mins} min` : ''}
                  </Text>
                </View>
                <View style={[styles.td, { width: TABLE_HEADERS[5].width }]}>
                  <Text style={styles.tdTotal}>{r.total_hours || ''}</Text>
                </View>
                <View style={[styles.td, { width: TABLE_HEADERS[6].width }]}>
                  <Text style={styles.tdWork} numberOfLines={2}>
                    {r.what_work || ''}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

export default function HousemasterScreen() {
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
      Alert.alert('Delete failed', err.response?.data?.error || 'Could not delete the worklog. Please try again.');
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
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Work logs</Text>
            <Text style={styles.subtitle}>Work logs sent to you from the admin</Text>
          </View>
          <Pressable style={styles.outlineButton} onPress={loadWorklogs}>
            <Text style={styles.outlineButtonText}>Refresh</Text>
          </Pressable>
        </View>

        {worklogs.length === 0 ? (
          <View style={[styles.card, styles.emptyCard]}>
            <Text style={styles.emptyTitle}>No work logs received yet</Text>
            <Text style={styles.emptySubtitle}>
              When the admin sends a work log to your group, it will appear here.
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
            <Text style={styles.confirmTitle}>Delete worklog?</Text>
            <Text style={styles.confirmText}>This will permanently remove this worklog.</Text>
            <View style={styles.confirmButtons}>
              <Pressable style={styles.confirmCancelButton} onPress={() => setConfirmDeleteId(null)}>
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.confirmDeleteButton} onPress={() => deleteWorklog(confirmDeleteId)}>
                <Text style={styles.confirmDeleteText}>Delete</Text>
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
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
    flexWrap: 'wrap',
    gap: 8,
  },
  cardHeaderText: {
    flexShrink: 1,
  },
  cardTitle: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: COLORS.text,
  },
  cardSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: '#bbbbbb',
    textAlign: 'center',
    paddingVertical: 20,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.primary,
    borderRadius: 6,
    overflow: 'hidden',
  },
  th: {
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  thText: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: COLORS.white,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  td: {
    paddingVertical: 8,
    paddingHorizontal: 8,
    justifyContent: 'center',
  },
  tdText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.text,
  },
  tdMuted: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#cccccc',
  },
  tdBold: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: COLORS.text,
  },
  tdMono: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.text,
  },
  tdBreak: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: '#b45309',
  },
  tdTotal: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: COLORS.primary,
  },
  tdWork: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#555555',
  },
  actionButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  deleteButton: {
    backgroundColor: '#fdecea',
    borderWidth: 1,
    borderColor: '#ffc1c0',
  },
  deleteButtonText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: '#c0392b',
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
