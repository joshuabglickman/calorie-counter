import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { todayKey } from './dates';
import { Data, parseData } from './storage';

const APP = 'caloriecounter';

function backupName(): string {
  return `calorie-counter-backup-${todayKey()}.json`;
}

function backupJson(data: Data): string {
  return JSON.stringify({ app: APP, version: 1, exportedAt: new Date().toISOString(), data });
}

/**
 * Lets the user pick a folder on the phone (e.g. Download) and saves the backup there.
 * Returns the folder name, or null if they cancel.
 */
export async function saveBackupToFolder(data: Data): Promise<string | null> {
  let dir: Directory;
  try {
    dir = await Directory.pickDirectoryAsync();
  } catch {
    return null; // picker closed
  }
  const file = dir.createFile(backupName(), 'application/json');
  await file.write(backupJson(data));
  return decodeURIComponent(dir.name).split(/[:/]/).pop() || 'the folder you picked';
}

/** Writes all data to a JSON file and opens the share sheet (Google Drive, email, Files...). */
export async function exportBackup(data: Data): Promise<void> {
  const file = new File(Paths.cache, backupName());
  file.create({ overwrite: true });
  await file.write(backupJson(data));
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    dialogTitle: 'Save calorie counter backup',
  });
}

/** Lets the user pick a backup file. Returns null if they cancel. Throws if the file isn't a backup. */
export async function pickBackup(): Promise<Data | null> {
  const res = await DocumentPicker.getDocumentAsync({
    // Android often doesn't label .json files as JSON (Drive, Downloads), so show every file
    // and check the contents instead.
    type: '*/*',
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
