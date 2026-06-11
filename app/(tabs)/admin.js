import { StyleSheet, Text, View } from 'react-native';

import { COLORS, FONTS } from '../../lib/theme';

export default function AdminScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Admin</Text>
      <Text style={styles.text}>Admin tools are coming soon.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 24,
    color: COLORS.primary,
    marginBottom: 8,
  },
  text: {
    fontFamily: FONTS.regular,
    fontSize: 16,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
});
