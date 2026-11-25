import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputInstance,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { normalize } from './foodDb';
import { FoodOption, findExact, mineOptions, parseQuery, resolve, searchFoods, startUnit } from './foodSearch';
import { OnlineError, searchOnline } from './online';
import {
  calcCalories,
  calcCarbs,
  calcGrams,
  fmtCarbs,
  Entry,
  entryMeal,
  Meal,
  MEALS,
  parseNumber,
  SavedFood,
  Unit,
  unitBasis,
  UNITS,
} from './storage';
import { Theme, useTheme } from './theme';

export type EntryDraft = Pick<Entry, 'name' | 'amount' | 'unit' | 'kcalPer'> & {
  meal: Meal;
  /** Grams of carbs per kcal for this food; null if unknown. */
  carbsPerKcal: number | null;
  proteinPerKcal: number | null;
  sodiumPerKcal: number | null;
  /** Set when the food should be saved to the user's foods (typed calories or online pick). */
  remember: null | {
    units: Record<string, number>;
    countUnit: string | null;
    carbsPerKcal: number | null;
    proteinPerKcal: number | null;
    sodiumPerKcal: number | null;
  };
};

type Props = {
  visible: boolean;
  editing: Entry | null;
  /** Meal to preselect when adding. */
  defaultMeal: Meal;
  foods: Record<string, SavedFood>;
  dayLabel: string;
  onSave: (draft: EntryDraft) => void;
  onDelete: (entry: Entry) => void;
  onClose: () => void;
};

type OnlineState =
  | { status: 'idle' }
  | { status: 'loading'; query: string }
  | { status: 'done'; query: string; results: FoodOption[] }
  | { status: 'error'; query: string; message: string };

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

function perLabel(unit: Unit): string {
  return unitBasis(unit) === 100 ? `100 ${unit}` : unit;
}

function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

const SOURCE_LABEL: Record<FoodOption['source'], string> = {
  mine: 'your food',
  db: 'food list',
  usda: 'USDA',
  online: 'USDA online',
};

