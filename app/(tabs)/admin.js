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
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { GroupPill, RoleBadge, StatCard } from '../../components/Badges';
import api from '../../lib/api';
import { addDaysToISODate, formatDateMedium, formatDateShort, todayISODate } from '../../lib/dates';
import { HOUSE_GROUPS } from '../../lib/houseGroups';
import { COLORS, FONTS } from '../../lib/theme';

const ROLE_OPTIONS = ['worker', 'supervisor', 'housemaster', 'admin'];

const WORKERS_HEADERS = [
  { key: 'work', label: 'Work#', width: 56 },
  { key: 'name', label: 'Name', width: 110 },
  { key: 'email', label: 'Email', width: 160 },
  { key: 'role', label: 'Role', width: 100 },
  { key: 'group', label: 'Group', width: 140 },
  { key: 'status', label: 'Status', width: 70 },
  { key: 'actions', label: 'Actions', width: 110 },
];

const LOGS_HEADERS = [
  { key: 'work', label: 'Work#', width: 56 },
  { key: 'name', label: 'Name', width: 110 },
  { key: 'start', label: 'Start', width: 60 },
  { key: 'finish', label: 'Finish', width: 60 },
  { key: 'break', label: 'Break', width: 64 },
  { key: 'total', label: 'Total hrs', width: 70 },
  { key: 'workdone', label: 'Work done', width: 150 },
];

const INVITATIONS_HEADERS = [
  { key: 'email', label: 'Email', width: 170 },
  { key: 'work', label: 'Work#', width: 60 },
  { key: 'role', label: 'Role', width: 90 },
  { key: 'invitedby', label: 'Invited by', width: 120 },
  { key: 'created', label: 'Created', width: 90 },
  { key: 'status', label: 'Status', width: 80 },
];

