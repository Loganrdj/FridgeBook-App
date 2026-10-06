import React from 'react';
import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '../../lib/auth';
import { colors } from '../../lib/theme';

const icon = (name) => ({ color, size }) => <Ionicons name={name} color={color} size={size} />;

export default function TabsLayout() {
  const { user } = useAuth();
  const celiac = !!(user && user.celiac_mode);
  return (
    <Tabs screenOptions={{
      headerStyle: { backgroundColor: colors.cream },
      headerShadowVisible: false,
      headerTitleStyle: { color: colors.ink, fontWeight: '700' },
      tabBarActiveTintColor: colors.mintDark,
      tabBarInactiveTintColor: colors.inkSoft,
      sceneStyle: { backgroundColor: colors.cream }
    }}>
      <Tabs.Screen name="index" options={{ title: 'Kitchen', tabBarIcon: icon('file-tray-stacked-outline') }} />
      {/* Gluten check appears with Celiac Mode, as on the website */}
      <Tabs.Protected guard={celiac}>
        <Tabs.Screen name="gluten" options={{ title: 'Gluten check', tabBarIcon: icon('restaurant-outline') }} />
      </Tabs.Protected>
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: icon('settings-outline') }} />
    </Tabs>
  );
}
