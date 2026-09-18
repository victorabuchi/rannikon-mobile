import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import api from '../lib/api';
import { MONTH_NAMES } from '../lib/dates';
import { useLanguage } from '../lib/i18n';
import { COLORS, FONTS } from '../lib/theme';

export const NEWS_CATEGORIES = [
  { key: 'announcement', labelKey: 'news.announcements', icon: 'megaphone-outline' },
  { key: 'promotion', labelKey: 'news.promotions', icon: 'pricetag-outline' },
  { key: 'event', labelKey: 'news.events', icon: 'calendar-outline' },
];

function formatEventDate(value) {
  const [, m, d] = String(value).slice(0, 10).split('-').map(Number);
  if (!m || !d) return '';
  return `${d} ${MONTH_NAMES[m - 1].slice(0, 3)}`;
}

export function useNews() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    try {
      const { data } = await api.get('/api/news');
      setItems(data.items || []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { items, loading, error, reload: load };
}

export function CategoryChips({ active, onChange, counts }) {
  const { t } = useLanguage();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
      {NEWS_CATEGORIES.map((c) => {
        const selected = active === c.key;
        return (
          <Pressable
            key={c.key}
            onPress={() => onChange(c.key)}
            style={[styles.chip, selected && styles.chipActive]}
          >
            <Ionicons name={c.icon} size={15} color={selected ? COLORS.white : COLORS.primary} />
            <Text style={[styles.chipText, selected && styles.chipTextActive]}>{t(c.labelKey)}</Text>
            {counts?.[c.key] != null && (
              <Text style={[styles.chipCount, selected && styles.chipTextActive]}>{counts[c.key]}</Text>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function NewsCard({ item }) {
  const { t } = useLanguage();
  const meta = NEWS_CATEGORIES.find((c) => c.key === item.category);
  return (
    <View style={styles.card}>
      <View style={styles.cardIcon}>
        <Ionicons name={meta?.icon || 'megaphone-outline'} size={18} color={COLORS.primary} />
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {item.title}
          </Text>
          {item.is_sample && (
            <View style={styles.sampleTag}>
              <Text style={styles.sampleTagText}>{t('news.sample')}</Text>
            </View>
          )}
        </View>
        {!!item.event_date && <Text style={styles.cardDate}>{formatEventDate(item.event_date)}</Text>}
        <Text style={styles.cardText}>{item.body}</Text>
      </View>
    </View>
  );
}

const PREVIEW_COUNT = 3;

export default function NewsFeed() {
  const router = useRouter();
  const { t } = useLanguage();
  const { items, loading, error } = useNews();
  const [category, setCategory] = useState('announcement');

  const inCategory = items.filter((i) => i.category === category);
  const counts = {
    announcement: items.filter((i) => i.category === 'announcement').length,
    promotion: items.filter((i) => i.category === 'promotion').length,
    event: items.filter((i) => i.category === 'event').length,
  };

  return (
    <View style={styles.section}>
      <CategoryChips active={category} onChange={setCategory} counts={counts} />
      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={styles.state} />
      ) : error ? (
        <Text style={styles.stateText}>{t('news.loadError')}</Text>
      ) : inCategory.length === 0 ? (
        <Text style={styles.stateText}>{t('news.empty')}</Text>
      ) : (
        <View style={styles.list}>
          {inCategory.slice(0, PREVIEW_COUNT).map((item) => (
            <NewsCard key={item.id} item={item} />
          ))}
          <Pressable
            style={styles.viewAll}
            onPress={() => router.push({ pathname: '/news', params: { category } })}
          >
            <Text style={styles.viewAllText}>
              {t('news.viewAll')} ({inCategory.length})
            </Text>
            <Ionicons name="chevron-forward" size={16} color={COLORS.primary} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingTop: 12,
    paddingBottom: 4,
  },
  chipRow: {
    gap: 8,
    paddingHorizontal: 16,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  chipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.primary,
  },
  chipTextActive: {
    color: COLORS.white,
  },
  chipCount: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: COLORS.textMuted,
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 8,
  },
  state: {
    marginVertical: 20,
  },
  stateText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginVertical: 20,
  },
  card: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
  },
  cardIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    flex: 1,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  cardTitle: {
    flex: 1,
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: COLORS.text,
  },
  cardDate: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.primary,
    marginTop: 2,
  },
  cardText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textMuted,
    lineHeight: 18,
    marginTop: 4,
  },
  sampleTag: {
    borderRadius: 4,
    backgroundColor: '#fff4e0',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  sampleTagText: {
    fontFamily: FONTS.medium,
    fontSize: 10,
    color: '#b45309',
  },
  viewAll: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  viewAllText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.primary,
  },
});
