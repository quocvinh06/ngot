import { db } from '@/lib/db';
import { sheetSyncLogs } from '@/lib/db/schema';

type Entity = 'order' | 'menu_item' | 'material' | 'customer' | 'expense';
type Action = 'create' | 'update' | 'delete';

const ENTITY_TAB: Record<Entity, string> = {
  order: 'Orders',
  menu_item: 'MenuItems',
  material: 'Materials',
  customer: 'Customers',
  expense: 'Expenses',
};

let cachedDoc: import('google-spreadsheet').GoogleSpreadsheet | null = null;
let initFailed = false;

async function getDoc(): Promise<import('google-spreadsheet').GoogleSpreadsheet | null> {
  if (cachedDoc || initFailed) return cachedDoc;
  const sheetId = process.env.GOOGLE_SHEETS_ID;
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.replace(/\\n/g, '\n');
  if (!sheetId || !email || !key) {
    initFailed = true;
    return null;
  }
  try {
    const { GoogleSpreadsheet } = await import('google-spreadsheet');
    const { JWT } = await import('google-auth-library');
    const jwt = new JWT({
      email,
      key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const doc = new GoogleSpreadsheet(sheetId, jwt);
    await doc.loadInfo();
    cachedDoc = doc;
    return doc;
  } catch (err) {
    console.error('sheets: init failed', err);
    initFailed = true;
    return null;
  }
}

export async function mirrorToSheet(
  entity: Entity,
  action: Action,
  entityId: number,
  row: Record<string, string | number | null | undefined>,
): Promise<{ ok: boolean; error?: string }> {
  const tab = ENTITY_TAB[entity];
  const doc = await getDoc();
  if (!doc) {
    await db.insert(sheetSyncLogs).values({
      entity,
      entityId,
      action,
      sheetTab: tab,
      succeeded: false,
      errorMsg: 'env not configured',
    });
    return { ok: false, error: 'env not configured' };
  }
  try {
    let sheet = doc.sheetsByTitle[tab];
    if (!sheet) {
      sheet = await doc.addSheet({ title: tab, headerValues: ['id', 'action', ...Object.keys(row), 'synced_at'] });
    }
    const added = await sheet.addRow({
      id: String(entityId),
      action,
      ...Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v == null ? '' : String(v)])),
      synced_at: new Date().toISOString(),
    });
    await db.insert(sheetSyncLogs).values({
      entity,
      entityId,
      action,
      sheetTab: tab,
      rowIndex: added.rowNumber,
      succeeded: true,
    });
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db.insert(sheetSyncLogs).values({
      entity,
      entityId,
      action,
      sheetTab: tab,
      succeeded: false,
      errorMsg: msg.slice(0, 300),
    });
    return { ok: false, error: msg };
  }
}
