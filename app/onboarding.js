import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import LanguageSelector from '../components/LanguageSelector';
import { useOnboarding } from '../lib/onboarding';
import { COLORS, FONTS } from '../lib/theme';

const { width } = Dimensions.get('window');

const SLIDES = [
  {
    id: 'welcome',
    title: 'Welcome to Rannikon',
    subtitle: 'The official timesheet app for Rannikon Puutarha farm workers',
  },
  {
    id: 'hours',
    title: 'Track your hours',
    subtitle: 'Enter your start and finish time — white paper, orange paper and weekly summary fill automatically',
  },
  {
    id: 'papers',
    title: 'All four papers',
    subtitle: 'White paper, orange paper, weekly summary and green paper — download as PDF or Excel',
  },
  {
    id: 'language',
    title: 'Available in 5 languages',
    subtitle: 'English, Ukrainian, Khmer, Vietnamese and Nepali',
  },
  {
    id: 'start',
    title: 'Ready to start?',
    subtitle: null,
  },
];

function LogoBadge() {
  return (
    <View style={styles.logoArea}>
      <View style={styles.logoBadge}>
        <Text style={styles.logoBadgeText}>R</Text>
      </View>
      <Text style={styles.logoWordmark}>Rannikon</Text>
      <Text style={styles.logoPuutarha}>Puutarha</Text>
    </View>
  );
}

function IconSlide({ emoji }) {
  return (
    <View style={styles.illustrationArea}>
      <View style={styles.iconCircle}>
        <Text style={styles.iconEmoji}>{emoji}</Text>
      </View>
    </View>
  );
}

function FlagsSlide() {
  return (
    <View style={styles.flagsArea}>
      {['🇬🇧', '🇺🇦', '🇰🇭', '🇻🇳', '🇳🇵'].map((flag, i) => (
        <Text key={i} style={styles.flagEmoji}>{flag}</Text>
      ))}
    </View>
  );
}

function SlideIllustration({ id }) {
  if (id === 'welcome' || id === 'start') return <LogoBadge />;
  if (id === 'hours') return <IconSlide emoji="⏱" />;
  if (id === 'papers') return <IconSlide emoji="📋" />;
  if (id === 'language') return <FlagsSlide />;
  return null;
}

export default function OnboardingScreen() {
  const { markDone } = useOnboarding();
  const router = useRouter();
  const flatListRef = useRef(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const isLast = currentIndex === SLIDES.length - 1;

  const handleScrollEnd = (e) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / width);
    setCurrentIndex(index);
  };

  const handleNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    }
  };

  const handleSkip = async () => {
    await markDone();
  };

  const handleSignIn = async () => {
    await markDone();
  };

  const handleCreateAccount = async () => {
    await markDone();
    router.replace('/register');
  };

  const renderSlide = ({ item }) => (
    <View style={styles.slide}>
      <SlideIllustration id={item.id} />
      <Text style={styles.slideTitle}>{item.title}</Text>
      {item.subtitle ? (
        <Text style={styles.slideSubtitle}>{item.subtitle}</Text>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      {!isLast && (
        <Pressable style={styles.skipButton} onPress={handleSkip} hitSlop={12}>
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      )}

      <FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderSlide}
        keyExtractor={item => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onMomentumScrollEnd={handleScrollEnd}
        getItemLayout={(_data, index) => ({
          length: width,
          offset: width * index,
          index,
        })}
        style={styles.flatList}
      />

      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[styles.dot, i === currentIndex && styles.dotActive]} />
          ))}
        </View>

        {isLast ? (
          <View style={styles.lastActions}>
            <View style={styles.langRow}>
              <LanguageSelector />
            </View>
            <Pressable
              style={({ pressed }) => [styles.signInButton, pressed && styles.buttonPressed]}
              onPress={handleSignIn}
            >
              <Text style={styles.signInButtonText}>Sign in</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.createAccountButton, pressed && styles.createAccountButtonPressed]}
              onPress={handleCreateAccount}
            >
              <Text style={styles.createAccountButtonText}>Create account</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            style={({ pressed }) => [styles.nextButton, pressed && styles.buttonPressed]}
            onPress={handleNext}
          >
            <Text style={styles.nextButtonText}>Next</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  skipButton: {
    position: 'absolute',
    top: 56,
    right: 20,
    zIndex: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  skipText: {
    fontFamily: FONTS.medium,
    fontSize: 15,
    color: COLORS.textMuted,
  },
  flatList: {
    flex: 1,
  },
  slide: {
    width,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 40,
    paddingBottom: 24,
  },

  // Logo illustration (slides 1 & 5)
  logoArea: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoBadge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  logoBadgeText: {
    fontFamily: FONTS.bold,
    fontSize: 44,
    color: COLORS.white,
    lineHeight: 52,
  },
  logoWordmark: {
    fontFamily: FONTS.bold,
    fontSize: 28,
    color: COLORS.primary,
    letterSpacing: 0.5,
  },
  logoPuutarha: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: COLORS.textMuted,
    marginTop: 2,
    letterSpacing: 1,
  },

  // Icon illustration (slides 2 & 3)
  illustrationArea: {
    alignItems: 'center',
    marginBottom: 40,
  },
  iconCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#e8f4e8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconEmoji: {
    fontSize: 64,
    lineHeight: 80,
  },

  // Flags illustration (slide 4)
  flagsArea: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 40,
    paddingHorizontal: 16,
  },
  flagEmoji: {
    fontSize: 48,
    lineHeight: 60,
  },

  // Slide text
  slideTitle: {
    fontFamily: FONTS.bold,
    fontSize: 26,
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 14,
    lineHeight: 34,
  },
  slideSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 16,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 320,
  },

  // Footer
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    paddingTop: 12,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.border,
  },
  dotActive: {
    width: 24,
    backgroundColor: COLORS.primary,
  },
  nextButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonPressed: {
    opacity: 0.85,
  },
  nextButtonText: {
    fontFamily: FONTS.bold,
    fontSize: 17,
    color: COLORS.white,
  },

  // Last slide actions
  lastActions: {
    gap: 12,
  },
  langRow: {
    alignItems: 'center',
    marginBottom: 4,
  },
  signInButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  signInButtonText: {
    fontFamily: FONTS.bold,
    fontSize: 17,
    color: COLORS.white,
  },
  createAccountButton: {
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  createAccountButtonPressed: {
    backgroundColor: '#e8f4e8',
  },
  createAccountButtonText: {
    fontFamily: FONTS.bold,
    fontSize: 17,
    color: COLORS.primary,
  },
});
