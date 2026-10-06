// The score and dish list for a restaurant check or a menu photo, like the website's
import React, { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../lib/theme';
import { CROSS_CONTACT, DISCLAIMER, scoreColor, sortDishes, verdictLook } from '../lib/gluten';
import { Badge, Button, Card, CardTitle, Chip, Muted } from './ui';

const open = (url) => { if (url) Linking.openURL(url); };

function LinkText({ url, children }) {
  return <Text accessibilityRole="link" style={styles.link} onPress={() => open(url)}>{children}</Text>;
}

export function ScoreCard({ result, strict }) {
  const { score, cross_contact: cross } = result;
  const hasKitchen = score.overall_score !== undefined;
  const value = hasKitchen ? score.overall_score : score.ingredient_score;
  const crossLook = cross ? CROSS_CONTACT[cross.level] || CROSS_CONTACT.high : null;
  return (
    <Card>
      <View style={styles.scoreRow} accessible accessibilityLabel={`${hasKitchen ? 'Gluten safety estimate' : 'Ingredient score'} ${value} percent`}>
        <View style={[styles.ring, { borderColor: scoreColor(value) }]}>
          <Text style={[styles.ringValue, { color: scoreColor(value) }]}>{value}%</Text>
          <Text style={styles.ringLabel}>{hasKitchen ? 'Gluten safety estimate' : 'Ingredient score'}</Text>
        </View>
        <View style={styles.scoreDetail}>
          {result.restaurant && result.restaurant.name ? <Text style={styles.restaurant}>{result.restaurant.name}</Text> : null}
          {result.restaurant && result.restaurant.location ? <Muted style={styles.small}>{result.restaurant.location}</Muted> : null}
          <Text style={styles.body}><Text style={styles.bold}>{score.counts.low_risk} of {score.total}</Text> dishes have low ingredient risk.</Text>
        </View>
      </View>
      <View style={styles.counts}>
        <Badge tone="expired" label={`Likely gluten ${score.counts.likely_gluten}`} />
        <Badge tone={strict ? 'expired' : 'today'} label={`Ask first ${score.counts.ask}`} />
        {score.counts.unknown > 0 ? <Badge tone="expired" label={`Unknown ${score.counts.unknown}`} /> : null}
      </View>

      {hasKitchen && cross ? (
        <View style={styles.cross}>
          <View style={styles.crossHead}>
            <Text style={styles.h3}>Cross-contact risk</Text>
            <Badge tone={crossLook.tone} label={crossLook.label} />
          </View>
          {score.capped ? <Text style={styles.capped}>Capped at {score.cross_contact_cap}% because of the {crossLook.label.toLowerCase()} cross-contact risk{strict ? ' (Strict mode)' : ''}.</Text> : null}
          {cross.summary ? <Text style={styles.body}>{cross.summary}</Text> : null}
          {cross.menu_note ? <Text style={styles.body}>{cross.menu_note}</Text> : null}
          {(cross.findings || []).map((f, i) => (
            <View key={i} style={[styles.finding, f.tone === 'good' ? styles.good : f.tone === 'bad' ? styles.bad : null]}>
              <Text style={styles.body}>{f.tone === 'good' ? '✓ ' : f.tone === 'bad' ? '⚠ ' : '• '}{f.text} <LinkText url={f.source_url}>Source</LinkText></Text>
            </View>
          ))}
        </View>
      ) : null}
      {!hasKitchen ? <Muted style={styles.note}>A photo can’t tell us about the kitchen, so cross-contact isn’t rated. Assume a shared kitchen and fryer unless staff say otherwise.</Muted> : null}
      {result.sources && result.sources.length ? (
        <Text style={[styles.small, styles.sources]}>Sources: {result.sources.map((s, i) => <Text key={s.url}>{i ? ' · ' : ''}<LinkText url={s.url}>{s.label}</LinkText></Text>)}</Text>
      ) : null}
      <Muted style={styles.disclaimer}>{result.disclaimer || DISCLAIMER}</Muted>
    </Card>
  );
}

function DishRow({ dish, strict, onAskWaiter }) {
  const [open, setOpen] = useState(false);
  const look = verdictLook(dish.verdict, strict);
  return (
    <View style={styles.dish}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={`${dish.name}, ${look.label}`}
        onPress={() => setOpen(!open)} style={styles.dishHead}>
        <View style={styles.flex}>
          <Text style={styles.dishName}>{dish.name}</Text>
          {dish.description ? <Muted style={styles.small}>{dish.description}</Muted> : null}
        </View>
        <View style={styles.dishVerdict}>
          <Badge tone={look.tone} label={look.label} />
          {dish.gluten_chance !== null && dish.gluten_chance !== undefined ? <Text style={styles.chance}>{dish.gluten_chance}% chance of gluten</Text> : null}
        </View>
      </Pressable>
      {open ? (
        <View style={styles.more}>
          {dish.reason ? <Text style={styles.body}>{dish.reason}</Text> : null}
          {dish.sources.length ? <Text style={styles.body}><Text style={styles.bold}>Gluten often hides in:</Text> {dish.sources.join(', ')}.</Text> : null}
          {dish.recipes ? (
            <Text style={styles.body}><Text style={styles.bold}>{dish.recipes.with_gluten} of {dish.recipes.checked}</Text> published recipes for this dish use a gluten ingredient.</Text>
          ) : null}
          {dish.cautions.map((c) => <Text key={c} style={styles.body}>• {c}</Text>)}
          {dish.questions.length ? <Text style={[styles.body, styles.bold]}>Ask your server:</Text> : null}
          {dish.questions.map((q) => <Text key={q} style={styles.body}>• {q}</Text>)}
          {onAskWaiter ? <Button small variant="ghost" title="🎤 Record what the server says" onPress={() => onAskWaiter(dish)} style={styles.askBtn} /> : null}
        </View>
      ) : null}
    </View>
  );
}

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'low_risk', label: 'Low risk' },
  { key: 'ask', label: 'Ask first' },
  { key: 'likely_gluten', label: 'Likely gluten' }
];

