import React, { useState } from 'react';
import { Linking, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { API_URL, request } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { colors } from '../../lib/theme';
import { Button, Card, CardTitle, ErrorText, Muted } from '../../components/ui';

function Toggle({ label, description, value, disabled, onChange }) {
  return (
    <View style={styles.toggle}>
      <View style={styles.flex}>
        <Text style={styles.toggleLabel}>{label}</Text>
        <Muted style={styles.small}>{description}</Muted>
      </View>
      <Switch accessibilityLabel={label} value={value} disabled={disabled} onValueChange={onChange}
        trackColor={{ true: colors.mint, false: colors.steel }} thumbColor={colors.white} />
    </View>
  );
}

export default function Settings() {
  const { user, updateUser, signOut } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save(fields) {
    setSaving(true);
    setError('');
    try {
      const { data } = await request('/api/me/settings', { method: 'PATCH', body: fields });
      updateUser(data);
    } catch (err) {
      setError('Couldn’t save that setting. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Card>
        <CardTitle icon="🌾" title="Diet" />
        <Toggle label="Celiac Mode" value={!!user.celiac_mode} disabled={saving} onChange={(value) => save({ celiac_mode: value })}
          description="Flags gluten in your kitchen and adds the Gluten check tab for restaurants, menus and asking your server." />
        {user.celiac_mode ? (
          <Toggle label="Strict" value={!!user.celiac_strict} disabled={saving} onChange={(value) => save({ celiac_strict: value })}
            description='Treat "may contain gluten" and "ask first" as unsafe instead of a warning.' />
        ) : null}
        <ErrorText>{error}</ErrorText>
        <Muted style={styles.note}>Gluten labels are guidance, not medical advice. Always check the package and talk to your doctor or dietitian about what’s safe for you.</Muted>
      </Card>
      <Card>
        <CardTitle icon="👤" title="Account" />
        <Muted style={styles.note}>Signed in as {user.user_name || 'you'}. Your kitchen is the same as on fridge-book.com.</Muted>
        <View style={styles.buttons}>
          <Button variant="ghost" title="Open fridge-book.com" onPress={() => Linking.openURL(API_URL)} />
          <Button variant="danger" title="Sign out" onPress={signOut} />
        </View>
      </Card>
      <Muted style={styles.version}>FridgeBook {Constants.expoConfig ? Constants.expoConfig.version : ''}</Muted>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, paddingBottom: 48 },
  flex: { flex: 1 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  toggleLabel: { fontSize: 16, fontWeight: '700', color: colors.ink, marginBottom: 2 },
  small: { fontSize: 14 },
  note: { fontSize: 14, marginTop: 8 },
  buttons: { gap: 10, marginTop: 14 },
  version: { textAlign: 'center', fontSize: 13 }
});