export default function AdminScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState('workers');
  const [stats, setStats] = useState(null);

  const [workers, setWorkers] = useState([]);
  const [search, setSearch] = useState('');
  const [updatingId, setUpdatingId] = useState(null);
  const [roleModalWorker, setRoleModalWorker] = useState(null);

  const [logsDate, setLogsDate] = useState(todayISODate());
  const [grouped, setGrouped] = useState({});
  const [logsLoading, setLogsLoading] = useState(false);
  const [sentGroups, setSentGroups] = useState({});
  const [sendingGroup, setSendingGroup] = useState('');

  const [invitations, setInvitations] = useState([]);
  const [invLoading, setInvLoading] = useState(false);

  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', work_number: '', role: 'worker', house_group: '' });
  const [inviteSaving, setInviteSaving] = useState(false);
  const [inviteUrl, setInviteUrl] = useState('');
  const [inviteError, setInviteError] = useState('');

  const loadStats = async () => {
    try {
      const { data } = await api.get('/api/admin/stats');
      setStats(data);
    } catch {
      // keep previous stats on transient errors
    }
  };

  const loadWorkers = async () => {
    try {
      const { data } = await api.get('/api/admin/workers');
      setWorkers(data.workers || []);
    } catch {
      // keep previous workers on transient errors
    }
  };

  const loadLogs = async (date) => {
    setLogsLoading(true);
    try {
      const { data } = await api.get(`/api/admin/supervisor-logs/${date}`);
      const g = {};
      HOUSE_GROUPS.forEach((grp) => {
        g[grp] = data.grouped?.[grp] || [];
      });
      setGrouped(g);
      setSentGroups({});
    } catch {
      setGrouped({});
    } finally {
      setLogsLoading(false);
    }
  };

  const loadInvitations = async () => {
    setInvLoading(true);
    try {
      const { data } = await api.get('/api/admin/invitations');
      setInvitations(data.invitations || []);
    } catch {
      // keep previous invitations on transient errors
    } finally {
      setInvLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([loadStats(), loadWorkers()]);
      setLoading(false);
    })();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadStats(), loadWorkers()]);
    if (tab === 'logs') await loadLogs(logsDate);
    if (tab === 'invitations') await loadInvitations();
    setRefreshing(false);
  }, [tab, logsDate]);

  const handleTabChange = (t) => {
    setTab(t);
    if (t === 'logs' && Object.keys(grouped).length === 0) loadLogs(logsDate);
    if (t === 'invitations' && invitations.length === 0) loadInvitations();
  };

  const updateWorker = async (id, patch) => {
    setUpdatingId(id);
    try {
      await api.patch(`/api/admin/workers/${id}`, patch);
      await loadWorkers();
      await loadStats();
    } catch {
      // ignore; worker list stays unchanged
    } finally {
      setUpdatingId(null);
    }
  };

  const sendInvite = async () => {
    setInviteError('');
    if (!inviteForm.role) {
      setInviteError('Role is required');
      return;
    }
    if (!inviteForm.email && !inviteForm.work_number) {
      setInviteError('Email or work number is required');
      return;
    }
    setInviteSaving(true);
    try {
      const body = { ...inviteForm };
      if (inviteForm.role !== 'housemaster') delete body.house_group;
      const { data } = await api.post('/api/admin/invite', body);
      setInviteUrl(data.register_url || '');
    } catch (e) {
      setInviteError(e.response?.data?.error || 'Failed to send invitation');
    } finally {
      setInviteSaving(false);
    }
  };

  const resetInviteModal = () => {
    setInviteForm({ email: '', work_number: '', role: 'worker', house_group: '' });
    setInviteUrl('');
    setInviteError('');
    setShowInvite(false);
  };

  const sendToHousemaster = async (group) => {
    const rows = grouped[group] || [];
    if (!rows.length) return;
    setSendingGroup(group);
    try {
      await api.post('/api/admin/send-to-housemaster', { house_group: group, date: logsDate, logs: rows });
      setSentGroups((s) => ({ ...s, [group]: true }));
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to send');
    } finally {
      setSendingGroup('');
    }
  };

  const changeLogsDate = (delta) => {
    const next = addDaysToISODate(logsDate, delta);
    setLogsDate(next);
    loadLogs(next);
  };

  const filteredWorkers = workers.filter((w) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      w.full_name?.toLowerCase().includes(q) ||
      w.work_number?.toLowerCase().includes(q) ||
      w.email?.toLowerCase().includes(q)
    );
  });

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
          <View style={styles.headerText}>
            <Text style={styles.title}>Admin panel</Text>
            <Text style={styles.subtitle}>Manage workers, view logs, send invitations</Text>
          </View>
          <Pressable
            style={styles.primaryButtonSmall}
            onPress={() => {
              setInviteUrl('');
              setInviteError('');
              setShowInvite(true);
            }}
          >
            <Text style={styles.primaryButtonSmallText}>+ Invite</Text>
          </Pressable>
        </View>

        {stats && (
          <View style={styles.statsRow}>
            <StatCard label="Total workers" value={stats.total_workers} />
            <StatCard label="Active" value={stats.active_workers} accent={COLORS.primary} />
            <StatCard label="Supervisors" value={stats.total_supervisors} accent="#1565c0" />
            <StatCard label="Housemasters" value={stats.total_housemasters} accent="#7b1fa2" />
            <StatCard label="Entries today" value={stats.entries_today} accent="#b45309" />
          </View>
        )}

        <View style={styles.tabRow}>
          {[
            ['workers', 'Workers'],
            ['logs', 'Supervisor Logs'],
            ['invitations', 'Invitations'],
          ].map(([t, l]) => (
            <Pressable
              key={t}
              style={[styles.tabButton, tab === t && styles.tabButtonActive]}
              onPress={() => handleTabChange(t)}
            >
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{l}</Text>
            </Pressable>
          ))}
        </View>

        {tab === 'workers' && (
          <View style={[styles.card, styles.tableCard]}>
            <View style={styles.searchRow}>
              <TextInput
                style={[styles.input, styles.searchInput]}
                placeholder="Search by name, work number, or email..."
                placeholderTextColor={COLORS.textMuted}
                value={search}
                onChangeText={setSearch}
              />
              <Text style={styles.shownText}>{filteredWorkers.length} shown</Text>
            </View>
            {filteredWorkers.length === 0 ? (
              <Text style={styles.emptyTableText}>No workers found</Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator>
                <View>
                  <View style={styles.tableHeaderRow}>
                    {WORKERS_HEADERS.map((h) => (
                      <View key={h.key} style={[styles.th, { width: h.width }]}>
                        <Text style={styles.thText}>{h.label}</Text>
                      </View>
                    ))}
                  </View>
                  {filteredWorkers.map((w, i) => (
                    <View
                      key={w.id}
                      style={[styles.tableRow, { backgroundColor: i % 2 === 0 ? COLORS.background : '#fafaf8' }]}
                    >
                      <View style={[styles.td, { width: WORKERS_HEADERS[0].width }]}>
                        <Text style={styles.tdMono}>#{w.work_number}</Text>
                      </View>
                      <View style={[styles.td, { width: WORKERS_HEADERS[1].width }]}>
                        <Text style={styles.tdBold} numberOfLines={1}>
                          {w.full_name}
                        </Text>
                      </View>
                      <View style={[styles.td, { width: WORKERS_HEADERS[2].width }]}>
                        <Text style={w.email ? styles.tdMutedSmall : styles.tdMuted} numberOfLines={1}>
                          {w.email || '—'}
                        </Text>
                      </View>
                      <View style={[styles.td, { width: WORKERS_HEADERS[3].width }]}>
                        <Pressable onPress={() => setRoleModalWorker(w)} disabled={updatingId === w.id}>
                          <RoleBadge role={w.role} />
                        </Pressable>
                      </View>
                      <View style={[styles.td, { width: WORKERS_HEADERS[4].width }]}>
                        <GroupPill group={w.house_group} />
                      </View>
                      <View style={[styles.td, { width: WORKERS_HEADERS[5].width }]}>
                        <View style={[styles.statusBadge, w.is_active ? styles.statusActive : styles.statusInactive]}>
                          <Text
                            style={[
                              styles.statusText,
                              { color: w.is_active ? COLORS.primary : '#c0392b' },
                            ]}
                          >
                            {w.is_active ? 'Active' : 'Inactive'}
                          </Text>
                        </View>
                      </View>
                      <View style={[styles.td, { width: WORKERS_HEADERS[6].width }]}>
                        <Pressable
                          style={[
                            styles.toggleActiveButton,
                            { backgroundColor: w.is_active ? '#fdecea' : '#e8f5e9' },
                          ]}
                          onPress={() => updateWorker(w.id, { is_active: !w.is_active })}
                          disabled={updatingId === w.id}
                        >
                          <Text
                            style={[
                              styles.toggleActiveText,
                              { color: w.is_active ? '#c0392b' : COLORS.primary },
                            ]}
                          >
                            {w.is_active ? 'Deactivate' : 'Activate'}
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </View>
              </ScrollView>
            )}
          </View>
        )}

        {tab === 'logs' && (
          <View>
            <View style={styles.dateRow}>
              <Pressable style={styles.dateNavButton} onPress={() => changeLogsDate(-1)}>
                <Text style={styles.dateNavText}>‹</Text>
              </Pressable>
              <View style={styles.dateDisplay}>
                <Text style={styles.label}>Date</Text>
                <Text style={styles.dateValue}>{formatDateMedium(logsDate)}</Text>
              </View>
              <Pressable style={styles.dateNavButton} onPress={() => changeLogsDate(1)}>
                <Text style={styles.dateNavText}>›</Text>
              </Pressable>
              <Pressable style={styles.outlineButton} onPress={() => loadLogs(logsDate)}>
                <Text style={styles.outlineButtonText}>Reload</Text>
              </Pressable>
            </View>

            {logsLoading && <Text style={styles.loadingText}>Loading...</Text>}

            {!logsLoading &&
              HOUSE_GROUPS.map((group) => {
                const rows = grouped[group] || [];
                const isSending = sendingGroup === group;
                const isSent = sentGroups[group];
                return (
                  <View key={group} style={[styles.card, styles.groupCard]}>
                    <View style={styles.groupHeader}>
                      <View style={styles.groupHeaderLeft}>
                        <GroupPill group={group} />
                        <Text style={styles.groupCount}>
                          {rows.length} worker{rows.length !== 1 ? 's' : ''}
                        </Text>
                      </View>
                      {isSent ? (
                        <View style={styles.sentBadge}>
                          <Text style={styles.sentBadgeText}>Sent</Text>
                        </View>
                      ) : rows.length > 0 ? (
                        <Pressable
                          style={styles.primaryButtonSmall}
                          onPress={() => sendToHousemaster(group)}
                          disabled={isSending}
                        >
                          <Text style={styles.primaryButtonSmallText}>
                            {isSending ? 'Sending...' : 'Send to housemaster'}
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                    {rows.length === 0 ? (
                      <Text style={styles.emptyGroupText}>No logs for this group</Text>
                    ) : (
                      <ScrollView horizontal showsHorizontalScrollIndicator>
                        <View>
                          <View style={styles.tableHeaderRow}>
                            {LOGS_HEADERS.map((h) => (
                              <View key={h.key} style={[styles.th, { width: h.width }]}>
                                <Text style={styles.thText}>{h.label}</Text>
                              </View>
                            ))}
                          </View>
                          {rows.map((r, i) => (
                            <View
                              key={r.id || i}
                              style={[styles.tableRow, { backgroundColor: i % 2 === 0 ? COLORS.background : '#fafaf8' }]}
                            >
                              <View style={[styles.td, { width: LOGS_HEADERS[0].width }]}>
                                <Text style={styles.tdBold}>#{r.worker_number}</Text>
                              </View>
                              <View style={[styles.td, { width: LOGS_HEADERS[1].width }]}>
                                <Text style={r.worker_name ? styles.tdText : styles.tdMuted} numberOfLines={1}>
                                  {r.worker_name || 'Unknown'}
                                </Text>
                              </View>
                              <View style={[styles.td, { width: LOGS_HEADERS[2].width }]}>
                                <Text style={styles.tdMono}>{r.start_time?.slice(0, 5) || ''}</Text>
                              </View>
                              <View style={[styles.td, { width: LOGS_HEADERS[3].width }]}>
                                <Text style={r.finish_time ? styles.tdMono : styles.tdMuted}>
                                  {r.finish_time?.slice(0, 5) || 'pending'}
                                </Text>
                              </View>
                              <View style={[styles.td, { width: LOGS_HEADERS[4].width }]}>
                                <Text style={styles.tdBreak}>
                                  {r.total_break_mins > 0 ? `${r.total_break_mins} min` : ''}
                                </Text>
                              </View>
                              <View style={[styles.td, { width: LOGS_HEADERS[5].width }]}>
                                <Text style={styles.tdTotal}>{r.total_hours || ''}</Text>
                              </View>
                              <View style={[styles.td, { width: LOGS_HEADERS[6].width }]}>
                                <Text style={styles.tdWork} numberOfLines={1}>
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
              })}
          </View>
        )}

        {tab === 'invitations' && (
          <View style={[styles.card, styles.tableCard]}>
            <View style={styles.invitationsHeader}>
              <Text style={styles.cardTitle}>Pending invitations</Text>
              <Pressable style={styles.outlineButton} onPress={loadInvitations}>
                <Text style={styles.outlineButtonText}>Refresh</Text>
              </Pressable>
            </View>
            {invLoading ? (
              <Text style={styles.emptyTableText}>Loading...</Text>
            ) : invitations.length === 0 ? (
              <Text style={styles.emptyTableText}>No invitations yet</Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator>
                <View>
                  <View style={styles.tableHeaderRow}>
                    {INVITATIONS_HEADERS.map((h) => (
                      <View key={h.key} style={[styles.th, { width: h.width }]}>
                        <Text style={styles.thText}>{h.label}</Text>
                      </View>
                    ))}
                  </View>
                  {invitations.map((inv, i) => (
                    <View
                      key={inv.id}
                      style={[styles.tableRow, { backgroundColor: i % 2 === 0 ? COLORS.background : '#fafaf8' }]}
                    >
                      <View style={[styles.td, { width: INVITATIONS_HEADERS[0].width }]}>
                        <Text style={inv.email ? styles.tdText : styles.tdMuted} numberOfLines={1}>
                          {inv.email || '—'}
                        </Text>
                      </View>
                      <View style={[styles.td, { width: INVITATIONS_HEADERS[1].width }]}>
                        <Text style={inv.work_number ? styles.tdBold : styles.tdMuted}>
                          {inv.work_number || '—'}
                        </Text>
                      </View>
                      <View style={[styles.td, { width: INVITATIONS_HEADERS[2].width }]}>
                        <RoleBadge role={inv.role} />
                      </View>
                      <View style={[styles.td, { width: INVITATIONS_HEADERS[3].width }]}>
                        <Text style={styles.tdText} numberOfLines={1}>
                          {inv.invited_by_name || '—'}
                        </Text>
                      </View>
                      <View style={[styles.td, { width: INVITATIONS_HEADERS[4].width }]}>
                        <Text style={styles.tdMutedSmall}>
                          {inv.created_at ? formatDateShort(inv.created_at) : '—'}
                        </Text>
                      </View>
                      <View style={[styles.td, { width: INVITATIONS_HEADERS[5].width }]}>
                        <View
                          style={[styles.statusBadge, inv.accepted ? styles.statusActive : styles.statusPending]}
                        >
                          <Text style={[styles.statusText, { color: inv.accepted ? COLORS.primary : '#b45309' }]}>
                            {inv.accepted ? 'Accepted' : 'Pending'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              </ScrollView>
            )}
          </View>
        )}
      </ScrollView>

      {/* INVITE MODAL */}
      <Modal visible={showInvite} transparent animationType="fade" onRequestClose={resetInviteModal}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalCard}>
            <ScrollView keyboardShouldPersistTaps="handled">
              {!inviteUrl ? (
                <>
                  <Text style={styles.modalTitle}>Invite someone</Text>

                  <View style={styles.field}>
                    <Text style={styles.label}>
                      Email address <Text style={styles.optionalText}>(optional)</Text>
                    </Text>
                    <TextInput
                      style={styles.input}
                      placeholder="worker@example.com"
                      placeholderTextColor={COLORS.textMuted}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      value={inviteForm.email}
                      onChangeText={(t) => setInviteForm((f) => ({ ...f, email: t }))}
                    />
                  </View>

                  <View style={styles.field}>
                    <Text style={styles.label}>
                      Work number <Text style={styles.optionalText}>(optional)</Text>
                    </Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. 334"
                      placeholderTextColor={COLORS.textMuted}
                      keyboardType="number-pad"
                      value={inviteForm.work_number}
                      onChangeText={(t) => setInviteForm((f) => ({ ...f, work_number: t }))}
                    />
                  </View>

                  <View style={styles.field}>
                    <Text style={styles.label}>Role</Text>
                    <View style={styles.chipChoiceRow}>
                      {ROLE_OPTIONS.map((r) => (
                        <Pressable
                          key={r}
                          style={[styles.chipChoice, inviteForm.role === r && styles.chipChoiceActive]}
                          onPress={() => setInviteForm((f) => ({ ...f, role: r, house_group: '' }))}
                        >
                          <Text style={[styles.chipChoiceText, inviteForm.role === r && styles.chipChoiceTextActive]}>
                            {r}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  {inviteForm.role === 'housemaster' && (
                    <View style={styles.field}>
                      <Text style={styles.label}>House group</Text>
                      <View style={styles.chipChoiceRow}>
                        {HOUSE_GROUPS.map((g) => (
                          <Pressable
                            key={g}
                            style={[styles.chipChoice, inviteForm.house_group === g && styles.chipChoiceActive]}
                            onPress={() => setInviteForm((f) => ({ ...f, house_group: g }))}
                          >
                            <Text
                              style={[styles.chipChoiceText, inviteForm.house_group === g && styles.chipChoiceTextActive]}
                              numberOfLines={1}
                            >
                              {g}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  )}

                  {!!inviteError && <Text style={styles.formError}>{inviteError}</Text>}

                  <View style={styles.modalButtons}>
                    <Pressable style={styles.cancelButton} onPress={resetInviteModal}>
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.primaryButton, styles.modalPrimaryButton]}
                      onPress={sendInvite}
                      disabled={inviteSaving}
                    >
                      <Text style={styles.primaryButtonText}>{inviteSaving ? 'Sending...' : 'Create invitation'}</Text>
                    </Pressable>
                  </View>
                </>
              ) : (
                <>
                  <Text style={styles.modalTitle}>Invitation created</Text>
                  <Text style={styles.modalSubtitle}>Share this registration link with the person you are inviting:</Text>
                  <View style={styles.linkBox}>
                    <Text style={styles.linkText}>{inviteUrl}</Text>
                  </View>
                  <View style={styles.modalButtons}>
                    <Pressable
                      style={[styles.outlineButton, { flex: 1, alignItems: 'center' }]}
                      onPress={() => Share.share({ message: inviteUrl })}
                    >
                      <Text style={styles.outlineButtonText}>Share link</Text>
                    </Pressable>
                  </View>
                  <Pressable style={styles.primaryButton} onPress={resetInviteModal}>
                    <Text style={styles.primaryButtonText}>Done</Text>
                  </Pressable>
                </>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* CHANGE ROLE MODAL */}
      <Modal
        visible={!!roleModalWorker}
        transparent
        animationType="fade"
        onRequestClose={() => setRoleModalWorker(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, styles.smallModalCard]}>
            <Text style={styles.modalTitle}>Change role</Text>
            <Text style={styles.modalSubtitle}>
              #{roleModalWorker?.work_number} {roleModalWorker?.full_name}
            </Text>
            <View style={styles.roleOptionsList}>
              {ROLE_OPTIONS.map((r) => (
                <Pressable
                  key={r}
                  style={[styles.roleOption, roleModalWorker?.role === r && styles.roleOptionActive]}
                  onPress={async () => {
                    const id = roleModalWorker.id;
                    setRoleModalWorker(null);
                    await updateWorker(id, { role: r });
                  }}
                >
                  <RoleBadge role={r} />
                  {roleModalWorker?.role === r && <Text style={styles.roleOptionCheck}>✓</Text>}
                </Pressable>
              ))}
            </View>
            <Pressable style={styles.cancelButton} onPress={() => setRoleModalWorker(null)}>
              <Text style={styles.cancelButtonText}>Close</Text>
            </Pressable>
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  headerText: {
    flexShrink: 1,
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
    color: '#888888',
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
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 16,
    flexWrap: 'wrap',
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
  card: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: '#e8e8e3',
    borderRadius: 14,
    padding: 16,
  },
  tableCard: {
    padding: 0,
    marginBottom: 12,
    overflow: 'hidden',
  },
  searchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0ec',
  },
  searchInput: {
    flex: 1,
    minWidth: 160,
  },
  shownText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#888888',
  },
  emptyTableText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: '#888888',
    textAlign: 'center',
    padding: 24,
  },
  loadingText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: '#888888',
    marginBottom: 12,
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
  tdMutedSmall: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#666666',
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
  tdTotal: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: COLORS.primary,
  },
  tdWork: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: '#555555',
  },
  statusBadge: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 2,
    paddingHorizontal: 8,
    alignSelf: 'flex-start',
  },
  statusActive: {
    backgroundColor: '#e8f5e9',
    borderColor: '#a5d6a7',
  },
  statusInactive: {
    backgroundColor: '#fdecea',
    borderColor: '#ffc1c0',
  },
  statusPending: {
    backgroundColor: '#fff3e0',
    borderColor: '#ffcc80',
  },
  statusText: {
    fontFamily: FONTS.bold,
    fontSize: 11,
  },
  toggleActiveButton: {
    borderWidth: 1,
    borderColor: '#dddddd',
    borderRadius: 6,
    paddingVertical: 5,
    paddingHorizontal: 10,
    alignSelf: 'flex-start',
  },
  toggleActiveText: {
    fontFamily: FONTS.bold,
    fontSize: 11,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  dateNavButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dddddd',
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateNavText: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: COLORS.text,
  },
  dateDisplay: {
    flex: 1,
    minWidth: 120,
  },
  dateValue: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: COLORS.text,
  },
  outlineButton: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: '#dddddd',
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  outlineButtonText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: '#333333',
  },
  groupCard: {
    marginBottom: 12,
    padding: 0,
    overflow: 'hidden',
  },
  groupHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0ec',
  },
  groupHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  groupCount: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: '#888888',
  },
  emptyGroupText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: '#bbbbbb',
    textAlign: 'center',
    padding: 20,
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
    fontSize: 12,
    color: COLORS.primary,
  },
  invitationsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0ec',
  },
  cardTitle: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: COLORS.text,
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
  field: {
    marginBottom: 14,
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
  formError: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.error,
    marginBottom: 12,
  },
  chipChoiceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chipChoice: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#dddddd',
    backgroundColor: COLORS.background,
  },
  chipChoiceActive: {
    borderColor: COLORS.primary,
    backgroundColor: '#f0fff0',
  },
  chipChoiceText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: '#555555',
  },
  chipChoiceTextActive: {
    color: COLORS.primary,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    marginBottom: 12,
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
  linkBox: {
    backgroundColor: '#f5f5f0',
    borderWidth: 1,
    borderColor: '#e0e0db',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  linkText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#333333',
  },
  roleOptionsList: {
    gap: 8,
    marginBottom: 16,
  },
  roleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#dddddd',
    borderRadius: 8,
    backgroundColor: COLORS.background,
  },
  roleOptionActive: {
    borderColor: COLORS.primary,
    backgroundColor: '#f0fff0',
  },
  roleOptionCheck: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: COLORS.primary,
  },
});
