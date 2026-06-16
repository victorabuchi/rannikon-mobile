import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

const ONBOARDING_KEY = 'onboarding_done';
const OnboardingContext = createContext(null);

export function OnboardingProvider({ children }) {
  const [onboardingDone, setOnboardingDone] = useState(null);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY).then(val => {
      setOnboardingDone(val === 'true');
    });
  }, []);

  const markDone = useCallback(async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    setOnboardingDone(true);
  }, []);

  return (
    <OnboardingContext.Provider value={{ onboardingDone, markDone }}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  return useContext(OnboardingContext);
}
