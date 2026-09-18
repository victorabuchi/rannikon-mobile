import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CategoryChips, NEWS_CATEGORIES, NewsCard, useNews } from '../components/NewsFeed';
import PageHeader from '../components/PageHeader';
import { useLanguage } from '../lib/i18n';
import { COLORS, FONTS } from '../lib/theme';

export default function NewsScreen() {
  const { t } = useLanguage();
  const params = useLocalSearchParams();
  const initial = NEWS_CATEGORIES.some((c) => c.key === params.category) ? params.category : 'announcement';
  const [category, setCategory] = useState(initial);
  const { items, loading, error, reload } = useNews();

  const inCategory = items.filter((i) => i.category === category);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <PageHeader title={t('news.title')} showMyTimesheet />
      <View style={styles.chips}>
        <CategoryChips active={category} onChange={setCategory} />
      </View>
      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={styles.state} />
      ) : (
        <FlatList
          data={inCategory}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={false} onRefresh={reload} tintColor={COLORS.primary} />}
          renderItem={({ item }) => <NewsCard item={item} />}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <Text style={styles.stateText}>{error ? t('news.loadError') : t('news.empty')}</Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  chips: { paddingTop: 12, paddingBottom: 4 },
  listContent: { padding: 16 },
  separator: { height: 8 },
  state: { marginTop: 32 },
  stateText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 32,
  },
});
