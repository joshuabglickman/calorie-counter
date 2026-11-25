import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { fromKey, todayKey } from './dates';
import {
  GLUCOSE_TAGS,
  GlucoseReading,
  GlucoseTag,
  GlucoseUnit,
  glucoseIn,
  glucoseToMgdl,
  newId,
  parseNumber,
} from './storage';
import { Theme, useTheme } from './theme';

function pad(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

/** "7:05 AM" in the phone's format. */
export function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/**
 * Parses a typed time ("7:30", "730", "7:30pm", "19:30", "7 pm") on the given day.
 * Returns null if it can't be read.
 */
export function parseTime(text: string, dayKey: string): number | null {
  const m = text
    .trim()
    .toLowerCase()
    .match(/^(\d{1,2})(?::?(\d{2}))?\s*([ap])?\.?m?\.?$/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  if (m[3]) {
    if (h < 1 || h > 12) return null;
    if (m[3] === 'p' && h !== 12) h += 12;
    if (m[3] === 'a' && h === 12) h = 0;
  }
  if (h > 23 || min > 59) return null;
  const d = fromKey(dayKey);
  d.setHours(h, min, 0, 0);
  return d.getTime();
}

/** Average of a day's readings in mg/dL, or null when there are none. */
export function glucoseAverage(readings: GlucoseReading[] | undefined): number | null {
  if (!readings?.length) return null;
  return readings.reduce((sum, r) => sum + r.value, 0) / readings.length;
}

/** The day's blood sugar readings: add, remove, switch unit. */
export function GlucoseModal({
  visible,
  dayKey,
  dayLabel,
  readings,
  unit,
  goal,
  onClose,
  onChange,
  onGoal,
}: {
  visible: boolean;
  dayKey: string;
  dayLabel: string;
  readings: GlucoseReading[];
  unit: GlucoseUnit;
  /** mg/dL */
  goal: number | undefined;
  onClose: () => void;
  onChange: (readings: GlucoseReading[], unit: GlucoseUnit) => void;
  /** mg/dL, or undefined to clear the goal. */
  onGoal: (goal: number | undefined) => void;
}) {
  const t = useTheme();
  const s = useMemo(() => styles(t), [t]);
  const [value, setValue] = useState('');
  const [time, setTime] = useState('');
  const [tag, setTag] = useState<GlucoseTag | undefined>(undefined);
  const [goalText, setGoalText] = useState('');
  const goalIn = (mgdl: number | undefined, u: GlucoseUnit) => (mgdl === undefined ? '' : String(glucoseIn(mgdl, u)));

  // Reset the form each time the dialog opens. Today's time defaults to now; other
  // days start blank so the time gets typed in.
  const reset = () => {
    const now = new Date();
    setValue('');
    setTag(undefined);
    setGoalText(goalIn(goal, unit));
    setTime(dayKey === todayKey() ? `${now.getHours()}:${pad(now.getMinutes())}` : '');
  };

  const n = parseNumber(value);
  const when = parseTime(time, dayKey);
  const valid = n > 0 && when !== null;
  const sorted = [...readings].sort((a, b) => a.time - b.time);

  // The goal is saved when the dialog closes or the unit changes; returns the goal in mg/dL.
  const commitGoal = () => {
    const text = goalText.trim();
    if (text === goalIn(goal, unit)) return goal;
    const g = parseNumber(text);
    const next = text === '' ? undefined : g > 0 ? glucoseToMgdl(g, unit) : goal;
    if (next !== goal) onGoal(next);
    return next;
  };
  const close = () => {
    commitGoal();
    onClose();
  };
  const switchUnit = (k: GlucoseUnit) => {
    if (k === unit) return;
    setGoalText(goalIn(commitGoal(), k));
    onChange(readings, k);
  };

  const add = () => {
    if (!valid) return;
    onChange([...readings, { id: newId(), time: when, value: glucoseToMgdl(n, unit), tag }], unit);
    setValue('');
    setTag(undefined);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close} onShow={reset}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        <View style={s.dialog}>
          <View style={s.titleRow}>
            <Text style={s.title}>Blood sugar · {dayLabel}</Text>
            <View style={s.tabs}>
              {(['mg/dL', 'mmol/L'] as GlucoseUnit[]).map((k) => (
                <Pressable key={k} onPress={() => switchUnit(k)} style={[s.tab, unit === k && s.tabActive]}>
                  <Text style={[s.tabText, unit === k && s.tabTextActive]}>{k}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {sorted.length > 0 ? (
            <ScrollView style={{ maxHeight: 220 }}>
              {sorted.map((r) => (
                <View key={r.id} style={s.reading}>
                  <Text style={s.readingTime}>{formatTime(r.time)}</Text>
                  <Text style={[s.readingValue, goal !== undefined && r.value > goal && { color: t.over }]}>
                    {glucoseIn(r.value, unit)}
                  </Text>
                  <Text style={s.readingTag} numberOfLines={1}>
                    {GLUCOSE_TAGS.find((g) => g.key === r.tag)?.label ?? ''}
                  </Text>
                  <Pressable
                    onPress={() => onChange(readings.filter((x) => x.id !== r.id), unit)}
                    hitSlop={10}
                    accessibilityLabel="Remove reading"
                  >
                    <Text style={s.remove}>✕</Text>
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          ) : (
            <Text style={s.muted}>No readings this day.</Text>
          )}

          <Text style={[s.muted, { marginTop: 14, marginBottom: 6 }]}>Add a reading</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput
              style={[s.input, { flex: 1 }]}
              value={value}
              onChangeText={setValue}
              keyboardType="decimal-pad"
              placeholder={unit}
              placeholderTextColor={t.muted}
              autoFocus
              onSubmitEditing={add}
            />
            <TextInput
              style={[s.input, { width: 110 }, time !== '' && when === null && { borderColor: t.danger }]}
              value={time}
              onChangeText={setTime}
              placeholder="time, 7:30am"
              placeholderTextColor={t.muted}
              autoCapitalize="none"
              onSubmitEditing={add}
            />
          </View>
          <View style={s.chips}>
            {GLUCOSE_TAGS.map((g) => (
              <Pressable
                key={g.key}
                onPress={() => setTag(tag === g.key ? undefined : g.key)}
                style={[s.chip, tag === g.key && s.chipActive]}
              >
                <Text style={[s.chipText, tag === g.key && s.chipTextActive]}>{g.label}</Text>
              </Pressable>
            ))}
          </View>

          <View style={s.goalRow}>
            <Text style={s.goalLabel}>Goal (at or below)</Text>
            <TextInput
              style={[s.input, s.goalInput]}
              value={goalText}
              onChangeText={setGoalText}
              keyboardType="decimal-pad"
              placeholder="optional"
              placeholderTextColor={t.muted}
              selectTextOnFocus
            />
            <Text style={s.muted}>{unit}</Text>
          </View>

          <View style={s.buttons}>
            <Pressable onPress={close} hitSlop={8}>
              <Text style={[s.btn, { color: t.muted }]}>Done</Text>
            </Pressable>
            <Pressable onPress={add} disabled={!valid} hitSlop={8}>
              <Text style={[s.btn, { color: t.accent }, !valid && { opacity: 0.4 }]}>Add</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
    dialog: { backgroundColor: t.card, borderRadius: 18, padding: 18 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
    title: { flex: 1, fontSize: 17, fontWeight: '700', color: t.text },
    tabs: { flexDirection: 'row', backgroundColor: t.chip, borderRadius: 9, padding: 2 },
    tab: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 7 },
    tabActive: { backgroundColor: t.card },
    tabText: { color: t.muted, fontSize: 12, fontWeight: '600' },
    tabTextActive: { color: t.text },
    reading: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 6,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.border,
    },
    readingTime: { width: 72, fontSize: 14, color: t.muted, fontVariant: ['tabular-nums'] },
    readingValue: { width: 48, fontSize: 16, fontWeight: '800', color: t.text, fontVariant: ['tabular-nums'] },
    readingTag: { flex: 1, fontSize: 13, color: t.muted },
    remove: { fontSize: 15, color: t.danger, paddingHorizontal: 4 },
    muted: { fontSize: 12, color: t.muted },
    input: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 18,
      color: t.text,
      backgroundColor: t.bg,
    },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
    chip: { backgroundColor: t.chip, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
    chipActive: { backgroundColor: t.accent },
    chipText: { fontSize: 13, color: t.text, fontWeight: '600' },
    chipTextActive: { color: t.accentText },
    goalRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
    goalLabel: { flex: 1, fontSize: 14, color: t.text },
    goalInput: { width: 90, paddingVertical: 6, fontSize: 16 },
    buttons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 28, marginTop: 18 },
    btn: { fontSize: 16, fontWeight: '700' },
  });