export function DishList({ dishes, strict, onAskWaiter }) {
  const [filter, setFilter] = useState('all');
  const shown = sortDishes(dishes.filter((d) => filter === 'all' || d.verdict === filter || (filter === 'likely_gluten' && d.verdict === 'unknown')));
  return (
    <Card>
      <CardTitle icon="🍽️" title="Dishes" right={String(dishes.length)} />
      <View style={styles.filters}>
        {FILTERS.map((f) => <Chip key={f.key} label={f.label} selected={filter === f.key} onPress={() => setFilter(f.key)} />)}
      </View>
      {shown.length ? shown.map((dish, i) => <DishRow key={`${dish.name}-${i}`} dish={dish} strict={strict} onAskWaiter={onAskWaiter} />)
        : <Muted style={styles.note}>No dishes in this group.</Muted>}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  ring: { width: 118, height: 118, borderRadius: 59, borderWidth: 9, alignItems: 'center', justifyContent: 'center', padding: 6 },
  ringValue: { fontSize: 30, fontWeight: '700' },
  ringLabel: { fontSize: 11, fontWeight: '700', color: colors.inkSoft, textAlign: 'center' },
  scoreDetail: { flex: 1, gap: 4 },
  restaurant: { fontSize: 20, fontWeight: '700', color: colors.ink },
  counts: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 },
  cross: { marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.line, gap: 8 },
  crossHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  h3: { fontSize: 17, fontWeight: '700', color: colors.ink },
  capped: { fontWeight: '700', color: '#8A5300', fontSize: 15 },
  finding: { padding: 10, borderRadius: 12, backgroundColor: colors.sand },
  good: { backgroundColor: colors.mintTint },
  bad: { backgroundColor: '#FFF0EB' },
  body: { fontSize: 15, lineHeight: 21, color: colors.ink },
  bold: { fontWeight: '700' },
  small: { fontSize: 13 },
  sources: { marginTop: 12, color: colors.inkSoft },
  note: { marginTop: 12, fontSize: 14 },
  disclaimer: { marginTop: 12, fontSize: 13, fontWeight: '600' },
  link: { color: colors.mintDark, fontWeight: '700' },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
  dish: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  dishHead: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  dishName: { fontSize: 16, fontWeight: '700', color: colors.ink },
  dishVerdict: { alignItems: 'flex-end', gap: 4, maxWidth: 150 },
  chance: { fontSize: 12, fontWeight: '700', color: colors.inkSoft, textAlign: 'right' },
  more: { marginTop: 10, gap: 6 },
  askBtn: { alignSelf: 'flex-start', marginTop: 6 }
});
