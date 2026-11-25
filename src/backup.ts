import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { todayKey } from './dates';
import { Data, parseData } from './storage';

const APP = 'caloriecounter';

/** Writes all data to a JSON file and opens the share sheet (Google Drive, email, Files...). */
export async function exportBackup(data: Data): Promise<void> {
  const file = new File(Paths.cache, `calorie-counter-backup-${todayKey()}.json`);
  file.create({ overwrite: true });
  await file.write(JSON.stringify({ app: APP, version: 1, exportedAt: new Date().toISOString(), data }));
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    dialogTitle: 'Save calorie counter backup',
  });
}

/** Lets the user pick a backup file. Returns null if they cancel. Throws if the file isn't a backup. */
export async function pickBackup(): Promise<Data | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain', 'application/octet-stream'],
    copyToCacheDirectory: true,
  });
  if (res.canceled || !res.assets?.length) return null;
  let json: { app?: string; data?: Partial<Data> };
  try {
    json = JSON.parse(await new File(res.assets[0].uri).text());
  } catch {
    throw new Error('That file could not be read as a backup.');
  }
  if (json?.app !== APP || typeof json.data !== 'object' || json.data === null) {
    throw new Error('That file is not a Calorie Counter backup.');
  }
  return parseData(json.data);
}
