import React, { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../lib/auth';
import { Button, ErrorText } from '../components/ui';
import { colors } from '../lib/theme';

export default function SignIn() {
  const { signIn } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSignIn() {
    setBusy(true);
    setError('');
    try {
      const result = await signIn();
      if (result.error) setError(result.error);
    } catch (err) {
      setError(err.message || 'Sign-in didn’t work. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.hero}>
        <Image source={require('../../assets/icon.png')} style={styles.logo} accessibilityIgnoresInvertColors />
        <Text style={styles.title} accessibilityRole="header">Fridge<Text style={styles.titleAccent}>Book</Text></Text>
        <Text style={styles.tagline}>Know what’s in your kitchen, use it before it expires, and eat out gluten-aware.</Text>
      </View>
      <View style={styles.actions}>
        <Button title="Sign in with Google" onPress={handleSignIn} busy={busy} />
        <ErrorText>{error}</ErrorText>
        <Text style={styles.fine}>Use the same Google account as fridge-book.com to see the same kitchen.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.cream, padding: 24, justifyContent: 'space-between' },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  logo: { width: 120, height: 120, borderRadius: 28 },
  title: { fontSize: 40, fontWeight: '700', color: colors.ink },
  titleAccent: { color: colors.mintDark },
  tagline: { fontSize: 17, lineHeight: 24, color: colors.inkSoft, textAlign: 'center', maxWidth: 320 },
  actions: { gap: 12, paddingBottom: 8 },
  fine: { fontSize: 13, color: colors.inkSoft, textAlign: 'center' }
});
