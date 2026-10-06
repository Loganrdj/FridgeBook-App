// Kitchen: what's in the fridge and pantry, soonest-expiring first
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { request } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { addDays, expiryStatus, formatShortDate, todayString } from '../../lib/dates';
import { ingredientLook, isGlutenRisk } from '../../lib/gluten';
import { colors } from '../../lib/theme';
import { Badge, Button, Card, CardTitle, Chip, ErrorText, Field, Muted, Segmented } from '../../components/ui';

const EXPIRY_CHIPS = [
  { label: '3 days', days: 3 },
  { label: '1 week', days: 7 },
  { label: '2 weeks', days: 14 },
  { label: '1 month', days: 30 },
  { label: '6 months', days: 182 }
];

const byExpiry = (a, b) => String(a.date_expire).localeCompare(String(b.date_expire)) || a.id - b.id;

function AddItem({ onAdded }) {
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [days, setDays] = useState(7);
  const [fridge, setFridge] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function add() {
    const qty = Number(quantity);
    if (!name.trim()) return setError('Enter what you’re adding.');
    if (!Number.isInteger(qty) || qty < 1) return setError('Quantity must be a whole number.');
    setBusy(true);
    setError('');
    try {
      const { data } = await request('/api/ingredient', {
        method: 'POST',
        body: { name: name.trim(), quantity: qty, date_start: todayString(), date_expire: addDays(days), fridge_bool: fridge }
      });
      onAdded(data);
      setName('');
      setQuantity('1');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardTitle icon="➕" title="Add to your kitchen" />
      <Field label="Item" value={name} onChangeText={setName} placeholder="e.g. Greek yogurt" maxLength={100} returnKeyType="done" />
      <View style={styles.row}>
        <Field label="Quantity" value={quantity} onChangeText={setQuantity} keyboardType="number-pad" maxLength={4} style={styles.qty} />
        <View style={styles.flex}>
          <Text style={styles.label}>Where</Text>
          <Segmented label="Where it goes" value={fridge} onChange={setFridge}
            options={[{ label: 'Fridge', value: true }, { label: 'Pantry', value: false }]} />
        </View>
      </View>
      <Text style={styles.label}>Expires in</Text>
      <View style={styles.chips}>
        {EXPIRY_CHIPS.map((chip) => <Chip key={chip.days} label={chip.label} selected={days === chip.days} onPress={() => setDays(chip.days)} />)}
      </View>
      <Button title="Add item" onPress={add} busy={busy} />
      <ErrorText>{error}</ErrorText>
    </Card>
  );
}

function ItemRow({ item, celiac, strict, onQuantity, onRemove }) {
  const expiry = expiryStatus(item.date_expire);
  const gluten = celiac && item.gluten_status !== 'gluten_free' ? ingredientLook(item.gluten_status, strict) : null;
  const risky = celiac && isGlutenRisk(item.gluten_status, strict);
  return (
    <View style={[styles.item, risky && styles.itemRisky]} accessible={false}>
      <View style={styles.itemTop}>
        <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
        <Badge tone={expiry.tone} label={expiry.label} />
      </View>
      {gluten && <View style={styles.itemGluten}><Badge tone={gluten.tone} label={`🌾 ${gluten.label}`} /></View>}
      <View style={styles.itemBottom}>
        <Muted style={styles.itemMeta}>{item.fridge_bool ? 'Fridge' : 'Pantry'} · {formatShortDate(item.date_expire)}</Muted>
        <View style={styles.stepper}>
          <Pressable accessibilityRole="button" accessibilityLabel={`One less ${item.name}`} onPress={() => onQuantity(item, item.quantity - 1)} style={styles.stepBtn}>
            <Text style={styles.stepText}>−</Text>
          </Pressable>
          <Text style={styles.qtyText} accessibilityLabel={`Quantity ${item.quantity}`}>{item.quantity}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={`One more ${item.name}`} onPress={() => onQuantity(item, item.quantity + 1)} style={styles.stepBtn}>
            <Text style={styles.stepText}>+</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${item.name}`} onPress={() => onRemove(item)} style={styles.removeBtn}>
            <Text style={styles.removeText}>Remove</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export default function Kitchen() {
  const { user } = useAuth();
  const celiac = !!(user && user.celiac_mode);
  const strict = !!(user && user.celiac_strict);
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const { data } = await request('/api/ingredient');
      setItems((data || []).slice().sort(byExpiry));
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // In Celiac Mode, label anything that hasn't been checked for gluten yet
  const unchecked = items.filter((item) => !item.gluten_status).length;
  useEffect(() => {
    if (!celiac || !unchecked) return;
    request('/api/gluten/classify-kitchen', { method: 'POST', body: { local_date: todayString() } })
      .then(({ data }) => {
        const updates = new Map((data || []).map((u) => [u.id, u]));
        if (updates.size) setItems((current) => current.map((item) => (updates.has(item.id) ? { ...item, ...updates.get(item.id) } : item)));
      })
      .catch(() => {});
  }, [celiac, unchecked]);

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function changeQuantity(item, quantity) {
    if (quantity < 1) return remove(item);
    setItems((current) => current.map((i) => (i.id === item.id ? { ...i, quantity } : i)));
    try {
      await request(`/api/ingredient/${item.id}`, { method: 'PATCH', body: { quantity } });
    } catch (err) {
      setError(err.message);
      load();
    }
  }

  function remove(item) {
    Alert.alert(`Remove ${item.name}?`, 'It will be taken out of your kitchen.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setItems((current) => current.filter((i) => i.id !== item.id));
          try {
            await request(`/api/ingredient/${item.id}`, { method: 'DELETE' });
          } catch (err) {
            setError(err.message);
            load();
          }
        }
      }
    ]);
  }

  const shown = useMemo(() => items.filter((item) => filter === 'all' || (filter === 'fridge') === item.fridge_bool), [items, filter]);
  const soon = items.filter((item) => { const d = expiryStatus(item.date_expire).days; return d !== null && d <= 3; }).length;

  const header = (
    <View>
      <AddItem onAdded={(item) => setItems((current) => [...current, item].sort(byExpiry))} />
      <View style={styles.summary}>
        <Text style={styles.summaryText}>{items.length} item{items.length === 1 ? '' : 's'}{soon ? ` · ${soon} to use soon` : ''}</Text>
      </View>
      <Segmented label="Show" value={filter} onChange={setFilter}
        options={[{ label: 'All', value: 'all' }, { label: 'Fridge', value: 'fridge' }, { label: 'Pantry', value: 'pantry' }]} />
      <ErrorText>{error}</ErrorText>
    </View>
  );

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <FlatList
        data={shown}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        ListHeaderComponent={header}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.mintDark} />}
        ListEmptyComponent={!loading ? <Muted style={styles.empty}>{filter === 'all' ? 'Your kitchen is empty. Add your first item above.' : `Nothing in the ${filter} yet.`}</Muted> : null}
        renderItem={({ item }) => <ItemRow item={item} celiac={celiac} strict={strict} onQuantity={changeQuantity} onRemove={remove} />}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { padding: 16, paddingBottom: 40 },
  row: { flexDirection: 'row', gap: 12 },
  qty: { width: 96 },
  label: { fontSize: 14, fontWeight: '700', color: colors.ink, marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 },
  summary: { marginBottom: 10 },
  summaryText: { fontSize: 15, fontWeight: '700', color: colors.inkSoft },
  empty: { textAlign: 'center', paddingVertical: 24 },
  item: { backgroundColor: colors.white, borderRadius: 16, borderWidth: 1, borderColor: colors.line, padding: 14, marginBottom: 10 },
  itemRisky: { borderColor: '#F4C7B9', backgroundColor: '#FFF7F4' },
  itemTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  itemName: { fontSize: 17, fontWeight: '700', color: colors.ink, flexShrink: 1 },
  itemGluten: { marginTop: 6 },
  itemBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, gap: 8 },
  itemMeta: { fontSize: 13, flexShrink: 1 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: 20, fontWeight: '700', color: colors.ink, lineHeight: 22 },
  qtyText: { minWidth: 24, textAlign: 'center', fontSize: 16, fontWeight: '700', color: colors.ink },
  removeBtn: { paddingHorizontal: 8, paddingVertical: 8 },
  removeText: { color: colors.danger, fontWeight: '700', fontSize: 14 }
});
