// Small building blocks styled like the website
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius } from '../lib/theme';
import { TONES } from '../lib/gluten';

export function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function CardTitle({ icon, title, right }) {
  return (
    <View style={styles.cardHeader}>
      <Text style={styles.cardTitle} accessibilityRole="header">{icon ? `${icon}  ` : ''}{title}</Text>
      {right ? <Text style={styles.cardRight}>{right}</Text> : null}
    </View>
  );
}

export function Button({ title, onPress, variant = 'primary', disabled, busy, small, style, accessibilityLabel }) {
  const look = { primary: styles.btnPrimary, ghost: styles.btnGhost, danger: styles.btnDanger }[variant];
  const text = { primary: styles.btnPrimaryText, ghost: styles.btnGhostText, danger: styles.btnDangerText }[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityState={{ disabled: !!(disabled || busy) }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [styles.btn, small && styles.btnSmall, look, (disabled || busy) && styles.btnDisabled, pressed && styles.btnPressed, style]}
    >
      {busy ? <ActivityIndicator color={variant === 'primary' ? colors.white : colors.ink} /> : <Text style={[styles.btnText, small && styles.btnSmallText, text]}>{title}</Text>}
    </Pressable>
  );
}

export function Badge({ tone = 'none', label }) {
  const t = TONES[tone] || TONES.none;
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]}>
      <Text style={[styles.badgeText, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

export function Field({ label, style, ...props }) {
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput accessibilityLabel={label} placeholderTextColor="#8A9C99" style={styles.input} {...props} />
    </View>
  );
}

// A row of options where one is chosen (Fridge / Pantry, Restaurant / Menu / Waiter)
export function Segmented({ options, value, onChange, label }) {
  return (
    <View style={styles.segmented} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable key={option.value} accessibilityRole="radio" accessibilityState={{ selected }} accessibilityLabel={option.label}
            onPress={() => onChange(option.value)} style={[styles.segment, selected && styles.segmentOn]}>
            <Text style={[styles.segmentText, selected && styles.segmentTextOn]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Chip({ label, selected, onPress }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: !!selected }} onPress={onPress}
      style={[styles.chip, selected && styles.chipOn]}>
      <Text style={[styles.chipText, selected && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

export function ErrorText({ children }) {
  if (!children) return null;
  return <Text accessibilityRole="alert" style={styles.error}>{children}</Text>;
}

export function Muted({ children, style }) {
  return <Text style={[styles.muted, style]}>{children}</Text>;
}

export const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 18,
    marginBottom: 16,
    shadowColor: colors.ink,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 8 },
  cardTitle: { fontSize: 19, fontWeight: '700', color: colors.ink, flexShrink: 1 },
  cardRight: { fontSize: 13, fontWeight: '700', color: colors.inkSoft },
  btn: { minHeight: 48, borderRadius: radius.pill, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
  btnSmall: { minHeight: 36, paddingHorizontal: 14 },
  btnPrimary: { backgroundColor: colors.mint },
  btnGhost: { backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.border },
  btnDanger: { backgroundColor: colors.white, borderWidth: 1.5, borderColor: '#F4C7B9' },
  btnDisabled: { opacity: 0.6 },
  btnPressed: { opacity: 0.85 },
  btnText: { fontSize: 16, fontWeight: '700' },
  btnSmallText: { fontSize: 14 },
  btnPrimaryText: { color: colors.white },
  btnGhostText: { color: colors.ink },
  btnDangerText: { color: colors.danger },
  badge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  badgeText: { fontSize: 12, fontWeight: '700' },
  field: { marginBottom: 12 },
  fieldLabel: { fontSize: 14, fontWeight: '700', color: colors.ink, marginBottom: 6 },
  input: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.field, backgroundColor: colors.white,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: colors.ink
  },
  segmented: { flexDirection: 'row', backgroundColor: colors.sand, borderRadius: radius.pill, padding: 4, gap: 4, marginBottom: 14 },
  segment: { flex: 1, paddingVertical: 9, borderRadius: radius.pill, alignItems: 'center' },
  segmentOn: { backgroundColor: colors.white, shadowColor: colors.ink, shadowOpacity: 0.12, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  segmentText: { fontWeight: '700', color: colors.inkSoft, fontSize: 14 },
  segmentTextOn: { color: colors.ink },
  chip: { borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: colors.white },
  chipOn: { backgroundColor: colors.mintTint, borderColor: colors.mint },
  chipText: { fontSize: 13, fontWeight: '700', color: colors.inkSoft },
  chipTextOn: { color: colors.mintDark },
  error: { backgroundColor: '#FFF0EB', color: colors.danger, fontWeight: '700', padding: 12, borderRadius: radius.field, marginTop: 12, overflow: 'hidden' },
  muted: { color: colors.inkSoft, fontSize: 15, lineHeight: 21 }
});
