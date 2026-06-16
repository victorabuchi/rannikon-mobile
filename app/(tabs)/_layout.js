import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import LanguageSelector from '../../components/LanguageSelector';
import { useAuth } from '../../lib/auth';
import { useLanguage } from '../../lib/i18n';
import { COLORS, FONTS } from '../../lib/theme';

const TAB_ACTIVE_COLOR = '#2d6a2d';
const TAB_INACTIVE_COLOR = '#999';

function tabIcon(name) {
  return ({ color, size }) => <Ionicons name={name} size={size} color={color} />;
}

export default function TabsLayout() {
  const { worker } = useAuth();
  const { t } = useLanguage();
  const role = worker?.role;

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.background },
        headerTitleStyle: { fontFamily: FONTS.bold, color: COLORS.text },
        headerShadowVisible: false,
        headerRight: () => <LanguageSelector />,
        tabBarStyle: {
          backgroundColor: COLORS.background,
          borderTopColor: COLORS.border,
        },
        tabBarActiveTintColor: TAB_ACTIVE_COLOR,
        tabBarInactiveTintColor: TAB_INACTIVE_COLOR,
        tabBarLabelStyle: { fontFamily: FONTS.medium, fontSize: 12 },
      }}
    >
      <Tabs.Screen
        name="days"
        options={{ title: t('tabs.days'), tabBarIcon: tabIcon('calendar-outline') }}
      />
      <Tabs.Screen
        name="papers"
        options={{ title: t('tabs.papers'), tabBarIcon: tabIcon('document-text-outline') }}
      />
      <Tabs.Screen
        name="supervisor"
        options={{
          title: t('tabs.supervisor'),
          tabBarIcon: tabIcon('people-outline'),
          href: role === 'supervisor' || role === 'admin' ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: t('tabs.admin'),
          tabBarIcon: tabIcon('settings-outline'),
          href: role === 'admin' ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="housemaster"
        options={{
          title: t('tabs.housemaster'),
          tabBarIcon: tabIcon('home-outline'),
          href: role === 'housemaster' || role === 'admin' ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: t('tabs.profile'), tabBarIcon: tabIcon('person-outline') }}
      />
    </Tabs>
  );
}
