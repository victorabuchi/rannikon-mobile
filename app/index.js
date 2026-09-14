import { Redirect } from 'expo-router';

import { roleHomePath, useAuth } from '../lib/auth';
import { useOnboarding } from '../lib/onboarding';

// _layout.js only registers named routes (onboarding/login/days/...), never
// one at "/" itself, so a cold launch (tapping the app icon) always hits an
// unmatched "/" first. This mirrors _layout.js's own Stack.Protected guard
// order to send that initial hit to whichever screen is actually mounted.
export default function Index() {
  const { token, worker, needsWorkNumber } = useAuth();
  const { onboardingDone } = useOnboarding();

  if (!onboardingDone) return <Redirect href="/onboarding" />;
  if (!token) return <Redirect href="/login" />;
  if (needsWorkNumber) return <Redirect href="/complete-profile" />;
  return <Redirect href={roleHomePath(worker?.role)} />;
}
