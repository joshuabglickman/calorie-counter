import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  SectionList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppVersion } from './src/AppVersion';
import { exportBackup, pickBackup, saveBackupToFolder } from './src/backup';
import { addDays, formatDay, todayKey } from './src/dates';
import { EntryDraft, EntryForm } from './src/EntryForm';
import { normalize } from './src/foodDb';
import { findExact, mineOptions } from './src/foodSearch';
import { glucoseAverage, GlucoseModal } from './src/Glucose';
import { SettingsModal, shown } from './src/Settings';
import {
  calcCalories,
  calcCarbs,
  calcGrams,
  Column,
  fmtCarbs,
  glucoseIn,
  GlucoseReading,
  GlucoseUnit,
  SummaryItem,
  convertWeights,
  Data,
  DEFAULT_DATA,
  Entry,
  entryMeal,
  formatAmount,
  Meal,
  mealForTime,
  MEALS,
  loadData,
  newId,
  parseNumber,
  saveData,
  WeightUnit,
} from './src/storage';
import { Theme, useTheme } from './src/theme';

export default function App() {
  return (
    <SafeAreaProvider>
      <Main />
    </SafeAreaProvider>
  );
}

type Tab = 'day' | 'history';

const COLLAPSED_KEY = 'caloriecounter:collapsedMeals';

type Nums = { kcal: number; carbs?: number; protein?: number; sodium?: number };
type ColStyle = 'colKcal' | 'colCarbs' | 'colNa';

/** Food list columns, in order. Which ones show is set in Settings. */
const COLS: { key: Column; header: string; width: ColStyle; fmt: (n: Nums) => string }[] = [
  { key: 'kcal', header: 'kcal', width: 'colKcal', fmt: (n) => n.kcal.toLocaleString() },
  { key: 'carbs', header: 'carbs', width: 'colCarbs', fmt: (n) => (n.carbs === undefined ? '–' : `${fmtCarbs(n.carbs)}g`) },
  { key: 'protein', header: 'protein', width: 'colCarbs', fmt: (n) => (n.protein === undefined ? '–' : `${n.protein}g`) },
  { key: 'sodium', header: 'sodium', width: 'colNa', fmt: (n) => (n.sodium === undefined ? '–' : n.sodium.toLocaleString()) },
];
type Col = (typeof COLS)[number];

