import { useMemo } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Column, Display, GlucoseUnit, SummaryItem } from './storage';
import { Theme, useTheme } from './theme';

export const COLUMN_LABELS: Record<Column, string> = {
  kcal: 'Calories',
  carbs: 'Net carbs',
  protein: 'Protein',
  sodium: 'Sodium',
};

export const SUMMARY_LABELS: Record<SummaryItem, string> = {
  ...COLUMN_LABELS,
  weight: 'Weight',
  glucose: 'Blood sugar',
};

export const shown = (map: Partial<Record<string, boolean>>, key: string) => map[key] !== false;

/** Preferences: which columns and summary items to show, blood sugar unit. */
export function SettingsModal({
  visible,
  display,
  glucoseUnit,
  onClose,
  onChange,
  onGlucoseUnit,
}: {
  visible: boolean;
  display: Display;
  glucoseUnit: GlucoseUnit;
  onClose: () => void;
  onChange: (display: Display) => void;
  onGlucoseUnit: (unit: GlucoseUnit) => void;
}) {
  const t = useTheme();
  const s = useMemo(() => styles(t), [t]);
  const insets = useSafeAreaInsets();

  const toggles = <K extends string>(
    labels: Record<K, string>,
    map: Partial<Record<K, boolean>>,
    set: (next: Partial<Record<K, boolean>>) => void,
  ) =>
    (Object.keys(labels) as K[]).map((k, i) => (
      <View key={k} style={[s.row, i > 0 && s.rowBorder]}>
        <Text style={s.rowText}>{labels[k]}</Text>
        <Switch
          value={shown(map, k)}
          onValueChange={(v) => set({ ...map, [k]: v })}
          trackColor={{ true: t.accent, false: t.track }}
          thumbColor="#fff"
        />
      </View>
    ));

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[s.screen, { paddingTop: insets.top }]}>
        <View style={s.header}>
          <Text style={s.title}>Settings</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={s.done}>Done</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: insets.bottom + 24 }}>
          <Text style={s.section}>Columns in the food list</Text>
          <View style={s.card}>
            {toggles(COLUMN_LABELS, display.columns, (columns) => onChange({ ...display, columns }))}
          </View>

          <Text style={s.section}>Summary at the top</Text>
          <View style={s.card}>
            {toggles(SUMMARY_LABELS, display.summary, (summary) => onChange({ ...display, summary }))}
          </View>

          <Text style={s.section}>Blood sugar unit</Text>
          <View style={[s.card, s.row]}>
            <Text style={s.rowText}>Unit</Text>
            <View style={s.tabs}>
              {(['mg/dL', 'mmol/L'] as GlucoseUnit[]).map((k) => (
                <Pressable key={k} onPress={() => onGlucoseUnit(k)} style={[s.tab, glucoseUnit === k && s.tabActive]}>
                  <Text style={[s.tabText, glucoseUnit === k && s.tabTextActive]}>{k}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 },
    title: { flex: 1, fontSize: 20, fontWeight: '700', color: t.text },
    done: { fontSize: 16, fontWeight: '700', color: t.accent },
    section: {
      fontSize: 12,
      fontWeight: '700',
      color: t.muted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginTop: 14,
      marginBottom: 6,
      marginLeft: 4,
    },
    card: { backgroundColor: t.card, borderRadius: 12, paddingHorizontal: 14 },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48 },
    rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border },
    rowText: { fontSize: 15, color: t.text },
    tabs: { flexDirection: 'row', backgroundColor: t.chip, borderRadius: 9, padding: 2 },
    tab: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 7 },
    tabActive: { backgroundColor: t.bg },
    tabText: { color: t.muted, fontSize: 13, fontWeight: '600' },
    tabTextActive: { color: t.text },
  });
