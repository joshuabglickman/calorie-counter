import * as Updates from 'expo-updates';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Theme, useTheme } from './theme';

function stamp(d: Date | null): string {
  if (!d) return '';
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/** Shows which version is running and lets the user check for an update right away. */
export function AppVersion() {
  const t = useTheme();
  const s = useMemo(() => styles(t), [t]);
  const [status, setStatus] = useState<string | null>(null);

  if (!Updates.isEnabled) {
    return <Text style={s.text}>Development version (updates come from the PC)</Text>;
  }

  const running = Updates.isEmbeddedLaunch
    ? `installed version (${stamp(Updates.createdAt)})`
    : `update from ${stamp(Updates.createdAt)}`;

  const check = async () => {
    setStatus('Checking…');
    try {
      const res = await Updates.checkForUpdateAsync();
      if (!res.isAvailable) {
        setStatus('You have the latest version.');
        return;
      }
      setStatus('Downloading update…');
      await Updates.fetchUpdateAsync();
      setStatus('Restarting…');
      await Updates.reloadAsync();
    } catch (e) {
      setStatus(`Update failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <View style={s.row}>
      <Text style={[s.text, { flex: 1 }]}>
        Running: {running}
        {status ? `\n${status}` : ''}
      </Text>
      <Pressable onPress={check} hitSlop={8}>
        <Text style={s.link}>Check for updates</Text>
      </Pressable>
    </View>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, paddingHorizontal: 4 },
    text: { fontSize: 11, color: t.muted },
    link: { fontSize: 12, color: t.accent, fontWeight: '600' },
  });
