import { Tabs } from 'expo-router';

import { useAuth } from '../../lib/auth';
import { COLORS, FONTS } from '../../lib/theme';

export default function TabsLayout() {
  const { worker } = useAuth();
  const role = worker?.role;

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.background },
        headerTitleStyle: { fontFamily: FONTS.bold, color: COLORS.text },
        headerShadowVisible: false,
        tabBarStyle: {
          backgroundColor: COLORS.background,
          borderTopColor: COLORS.border,
        },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarLabelStyle: { fontFamily: FONTS.medium, fontSize: 12 },
      }}
    >
      <Tabs.Screen name="days" options={{ title: 'Days' }} />
      <Tabs.Screen name="papers" options={{ title: 'Papers' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
      <Tabs.Screen
        name="supervisor"
        options={{
          title: 'Supervisor',
          href: role === 'supervisor' ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: 'Admin',
          href: role === 'admin' ? undefined : null,
        }}
      />
    </Tabs>
  );
}