function Main() {
  const t = useTheme();
  const s = useMemo(() => styles(t), [t]);
  const insets = useSafeAreaInsets();

  const [data, setData] = useState<Data>(DEFAULT_DATA);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<Tab>('day');
  const [day, setDay] = useState(todayKey());
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [addMeal, setAddMeal] = useState<Meal>('breakfast');
  const [weightOpen, setWeightOpen] = useState(false);
  const [goalOpen, setGoalOpen] = useState<null | GoalKey>(null);
  const [glucoseOpen, setGlucoseOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const cols = COLS.filter((c) => shown(data.display.columns, c.key));

  useEffect(() => {
    loadData().then((d) => {
      // One-time switch from total to net carbs: refresh saved foods that are in the
      // built-in lists, then recompute carbs on every entry we can look up.
      const migrate = !d.netCarbs;
      let foods = d.foods;
      if (migrate) {
        foods = { ...d.foods };
        for (const [key, f] of Object.entries(foods)) {
          const db = findExact(f.name, []);
          if (db?.carbsPerKcal != null) foods[key] = { ...f, carbsPerKcal: db.carbsPerKcal };
        }
      }
      const mine = mineOptions(foods);
      const entries = d.entries.map((e) => {
        if (!migrate && e.carbs !== undefined && e.protein !== undefined && e.sodium !== undefined) return e;
        const f = findExact(e.name, mine);
        const net = migrate ? calcCarbs(e.kcal, f?.carbsPerKcal) : undefined;
        return {
          ...e,
          carbs: net ?? e.carbs ?? calcCarbs(e.kcal, f?.carbsPerKcal),
          protein: e.protein ?? calcGrams(e.kcal, f?.proteinPerKcal),
          sodium: e.sodium ?? calcGrams(e.kcal, f?.sodiumPerKcal),
        };
      });
      setData({ ...d, foods, entries, netCarbs: true });
      setLoaded(true);
    });
  }, []);

  // Persist every change after the initial load.
  const firstSave = useRef(true);
  useEffect(() => {
    if (!loaded) return;
    if (firstSave.current) {
      firstSave.current = false;
      return;
    }
    saveData(data).catch(() => {});
  }, [data, loaded]);

  const dayEntries = useMemo(
    () => data.entries.filter((e) => e.date === day).sort((a, b) => a.createdAt - b.createdAt),
    [data.entries, day],
  );
  const dayTotal = dayEntries.reduce((sum, e) => sum + e.kcal, 0);
  const dayCarbs = dayEntries.reduce((sum, e) => sum + (e.carbs ?? 0), 0);
  const dayProtein = dayEntries.reduce((sum, e) => sum + (e.protein ?? 0), 0);
  const daySodium = dayEntries.reduce((sum, e) => sum + (e.sodium ?? 0), 0);
  // Collapsed meals (remembered on this phone across days and restarts).
  const [collapsed, setCollapsed] = useState<Meal[]>([]);
  useEffect(() => {
    AsyncStorage.getItem(COLLAPSED_KEY)
      .then((raw) => raw && setCollapsed(JSON.parse(raw)))
      .catch(() => {});
  }, []);
  const toggleMeal = (meal: Meal) => {
    setCollapsed((prev) => {
      const next = prev.includes(meal) ? prev.filter((m) => m !== meal) : [...prev, meal];
      AsyncStorage.setItem(COLLAPSED_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  const sections = useMemo(
    () =>
      MEALS.map((m) => {
        const items = dayEntries.filter((e) => entryMeal(e) === m.key);
        const isCollapsed = collapsed.includes(m.key);
        return {
          ...m,
          data: isCollapsed ? [] : items,
          count: items.length,
          isCollapsed,
          kcal: items.reduce((sum, e) => sum + e.kcal, 0),
          carbs: items.reduce((sum, e) => sum + (e.carbs ?? 0), 0),
          protein: items.reduce((sum, e) => sum + (e.protein ?? 0), 0),
          sodium: items.reduce((sum, e) => sum + (e.sodium ?? 0), 0),
        };
      }),
    [dayEntries, collapsed],
  );

  const saveEntry = useCallback(
    (draft: EntryDraft) => {
      const kcal = calcCalories(draft.amount, draft.unit, draft.kcalPer);
      const { remember, carbsPerKcal, proteinPerKcal, sodiumPerKcal, ...fields } = draft;
      const carbs = calcCarbs(kcal, carbsPerKcal);
      const protein = calcGrams(kcal, proteinPerKcal);
      const sodium = calcGrams(kcal, sodiumPerKcal);
      setData((prev) => {
        const entries = editing
          ? prev.entries.map((e) => (e.id === editing.id ? { ...e, ...fields, kcal, carbs, protein, sodium } : e))
          : [
              ...prev.entries,
              { ...fields, kcal, carbs, protein, sodium, id: newId(), date: day, createdAt: Date.now() },
            ];
        // Foods from the built-in lists are looked up again next time; only typed
        // calories and online picks are saved.
        if (!remember) return { ...prev, entries };
        const key = normalize(fields.name);
        const existing = prev.foods[key];
        const foods = {
          ...prev.foods,
          [key]: {
            ...fields,
            units: remember.units,
            countUnit: remember.countUnit,
            carbsPerKcal: remember.carbsPerKcal,
            proteinPerKcal: remember.proteinPerKcal,
            sodiumPerKcal: remember.sodiumPerKcal,
            lastUsed: Date.now(),
            uses: (existing?.uses ?? 0) + (editing ? 0 : 1),
          },
        };
        return { ...prev, entries, foods };
      });
      setFormOpen(false);
      setEditing(null);
    },
    [editing, day],
  );

  const deleteEntry = useCallback((entry: Entry) => {
    setData((prev) => ({ ...prev, entries: prev.entries.filter((e) => e.id !== entry.id) }));
    setFormOpen(false);
    setEditing(null);
  }, []);

  const openAdd = (meal?: Meal) => {
    setAddMeal(meal ?? mealForTime(new Date()));
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (e: Entry) => {
    setEditing(e);
    setFormOpen(true);
  };

  if (!loaded) {
    return (
      <View style={[s.screen, { justifyContent: 'center' }]}>
        <ActivityIndicator color={t.accent} />
      </View>
    );
  }

  const isToday = day === todayKey();

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <StatusBar style="auto" />

      <View style={s.header}>
        {tab === 'day' ? (
          <View style={s.dateRow}>
            <Pressable onPress={() => setDay(addDays(day, -1))} hitSlop={10} style={s.arrow}>
              <Text style={s.arrowText}>‹</Text>
            </Pressable>
            <Pressable onPress={() => setDay(todayKey())} disabled={isToday} style={s.dateBtn}>
              <Text style={s.dateText} numberOfLines={1}>
                {formatDay(day)}
              </Text>
              {!isToday && <Text style={s.backToday}>Back to today</Text>}
            </Pressable>
            <Pressable
              onPress={() => setDay(addDays(day, 1))}
              hitSlop={10}
              style={[s.arrow, isToday && { opacity: 0.25 }]}
              disabled={isToday}
            >
              <Text style={s.arrowText}>›</Text>
            </Pressable>
          </View>
        ) : (
          <Text style={[s.dateText, { flex: 1, textAlign: 'left', marginLeft: 4 }]}>History</Text>
        )}
        <Pressable onPress={() => setSettingsOpen(true)} hitSlop={8} style={s.gear} accessibilityLabel="Settings">
          <Text style={s.gearText}>⚙</Text>
        </Pressable>
        <View style={s.tabs}>
          {(['day', 'history'] as Tab[]).map((k) => (
            <Pressable key={k} onPress={() => setTab(k)} style={[s.tab, tab === k && s.tabActive]}>
              <Text style={[s.tabText, tab === k && s.tabTextActive]}>{k === 'day' ? 'Day' : 'History'}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {tab === 'day' ? (
        <>
          <TotalCard
            total={dayTotal}
            carbs={dayCarbs}
            protein={dayProtein}
            sodium={daySodium}
            sodiumGoal={data.sodiumGoal}
            goal={data.goal}
            carbGoal={data.carbGoal}
            proteinGoal={data.proteinGoal}
            weight={data.weights[day]}
            weightGoal={data.weightGoal}
            glucose={data.glucose[day]}
            glucoseUnit={data.glucoseUnit}
            glucoseGoal={data.glucoseGoal}
            show={data.display.summary}
            onEdit={(what) =>
              what === 'weight' ? setWeightOpen(true) : what === 'glucose' ? setGlucoseOpen(true) : setGoalOpen(what)
            }
          />

          {/* Column headers stay put while the list scrolls. */}
          {dayEntries.length > 0 && cols.length > 0 && (
            <View style={s.colHeader}>
              {cols.map((c) => (
                <Text key={c.key} style={[s.colHeaderText, s[c.width]]}>
                  {c.header}
                </Text>
              ))}
            </View>
          )}
          <SectionList
            sections={sections}
            keyExtractor={(e) => e.id}
            stickySectionHeadersEnabled={false}
            contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: insets.bottom + 80 }}
            renderSectionHeader={({ section }) => (
              <View style={s.mealHeader}>
                <Pressable
                  onPress={() => toggleMeal(section.key)}
                  hitSlop={6}
                  style={s.mealToggle}
                  accessibilityLabel={`${section.isCollapsed ? 'Expand' : 'Collapse'} ${section.label}`}
                >
                  <Text style={s.mealChevron}>{section.isCollapsed ? '▸' : '▾'}</Text>
                  <Text style={s.mealTitle} numberOfLines={1}>
                    {section.label}
                    {section.isCollapsed && section.count > 0 && (
                      <Text style={s.mealCount}>{`  ${section.count} item${section.count === 1 ? '' : 's'}`}</Text>
                    )}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => openAdd(section.key)}
                  hitSlop={10}
                  style={s.mealAdd}
                  accessibilityLabel={`Add to ${section.label}`}
                >
                  <Text style={s.mealAddText}>＋</Text>
                </Pressable>
                {cols.map((c) => (
                  <Text key={c.key} style={[s.mealTotal, s[c.width]]}>
                    {section.count ? c.fmt(section) : ''}
                  </Text>
                ))}
              </View>
            )}
            renderItem={({ item, index, section }) => (
              <Pressable
                onPress={() => openEdit(item)}
                style={({ pressed }) => [
                  s.entry,
                  index === 0 && s.entryFirst,
                  index === section.data.length - 1 && s.entryLast,
                  pressed && { opacity: 0.6 },
                ]}
              >
                <Text style={s.entryName} numberOfLines={1}>
                  {item.name}
                  <Text style={s.entryMeta}> {formatAmount(item.amount, item.unit)}</Text>
                </Text>
                {cols.map((c) => (
                  <Text key={c.key} style={[c.key === 'kcal' ? s.entryKcal : s.entryCarbs, s[c.width]]}>
                    {c.fmt(item)}
                  </Text>
                ))}
              </Pressable>
            )}
            ListFooterComponent={
              dayEntries.length === 0 ? (
                <Text style={s.empty}>Nothing logged {isToday ? 'yet today' : 'this day'}.</Text>
              ) : undefined
            }
          />

          <Pressable
            onPress={() => openAdd()}
            style={({ pressed }) => [s.fab, { bottom: insets.bottom + 16 }, pressed && { opacity: 0.85 }]}
          >
            <Text style={s.fabText}>＋ Add food</Text>
          </Pressable>
        </>
      ) : (
        <History
          data={data}
          cols={cols}
          onRestore={(restored) => setData(restored)}
          onPickDay={(k) => {
            setDay(k);
            setTab('day');
          }}
        />
      )}

      <EntryForm
        visible={formOpen}
        editing={editing}
        defaultMeal={addMeal}
        foods={data.foods}
        dayLabel={formatDay(day)}
        onSave={saveEntry}
        onDelete={deleteEntry}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
      />

      <WeightModal
        visible={weightOpen}
        dayLabel={formatDay(day)}
        weight={data.weights[day]}
        goal={data.weightGoal}
        unit={data.weightUnit}
        onClose={() => setWeightOpen(false)}
        onSave={(weight, goal, unit) => {
          setData((prev) => {
            const weights = { ...convertWeights(prev.weights, prev.weightUnit, unit) };
            if (weight === null) delete weights[day];
            else weights[day] = weight;
            return { ...prev, weights, weightGoal: goal ?? undefined, weightUnit: unit };
          });
          setWeightOpen(false);
        }}
      />

      <GlucoseModal
        visible={glucoseOpen}
        dayKey={day}
        dayLabel={formatDay(day)}
        readings={data.glucose[day] ?? []}
        unit={data.glucoseUnit}
        goal={data.glucoseGoal}
        onGoal={(glucoseGoal) => setData((prev) => ({ ...prev, glucoseGoal }))}
        onClose={() => setGlucoseOpen(false)}
        onChange={(readings, unit) =>
          setData((prev) => {
            const glucose = { ...prev.glucose };
            if (readings.length) glucose[day] = readings;
            else delete glucose[day];
            return { ...prev, glucose, glucoseUnit: unit };
          })
        }
      />

      <SettingsModal
        visible={settingsOpen}
        display={data.display}
        glucoseUnit={data.glucoseUnit}
        onClose={() => setSettingsOpen(false)}
        onChange={(display) => setData((prev) => ({ ...prev, display }))}
        onGlucoseUnit={(glucoseUnit) => setData((prev) => ({ ...prev, glucoseUnit }))}
      />

      <GoalModal
        visible={goalOpen !== null}
        title={goalOpen ? GOALS[goalOpen].title : ''}
        goal={goalOpen ? data[GOALS[goalOpen].field] : undefined}
        onClose={() => setGoalOpen(null)}
        onSave={(value) => {
          if (goalOpen) setData((prev) => ({ ...prev, [GOALS[goalOpen].field]: value }));
          setGoalOpen(null);
        }}
      />
    </View>
  );
}

type GoalKey = 'kcal' | 'carbs' | 'protein' | 'sodium';
type Editable = GoalKey | 'weight' | 'glucose';

const GOALS: Record<GoalKey, { title: string; field: 'goal' | 'carbGoal' | 'proteinGoal' | 'sodiumGoal' }> = {
  kcal: { title: 'Daily calorie goal', field: 'goal' },
  carbs: { title: 'Daily net carb limit (g)', field: 'carbGoal' },
  protein: { title: 'Daily protein target (g)', field: 'proteinGoal' },
  sodium: { title: 'Daily sodium limit (mg)', field: 'sodiumGoal' },
};

const SUMMARY_KEYS: SummaryItem[] = ['kcal', 'carbs', 'protein', 'sodium', 'weight', 'glucose'];

/** Compact summary grid ("Calories: 1,501/1,500", "Sodium: 1,240/2,300"...). Tap an item to edit it. */
function TotalCard({
  total,
  carbs,
  protein,
  sodium,
  goal,
  carbGoal,
  proteinGoal,
  sodiumGoal,
  weight,
  weightGoal,
  glucose,
  glucoseUnit,
  glucoseGoal,
  show,
  onEdit,
}: {
  total: number;
  carbs: number;
  protein: number;
  sodium: number;
  goal: number;
  carbGoal: number;
  proteinGoal: number | undefined;
  sodiumGoal: number | undefined;
  weight: number | undefined;
  weightGoal: number | undefined;
  glucose: GlucoseReading[] | undefined;
  glucoseUnit: GlucoseUnit;
  glucoseGoal: number | undefined;
  show: Partial<Record<SummaryItem, boolean>>;
  onEdit: (what: Editable) => void;
}) {
  const t = useTheme();
  const s = useMemo(() => styles(t), [t]);
  const fmt = (n: number | undefined) => (n === undefined ? '?' : n.toLocaleString());
  // Most recent reading of the day.
  const latest = glucose?.length ? glucose.reduce((a, b) => (b.time > a.time ? b : a)) : undefined;
  if (!SUMMARY_KEYS.some((k) => shown(show, k))) return null;

  // Items turned off in Settings render nothing.
  const cell = (what: Editable, label: string, value: string, target?: string, color?: string) =>
    shown(show, what) && (
      <Pressable
        key={what}
        onPress={() => onEdit(what)}
        hitSlop={4}
        style={({ pressed }) => [s.statCell, pressed && { opacity: 0.6 }]}
      >
        <Text style={s.statText} numberOfLines={1}>
          <Text style={s.statLabel}>{label}: </Text>
          <Text style={[s.statValue, color ? { color } : null]}>{value}</Text>
          {target !== undefined && <Text style={s.statGoal}>/{target}</Text>}
        </Text>
      </Pressable>
    );

  return (
    <View style={[s.card, s.statGrid]}>
      {cell('kcal', 'Calories', total.toLocaleString(), goal.toLocaleString(), total > goal ? t.over : undefined)}
      {cell('carbs', 'Net carbs', fmtCarbs(carbs), String(carbGoal), Math.round(carbs * 10) / 10 > carbGoal ? t.over : undefined)}
      {cell(
        'protein',
        'Protein',
        String(protein),
        fmt(proteinGoal),
        proteinGoal !== undefined && protein >= proteinGoal ? t.accent : undefined,
      )}
      {cell(
        'sodium',
        'Sodium',
        sodium.toLocaleString(),
        fmt(sodiumGoal),
        sodiumGoal !== undefined && sodium > sodiumGoal ? t.over : undefined,
      )}
      {cell('weight', 'Weight', weight === undefined ? '—' : String(weight), fmt(weightGoal))}
      {cell(
        'glucose',
        'Blood sugar',
        latest ? String(glucoseIn(latest.value, glucoseUnit)) : '—',
        glucoseGoal === undefined ? '?' : String(glucoseIn(glucoseGoal, glucoseUnit)),
        latest && glucoseGoal !== undefined && latest.value > glucoseGoal ? t.over : undefined,
      )}
    </View>
  );
}

function History({
  data,
  cols,
  onPickDay,
  onRestore,
}: {
  data: Data;
  cols: Col[];
  onPickDay: (key: string) => void;
  onRestore: (data: Data) => void;
}) {
  const t = useTheme();
  const s = useMemo(() => styles(t), [t]);
  const insets = useSafeAreaInsets();

  const rows = useMemo(() => {
    const totals = new Map<string, { kcal: number; carbs: number; protein: number; sodium: number; count: number }>();
    for (const d of [...Object.keys(data.weights), ...Object.keys(data.glucose)])
      totals.set(d, { kcal: 0, carbs: 0, protein: 0, sodium: 0, count: 0 });
    for (const e of data.entries) {
      const cur = totals.get(e.date) ?? { kcal: 0, carbs: 0, protein: 0, sodium: 0, count: 0 };
      cur.kcal += e.kcal;
      cur.carbs += e.carbs ?? 0;
      cur.protein += e.protein ?? 0;
      cur.sodium += e.sodium ?? 0;
      cur.count += 1;
      totals.set(e.date, cur);
    }
    return [...totals.entries()].map(([date, v]) => ({ date, ...v })).sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [data.entries, data.weights, data.glucose]);

  const [busy, setBusy] = useState(false);

  /** " · sugar 98" (the day's average when there are several readings). */
  const glucoseLabel = (date: string) => {
    const avg = glucoseAverage(data.glucose[date]);
    if (avg === null) return '';
    const n = data.glucose[date].length;
    return ` · sugar ${glucoseIn(avg, data.glucoseUnit)}${n > 1 ? ' avg' : ''}`;
  };

  const doExport = async () => {
    setBusy(true);
    try {
      await exportBackup(data);
    } catch (e) {
      Alert.alert('Backup failed', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const doSave = async () => {
    setBusy(true);
    try {
      const folder = await saveBackupToFolder(data);
      if (folder) Alert.alert('Backup saved', `Saved to “${folder}”. Pick it from there with “Restore from file”.`);
    } catch (e) {
      Alert.alert('Backup failed', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const doRestore = async () => {
    let restored: Data | null;
    try {
      restored = await pickBackup();
    } catch (e) {
      Alert.alert('Restore failed', e instanceof Error ? e.message : String(e));
      return;
    }
    if (!restored) return;
    const days = new Set(restored.entries.map((e) => e.date)).size;
    Alert.alert(
      'Restore backup?',
      `This replaces everything in the app with the backup (${restored.entries.length} foods over ${days} days). This can't be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Restore', style: 'destructive', onPress: () => onRestore(restored) },
      ],
    );
  };

  const last7 = useMemo(() => {
    const today = todayKey();
    const start = addDays(today, -6);
    const recent = rows.filter((r) => r.count > 0 && r.date >= start && r.date <= today);
    if (recent.length === 0) return null;
    return Math.round(recent.reduce((sum, r) => sum + r.kcal, 0) / recent.length);
  }, [rows]);

  return (
    <FlatList
      data={rows}
      keyExtractor={(r) => r.date}
      contentContainerStyle={{ padding: 12, paddingBottom: insets.bottom + 24 }}
      ListHeaderComponent={
        last7 !== null ? (
          <View style={[s.card, s.totalRow, { marginHorizontal: 0, marginTop: 0 }]}>
            <Text style={s.goalText}>7-day average</Text>
            <View style={s.totalLine}>
              <Text style={s.bigNumber}>{last7.toLocaleString()}</Text>
              <Text style={s.kcalUnit}>kcal/day</Text>
            </View>
          </View>
        ) : undefined
      }
      ListEmptyComponent={<Text style={s.empty}>No days logged yet.</Text>}
      ListFooterComponent={
        <View style={s.backup}>
          <Text style={s.backupTitle}>Backup</Text>
          <Text style={s.goalText}>
            Your data is stored only on this phone. Save a backup now and then: to a folder on the phone (e.g.
            Download), or share it to Google Drive or email.
          </Text>
          <View style={s.backupButtons}>
            {Platform.OS === 'android' && (
              <Pressable
                onPress={doSave}
                disabled={busy}
                style={({ pressed }) => [s.backupBtn, pressed && { opacity: 0.6 }]}
              >
                <Text style={s.backupBtnText}>Save to phone</Text>
              </Pressable>
            )}
            <Pressable
              onPress={doExport}
              disabled={busy}
              style={({ pressed }) => [s.backupBtn, pressed && { opacity: 0.6 }]}
            >
              <Text style={s.backupBtnText}>Share…</Text>
            </Pressable>
          </View>
          <Pressable onPress={doRestore} style={({ pressed }) => [s.backupBtn, pressed && { opacity: 0.6 }]}>
            <Text style={s.backupBtnText}>Restore from file</Text>
          </Pressable>
          <AppVersion />
        </View>
      }
      renderItem={({ item }) => {
        const over = item.kcal > data.goal;
        return (
          <Pressable
            onPress={() => onPickDay(item.date)}
            style={({ pressed }) => [s.histRow, pressed && { opacity: 0.6 }]}
          >
            <Text style={s.entryName} numberOfLines={1}>
              {formatDay(item.date)}
              <Text style={s.entryMeta}>
                {'  '}
                {item.count} item{item.count === 1 ? '' : 's'}
                {data.weights[item.date] !== undefined && ` · ${data.weights[item.date]} ${data.weightUnit}`}
                {glucoseLabel(item.date)}
              </Text>
            </Text>
            {cols.map((c) => (
              <Text
                key={c.key}
                style={[
                  c.key === 'kcal' ? s.entryKcal : s.entryCarbs,
                  s[c.width],
                  c.key === 'kcal' && over && { color: t.over },
                ]}
              >
                {c.fmt(item)}
              </Text>
            ))}
          </Pressable>
        );
      }}
    />
  );
}

function WeightModal({
  visible,
  dayLabel,
  weight,
  goal,
  unit,
  onClose,
  onSave,
}: {
  visible: boolean;
  dayLabel: string;
  weight: number | undefined;
  goal: number | undefined;
  unit: WeightUnit;
  onClose: () => void;
  /** null weight removes the day's weight; null goal clears the goal. */
  onSave: (weight: number | null, goal: number | null, unit: WeightUnit) => void;
}) {
  const t = useTheme();
  const s = useMemo(() => styles(t), [t]);
  const [text, setText] = useState('');
  const [goalText, setGoalText] = useState('');
  const [u, setU] = useState<WeightUnit>(unit);

  useEffect(() => {
    if (visible) {
      setText(weight === undefined ? '' : String(weight));
      setGoalText(goal === undefined ? '' : String(goal));
      setU(unit);
    }
  }, [visible, weight, goal, unit]);

  const toWeight = (str: string) => Math.round(parseNumber(str) * 10) / 10;
  const n = toWeight(text);
  const g = toWeight(goalText);
  const goalValue = g > 0 ? g : null;
  const goalOk = goalText.trim() === '' || g > 0;
  const valid = (n > 0 || text.trim() === '') && goalOk;
  const weightValue = n > 0 ? n : null;
  const save = () => valid && onSave(weightValue, goalValue, u);
  const switchUnit = (next: WeightUnit) => {
    if (next === u) return;
    if (n > 0) setText(String(convertWeights({ x: n }, u, next).x));
    if (g > 0) setGoalText(String(convertWeights({ x: g }, u, next).x));
    setU(next);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.centerBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={s.dialog}>
          <Text style={s.dialogTitle}>Weight · {dayLabel}</Text>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <TextInput
              style={[s.dialogInput, { flex: 1 }]}
              value={text}
              onChangeText={setText}
              keyboardType="decimal-pad"
              placeholder={u}
              placeholderTextColor={t.muted}
              autoFocus
              selectTextOnFocus
              onSubmitEditing={save}
            />
            <View style={s.tabs}>
              {(['lb', 'kg'] as WeightUnit[]).map((k) => (
                <Pressable key={k} onPress={() => switchUnit(k)} style={[s.tab, u === k && s.tabActive]}>
                  <Text style={[s.tabText, u === k && s.tabTextActive]}>{k}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <Text style={[s.goalText, { marginTop: 14, marginBottom: 6 }]}>Goal weight</Text>
          <TextInput
            style={s.dialogInput}
            value={goalText}
            onChangeText={setGoalText}
            keyboardType="decimal-pad"
            placeholder="optional"
            placeholderTextColor={t.muted}
            selectTextOnFocus
            onSubmitEditing={save}
          />
          <View style={s.dialogButtons}>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={[s.dialogBtn, { color: t.muted }]}>Cancel</Text>
            </Pressable>
            <Pressable onPress={save} disabled={!valid} hitSlop={8}>
              <Text style={[s.dialogBtn, { color: t.accent }, !valid && { opacity: 0.4 }]}>Save</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function GoalModal({
  visible,
  title,
  goal,
  onClose,
  onSave,
}: {
  visible: boolean;
  title: string;
  goal: number | undefined;
  onClose: () => void;
  onSave: (goal: number) => void;
}) {
  const t = useTheme();
  const s = useMemo(() => styles(t), [t]);
  const [text, setText] = useState(goal === undefined ? '' : String(goal));

  useEffect(() => {
    if (visible) setText(goal === undefined ? '' : String(goal));
  }, [visible, goal]);

  const n = Math.round(parseNumber(text));
  const valid = n > 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.centerBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={s.dialog}>
          <Text style={s.dialogTitle}>{title}</Text>
          <TextInput
            style={s.dialogInput}
            value={text}
            onChangeText={setText}
            keyboardType="number-pad"
            autoFocus
            selectTextOnFocus
            onSubmitEditing={() => valid && onSave(n)}
          />
          <View style={s.dialogButtons}>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={[s.dialogBtn, { color: t.muted }]}>Cancel</Text>
            </Pressable>
            <Pressable onPress={() => valid && onSave(n)} disabled={!valid} hitSlop={8}>
              <Text style={[s.dialogBtn, { color: t.accent }, !valid && { opacity: 0.4 }]}>Save</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingTop: 6,
      paddingBottom: 4,
      gap: 8,
      minHeight: 44,
    },
    tabs: { flexDirection: 'row', backgroundColor: t.chip, borderRadius: 9, padding: 2 },
    gear: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
    gearText: { fontSize: 20, color: t.muted },
    tab: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 7 },
    tabActive: { backgroundColor: t.card },
    tabText: { color: t.muted, fontSize: 13, fontWeight: '600' },
    tabTextActive: { color: t.text },
    dateRow: { flex: 1, flexDirection: 'row', alignItems: 'center' },
    arrow: { width: 32, height: 36, alignItems: 'center', justifyContent: 'center' },
    arrowText: { fontSize: 28, color: t.text, lineHeight: 32 },
    dateBtn: { flexShrink: 1, alignItems: 'center', minWidth: 90 },
    dateText: { fontSize: 18, fontWeight: '700', color: t.text, textAlign: 'center' },
    backToday: { fontSize: 11, color: t.accent, textAlign: 'center' },
    card: {
      backgroundColor: t.card,
      marginHorizontal: 12,
      marginTop: 4,
      marginBottom: 6,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    statGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingVertical: 6, rowGap: 2 },
    statCell: { width: '50%', paddingVertical: 3 },
    statText: { fontSize: 15, color: t.text, fontVariant: ['tabular-nums'] },
    statLabel: { fontSize: 13, color: t.muted, fontWeight: '600' },
    statValue: { fontSize: 16, fontWeight: '800', color: t.text },
    statGoal: { fontSize: 13, color: t.muted, fontWeight: '600' },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    totalLine: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
    bigNumber: { fontSize: 28, fontWeight: '800', color: t.text, fontVariant: ['tabular-nums'] },
    kcalUnit: { fontSize: 14, color: t.muted, fontWeight: '600' },
    track: { height: 6, borderRadius: 3, backgroundColor: t.track, marginTop: 8, overflow: 'hidden' },
    fill: { height: '100%', borderRadius: 3 },
    remaining: { fontSize: 14, color: t.text, fontWeight: '700', fontVariant: ['tabular-nums'] },
    goalText: { fontSize: 12, color: t.muted },
    empty: { textAlign: 'center', color: t.muted, fontSize: 14, marginTop: 16 },
    mealHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingLeft: 2,
      paddingRight: 10,
      paddingTop: 6,
      paddingBottom: 2,
      gap: 8,
    },
    mealToggle: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
    mealChevron: { width: 12, fontSize: 12, color: t.muted, textAlign: 'center' },
    mealCount: { fontSize: 11, fontWeight: '500', color: t.muted, textTransform: 'none', letterSpacing: 0 },
    mealTitle: {
      flex: 1,
      fontSize: 12,
      fontWeight: '700',
      color: t.muted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    mealTotal: { fontSize: 12, fontWeight: '700', color: t.muted, fontVariant: ['tabular-nums'] },
    colKcal: { width: 38, textAlign: 'right' },
    colCarbs: { width: 40, textAlign: 'right' },
    colNa: { width: 42, textAlign: 'right' },
    colHeader: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 8,
      paddingRight: 12 + 10,
      paddingTop: 2,
      paddingBottom: 2,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.border,
    },
    colHeaderText: { fontSize: 11, color: t.muted, fontWeight: '600' },
    carbsTotal: { fontSize: 18, fontWeight: '700', color: t.text, fontVariant: ['tabular-nums'] },
    entryCarbs: { fontSize: 13, color: t.muted, fontVariant: ['tabular-nums'] },
    mealAdd: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: t.chip,
      alignItems: 'center',
      justifyContent: 'center',
    },
    mealAddText: { color: t.accent, fontSize: 14, fontWeight: '700', lineHeight: 16 },
    entry: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: t.card,
      paddingLeft: 10,
      paddingRight: 10,
      paddingVertical: 5,
      gap: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.border,
    },
    entryFirst: { borderTopLeftRadius: 12, borderTopRightRadius: 12, borderTopWidth: 0 },
    entryLast: { borderBottomLeftRadius: 12, borderBottomRightRadius: 12 },
    entryName: { flex: 1, fontSize: 14, color: t.text, fontWeight: '500' },
    entryMeta: { fontSize: 13, color: t.muted, fontWeight: '400' },
    entryKcal: { fontSize: 14, color: t.text, fontWeight: '700', fontVariant: ['tabular-nums'] },
    backup: { backgroundColor: t.card, borderRadius: 12, padding: 12, marginTop: 16, gap: 6 },
    backupTitle: { fontSize: 14, fontWeight: '700', color: t.text },
    backupButtons: { flexDirection: 'row', gap: 8, marginTop: 4 },
    backupBtn: { flex: 1, backgroundColor: t.chip, borderRadius: 10, paddingVertical: 9, alignItems: 'center' },
    backupBtnText: { color: t.accent, fontSize: 14, fontWeight: '700' },
    histRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: t.card,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 7,
      marginBottom: 3,
      gap: 8,
    },
    fab: {
      position: 'absolute',
      alignSelf: 'center',
      backgroundColor: t.accent,
      borderRadius: 999,
      paddingHorizontal: 20,
      paddingVertical: 11,
      shadowColor: '#000',
      shadowOpacity: 0.2,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
      elevation: 4,
    },
    fabText: { color: t.accentText, fontSize: 15, fontWeight: '700' },
    centerBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'center',
      padding: 32,
    },
    dialog: { backgroundColor: t.card, borderRadius: 18, padding: 20 },
    dialogTitle: { fontSize: 18, fontWeight: '700', color: t.text, marginBottom: 12 },
    dialogInput: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 20,
      color: t.text,
      backgroundColor: t.bg,
    },
    dialogButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 28, marginTop: 18 },
    dialogBtn: { fontSize: 16, fontWeight: '700' },
  });