export function EntryForm({ visible, editing, defaultMeal, foods, dayLabel, onSave, onDelete, onClose }: Props) {
  const t = useTheme();
  const s = useMemo(() => styles(t), [t]);
  const insets = useSafeAreaInsets();
  const mine = useMemo(() => mineOptions(foods), [foods]);

  const [meal, setMeal] = useState<Meal>(defaultMeal);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('1');
  const [unit, setUnit] = useState<Unit>('serving');
  const [kcalText, setKcalText] = useState('');
  const [manual, setManual] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  /** A food chosen from the suggestions; it sticks while the name field still shows its name. */
  const [picked, setPicked] = useState<FoodOption | null>(null);
  const [online, setOnline] = useState<OnlineState>({ status: 'idle' });
  const lastFood = useRef<string | null>(null);
  const amountRef = useRef<TextInputInstance>(null);
  const kcalRef = useRef<TextInputInstance>(null);

  useEffect(() => {
    if (!visible) return;
    setOnline({ status: 'idle' });
    setPicked(null);
    setMeal(editing ? entryMeal(editing) : defaultMeal);
    if (editing) {
      const f = findExact(editing.name, mine);
      const matchesList = !!f && editing.unit in f.units && Math.abs(f.units[editing.unit] - editing.kcalPer) < 0.5;
      setName(editing.name);
      setAmount(fmt(editing.amount));
      setUnit(editing.unit);
      setKcalText(fmt(editing.kcalPer));
      setManual(!matchesList);
      setShowSuggestions(false);
      lastFood.current = f?.name ?? null;
    } else {
      setName('');
      setAmount('1');
      setUnit('serving');
      setKcalText('');
      setManual(false);
      setShowSuggestions(true);
      lastFood.current = null;
    }
    // Only reset when the sheet opens, not when saved foods change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, editing, defaultMeal]);

  const resolved = useMemo(() => {
    if (picked && picked.name === name) {
      return { food: picked, parsed: { amount: null, unit: null, query: name }, guessed: false };
    }
    return resolve(name, mine);
  }, [name, mine, picked]);
  const { food, parsed, guessed } = resolved;

  const useList = !!food && !manual;
  const unitChoices = useList
    ? Object.keys(food.units)
    : food
      ? [...new Set([...Object.keys(food.units), ...UNITS])]
      : UNITS;
  const effUnit = unitChoices.includes(unit) ? unit : food ? food.defaultUnit : 'serving';

  const query = parsed.query.trim();
  const suggestions = useMemo(() => {
    if (!showSuggestions) return [];
    return searchFoods(query, mine, 6)
      .filter((o) => o.name !== food?.name)
      .slice(0, 5);
  }, [showSuggestions, query, mine, food]);

  const onlineForQuery = online.status !== 'idle' && normalize(online.query) === normalize(query) ? online : null;

  const applyFood = (f: FoodOption | null, p: { amount: number | null; unit: string | null; query: string }) => {
    if ((f?.name ?? null) === lastFood.current) {
      if (p.amount !== null) setAmount(fmt(p.amount));
      if (p.unit) setUnit(p.unit);
      return;
    }
    // A different food was recognized: start from its usual portion.
    lastFood.current = f?.name ?? null;
    setManual(false);
    if (f) {
      setAmount(fmt(p.amount ?? 1));
      setUnit(startUnit(f, p));
    } else {
      if (p.amount !== null) setAmount(fmt(p.amount));
      if (p.unit) setUnit(p.unit);
    }
  };

  const onChangeName = (text: string) => {
    setName(text);
    setShowSuggestions(true);
    const r = picked && picked.name === text ? null : resolve(text, mine);
    if (r) applyFood(r.food, r.parsed);
  };

  const pickFood = (f: FoodOption) => {
    const p = parseQuery(name);
    setPicked(f);
    setName(f.name);
    setManual(false);
    setShowSuggestions(false);
    lastFood.current = f.name;
    setAmount(fmt(p.amount ?? 1));
    setUnit(startUnit(f, p));
    amountRef.current?.focus();
  };

  const runOnline = async () => {
    const q = query;
    setOnline({ status: 'loading', query: q });
    try {
      const results = await searchOnline(q);
      setOnline({ status: 'done', query: q, results });
    } catch (e) {
      setOnline({
        status: 'error',
        query: q,
        message: e instanceof OnlineError ? e.message : 'Online search failed.',
      });
    }
  };

  const startAdjust = () => {
    if (!food) return;
    setKcalText(fmt(food.units[effUnit]));
    setUnit(effUnit);
    setManual(true);
    setTimeout(() => kcalRef.current?.focus(), 50);
  };

  const amountNum = parseNumber(amount);
  const kcalPer = useList ? food.units[effUnit] : parseNumber(kcalText);
  const entryName = food ? food.name : capitalize(query);
  const valid = entryName !== '' && amountNum > 0 && kcalPer >= 0 && !Number.isNaN(kcalPer);
  const total = valid ? calcCalories(amountNum, effUnit, kcalPer) : null;
  const carbsPer = food?.carbsPerKcal ?? null;
  const proteinPer = food?.proteinPerKcal ?? null;
  const sodiumPer = food?.sodiumPerKcal ?? null;
  const totalCarbs = total === null ? undefined : calcCarbs(total, carbsPer);
  const totalProtein = total === null ? undefined : calcGrams(total, proteinPer);
  const totalSodium = total === null ? undefined : calcGrams(total, sodiumPer);

  const submit = () => {
    if (!valid) return;
    let remember: EntryDraft['remember'] = null;
    const per = { carbsPerKcal: carbsPer, proteinPerKcal: proteinPer, sodiumPerKcal: sodiumPer };
    if (!useList) remember = { units: { [effUnit]: kcalPer }, countUnit: null, ...per };
    else if (food.source === 'online') remember = { units: food.units, countUnit: food.countUnit, ...per };
    onSave({
      meal,
      name: entryName,
      amount: amountNum,
      unit: effUnit,
      kcalPer,
      ...per,
      remember,
    });
  };

  const confirmDelete = () => {
    if (!editing) return;
    Alert.alert('Delete entry?', `Remove "${editing.name}" from ${dayLabel.toLowerCase()}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete(editing) },
    ]);
  };

  const foodRow = (f: FoodOption) => (
    <Pressable
      key={`${f.source}:${f.name}`}
      onPress={() => pickFood(f)}
      style={({ pressed }) => [s.suggestion, pressed && { opacity: 0.6 }]}
    >
      <Text style={s.suggestionName} numberOfLines={2}>
        {f.name}
      </Text>
      <Text style={s.suggestionMeta}>
        {Math.round(f.units[f.defaultUnit])} kcal{'\n'}per {perLabel(f.defaultUnit)}
      </Text>
    </Pressable>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[s.sheet, { paddingBottom: insets.bottom + 10 }]}>
          <View style={s.headerRow}>
            <Text style={s.title}>{editing ? 'Edit entry' : `Add to ${dayLabel.toLowerCase()}`}</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={s.link}>Cancel</Text>
            </Pressable>
          </View>

          <View style={s.meals}>
            {MEALS.map((m) => (
              <Pressable key={m.key} onPress={() => setMeal(m.key)} style={[s.meal, meal === m.key && s.mealActive]}>
                <Text style={[s.mealText, meal === m.key && s.mealTextActive]}>{m.label}</Text>
              </Pressable>
            ))}
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 520 }}>
            <Text style={s.label}>What did you eat?</Text>
            <TextInput
              style={s.input}
              value={name}
              onChangeText={onChangeName}
              placeholder="e.g. 2 eggs, brussels sprouts, 150g rice"
              placeholderTextColor={t.muted}
              autoFocus={!editing}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={() => (valid && useList ? submit() : amountRef.current?.focus())}
            />

            {food && (
              <Text style={s.matched}>
                ✓ {food.name} <Text style={s.matchedSource}>· {SOURCE_LABEL[food.source]}</Text>
              </Text>
            )}
            {guessed && suggestions.length > 0 && <Text style={s.hint}>Not right? Pick another below.</Text>}

            {suggestions.length > 0 && <View style={s.suggestions}>{suggestions.map(foodRow)}</View>}

            {showSuggestions && query.length >= 3 && !onlineForQuery && (
              <Pressable onPress={runOnline} style={s.onlineBtn} hitSlop={6}>
                <Text style={s.link}>🔎 Search online for “{query}”</Text>
              </Pressable>
            )}
            {onlineForQuery?.status === 'loading' && <ActivityIndicator style={{ marginTop: 12 }} color={t.accent} />}
            {onlineForQuery?.status === 'error' && <Text style={s.error}>{onlineForQuery.message}</Text>}
            {onlineForQuery?.status === 'done' && showSuggestions && (
              <>
                <Text style={s.label}>Online results (USDA)</Text>
                {onlineForQuery.results.length === 0 ? (
                  <Text style={s.hint}>Nothing found online.</Text>
                ) : (
                  <View style={s.suggestions}>{onlineForQuery.results.map(foodRow)}</View>
                )}
              </>
            )}

            <Text style={s.label}>How much?</Text>
            <View style={s.row}>
              <TextInput
                ref={amountRef}
                style={[s.input, s.amountInput]}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                selectTextOnFocus
                returnKeyType="done"
                onSubmitEditing={() => (useList ? submit() : kcalRef.current?.focus())}
              />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {unitChoices.map((u) => (
                  <Pressable key={u} onPress={() => setUnit(u)} style={[s.chip, effUnit === u && s.chipActive]}>
                    <Text style={[s.chipText, effUnit === u && s.chipTextActive]}>{u}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            {useList ? (
              <View style={s.perRow}>
                <Text style={s.perText}>
                  ≈ {fmt(Math.round(food.units[effUnit] * 10) / 10)} kcal per {perLabel(effUnit)}
                </Text>
                <Pressable onPress={startAdjust} hitSlop={10}>
                  <Text style={s.link}>Adjust</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <View style={s.labelRow}>
                  <Text style={s.label}>Calories per {perLabel(effUnit)}</Text>
                  {food && (
                    <Pressable onPress={() => setManual(false)} hitSlop={10}>
                      <Text style={[s.link, { fontSize: 14 }]}>Use list value</Text>
                    </Pressable>
                  )}
                </View>
                <TextInput
                  ref={kcalRef}
                  style={s.input}
                  value={kcalText}
                  onChangeText={setKcalText}
                  keyboardType="decimal-pad"
                  placeholder="kcal"
                  placeholderTextColor={t.muted}
                  selectTextOnFocus
                  returnKeyType="done"
                  onSubmitEditing={submit}
                />
                {!food && query !== '' && (
                  <Text style={s.hint}>
                    Not found. Try “Search online”, or enter the calories once and they’ll be remembered.
                  </Text>
                )}
              </>
            )}

            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Total</Text>
              <Text style={s.totalValue}>
                {total === null ? '—' : `${useList ? '≈ ' : ''}${total} kcal`}
                {totalCarbs !== undefined && <Text style={s.totalCarbs}>{`  ${fmtCarbs(totalCarbs)}g net carbs`}</Text>}
                {totalProtein !== undefined && <Text style={s.totalCarbs}>{`  ${totalProtein}g protein`}</Text>}
                {totalSodium !== undefined && <Text style={s.totalCarbs}>{`  ${totalSodium}mg sodium`}</Text>}
              </Text>
            </View>
          </ScrollView>

          <Pressable
            onPress={submit}
            disabled={!valid}
            style={({ pressed }) => [s.primary, !valid && { opacity: 0.4 }, pressed && { opacity: 0.8 }]}
          >
            <Text style={s.primaryText}>{editing ? 'Save changes' : 'Add'}</Text>
          </Pressable>

          {editing && (
            <Pressable onPress={confirmDelete} style={s.deleteBtn} hitSlop={8}>
              <Text style={s.deleteText}>Delete entry</Text>
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
    sheet: {
      backgroundColor: t.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 16,
      paddingTop: 12,
    },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    title: { fontSize: 17, fontWeight: '700', color: t.text },
    link: { fontSize: 15, color: t.accent, fontWeight: '600' },
    meals: { flexDirection: 'row', backgroundColor: t.chip, borderRadius: 12, padding: 3, marginTop: 4 },
    meal: { flex: 1, paddingVertical: 6, alignItems: 'center', borderRadius: 10 },
    mealActive: { backgroundColor: t.accent },
    mealText: { color: t.muted, fontSize: 13, fontWeight: '600' },
    mealTextActive: { color: t.accentText },
    label: { fontSize: 13, color: t.muted, marginTop: 10, marginBottom: 4, fontWeight: '500' },
    labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
    input: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontSize: 16,
      color: t.text,
      backgroundColor: t.bg,
    },
    matched: { color: t.accent, fontSize: 14, fontWeight: '600', marginTop: 6 },
    matchedSource: { color: t.muted, fontWeight: '400', fontSize: 13 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    amountInput: { width: 68, textAlign: 'center' },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: t.chip,
      marginRight: 6,
    },
    chipActive: { backgroundColor: t.accent },
    chipText: { color: t.text, fontSize: 14 },
    chipTextActive: { color: t.accentText, fontWeight: '600' },
    suggestions: {
      marginTop: 6,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      overflow: 'hidden',
    },
    suggestion: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.border,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 10,
    },
    suggestionName: { color: t.text, fontSize: 14, flexShrink: 1 },
    suggestionMeta: { color: t.muted, fontSize: 12, textAlign: 'right' },
    onlineBtn: { marginTop: 8, paddingVertical: 2 },
    error: { color: t.danger, fontSize: 14, marginTop: 10 },
    perRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 10,
    },
    perText: { color: t.muted, fontSize: 14, flexShrink: 1 },
    hint: { color: t.muted, fontSize: 13, marginTop: 6, lineHeight: 18 },
    totalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      marginTop: 10,
      marginBottom: 2,
    },
    totalLabel: { fontSize: 15, color: t.muted },
    totalValue: { fontSize: 20, fontWeight: '700', color: t.text, fontVariant: ['tabular-nums'] },
    totalCarbs: { fontSize: 15, fontWeight: '600', color: t.muted },
    primary: {
      backgroundColor: t.accent,
      borderRadius: 12,
      paddingVertical: 11,
      alignItems: 'center',
      marginTop: 8,
    },
    primaryText: { color: t.accentText, fontSize: 16, fontWeight: '700' },
    deleteBtn: { alignItems: 'center', paddingVertical: 10 },
    deleteText: { color: t.danger, fontSize: 15, fontWeight: '600' },
  });
