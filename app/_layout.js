import { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';

import { AuthProvider, useAuth } from '../lib/auth';
import { LanguageProvider } from '../lib/i18n';
import { OnboardingProvider, useOnboarding } from '../lib/onboarding';
import { COLORS } from '../lib/theme';

SplashScreen.preventAutoHideAsync();

function RootNavigator({ fontsReady }) {
  const { token, isLoading } = useAuth();
  const { onboardingDone } = useOnboarding();

  const ready = fontsReady && !isLoading && onboardingDone !== null;

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync();
    }
  }, [ready]);

  if (!ready) {
    return null;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: COLORS.background },
      }}
    >
      <Stack.Protected guard={!onboardingDone}>
        <Stack.Screen name="onboarding" options={{ gestureEnabled: false, animation: 'none' }} />
      </Stack.Protected>
      <Stack.Protected guard={onboardingDone && !!token}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
      <Stack.Protected guard={onboardingDone && !token}>
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
  });

  return (
    <LanguageProvider>
      <OnboardingProvider>
        <AuthProvider>
          <RootNavigator fontsReady={fontsLoaded || !!fontError} />
        </AuthProvider>
      </OnboardingProvider>
    </LanguageProvider>
  );
}
