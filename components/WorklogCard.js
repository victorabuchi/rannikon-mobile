import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { formatDateMedium } from '../lib/dates';
import { exportHousemasterWorklogExcel, exportHousemasterWorklogPdf } from '../lib/exporters';
import { useLanguage } from '../lib/i18n';
import { COLORS, FONTS } from '../lib/theme';

const TABLE_HEADERS = [
  { key: 'work', labelKey: 'housemaster.colWorkNum', width: 56 },
  { key: 'name', labelKey: 'housemaster.colName', width: 130 },
  { key: 'start', labelKey: 'housemaster.colStart', width: 60 },
  { key: 'finish', labelKey: 'housemaster.colFinish', width: 60 },
  { key: 'break', labelKey: 'housemaster.colBreak', width: 64 },
  { key: 'total', labelKey: 'housemaster.colTotalHrs', width: 74 },
  { key: 'work_done', labelKey: 'housemaster.colWorkDone', width: 160 },
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

// Shared by the housemaster tab (own house group, editable/deletable) and
// the read-only archive tab (every house group, no delete) - same worklog
// shape (wl.house_group / wl.session_date / wl.logs) on both backends.
export default function WorklogCard({ wl, onDelete, extraHeaderText }) {
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);
  const logs = parseLogs(wl);
  const dateLabel = wl.session_date ? formatDateMedium(wl.session_date) : '—';

  const handlePdf = async () => {
    setBusy(true);
    try {
      await exportHousemasterWorklogPdf({ worklog: wl, logs, dateLabel });
    } catch {
      // export failure is surfaced via Alert by the caller's own error UI
    } finally {
      setBusy(false);
    }
  };

  const handleExcel = async () => {
    setBusy(true);
    try {
      await exportHousemasterWorklogExcel({ worklog: wl, logs, dateLabel });
    } finally {
      setBusy(false);
    }
  };

  const handleShare = async () => {
    const lines = logs
      .map((r) => (
        `#${r.worker_number} ${r.worker_name || ''} — ${r.start_time?.slice(0, 5) || '?'} ${t('common.to')} ${r.finish_time?.slice(0, 5) || '?'} — ${r.total_hours || '?'} hrs`
      ))
      .join('\n');
    const text = `${t('housemaster.shareTextTitle')} - ${wl.house_group} - ${dateLabel}\n\n${lines}`;
    try {
      await Share.share({ message: text, title: `${t('housemaster.shareTitlePrefix')} — ${wl.house_group}` });
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
            {dateLabel}   |   {logs.length} {logs.length !== 1 ? t('housemaster.workers') : t('housemaster.worker')}
            {extraHeaderText ? `   |   ${extraHeaderText}` : ''}
          </Text>
        </View>
        <View style={styles.actionsRow}>
          {busy ? (
            <ActivityIndicator color={COLORS.primary} />
          ) : (
            <>
              <Pressable style={styles.outlineButton} onPress={handlePdf}>
                <Text style={styles.outlineButtonText}>{t('common.pdf')}</Text>
              </Pressable>
              <Pressable style={styles.outlineButton} onPress={handleExcel}>
                <Text style={styles.outlineButtonText}>{t('common.excel')}</Text>
              </Pressable>
              <Pressable style={styles.outlineButton} onPress={handleShare}>
                <Text style={styles.outlineButtonText}>{t('common.share')}</Text>
              </Pressable>
              {onDelete && (
                <Pressable style={[styles.actionButton, styles.deleteButton]} onPress={() => onDelete(wl.id)}>
                  <Text style={styles.deleteButtonText}>{t('common.delete')}</Text>
                </Pressable>
              )}
            </>
          )}
        </View>
      </View>

      {logs.length === 0 ? (
        <Text style={styles.emptyText}>{t('housemaster.noWorkerData')}</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator>
          <View>
            <View style={styles.tableHeaderRow}>
              {TABLE_HEADERS.map((h) => (
                <View key={h.key} style={[styles.th, { width: h.width }]}>
                  <Text style={styles.thText}>{t(h.labelKey)}</Text>
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
                    {r.worker_name || t('common.unknown')}
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
                    {r.total_break_mins > 0 ? `${r.total_break_mins} ${t('sup.min')}` : ''}
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

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
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
});
