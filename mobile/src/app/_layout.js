import React from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../lib/auth';
import { colors } from '../lib/theme';

function Splash() {
  return (
    <View style={styles.splash} accessibilityLabel="Loading">
      <Image source={require('../../assets/icon.png')} style={styles.logo} />
      <ActivityIndicator color={colors.mintDark} />
      <Text style={styles.note}>The free server can take up to a minute to wake up.</Text>
    </View>
  );
}

// Signed-in people see the tabs; everyone else sees the sign-in screen
function RootNavigator() {
  const { user, loading } = useAuth();
  if (loading) return <Splash />;
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.cream } }}>
      <Stack.Protected guard={!!user}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
      <Stack.Protected guard={!user}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
      <Stack.Screen name="auth" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cream, padding: 32, gap: 16 },
  logo: { width: 96, height: 96, borderRadius: 22 },
  note: { color: colors.inkSoft, textAlign: 'center', fontSize: 14 }
});
