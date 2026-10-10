import crypto from "crypto";

// Чтение таблиц отделов продаж через сервисный аккаунт Google.
// Ключ — JSON целиком в GOOGLE_SERVICE_ACCOUNT_JSON (только в Vercel).
// Токен подписываем сами (RS256), без лишних библиотек.
// Только на сервере: ключ никогда не должен попасть в браузер.

const SCOPES = [
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/spreadsheets.readonly",
].join(" ");

let creds = null;
let token = { value: null, exp: 0 };

export function hasGoogleKey() {
  return !!process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
}

function getCreds() {
  if (creds) return creds;
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("Не задан ключ Google (GOOGLE_SERVICE_ACCOUNT_JSON)");
  const parsed = JSON.parse(raw);
  creds = {
    email: parsed.client_email,
    key: String(parsed.private_key).replace(/\\n/g, "\n"),
  };
  return creds;
}

const b64url = (v) =>
  Buffer.from(typeof v === "string" ? v : JSON.stringify(v)).toString("base64url");

async function accessToken() {
  if (token.value && Date.now() < token.exp - 60000) return token.value;
  const { email, key } = getCreds();
  const now = Math.floor(Date.now() / 1000);
  const unsigned =
    b64url({ alg: "RS256", typ: "JWT" }) +
    "." +
    b64url({
      iss: email,
      scope: SCOPES,
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    });
  const signature = crypto.createSign("RSA-SHA256").update(unsigned).sign(key, "base64url");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: unsigned + "." + signature,
    }),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new Error("Google не выдал доступ: " + (data.error_description || data.error || res.status));
  }
  token = { value: data.access_token, exp: Date.now() + (data.expires_in || 3600) * 1000 };
  return token.value;
}

async function gget(url) {
  const res = await fetch(url, {
    headers: { Authorization: "Bearer " + (await accessToken()) },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Google ответил ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

// Таблицы отдела: из папки (folderId) или по поиску названий (nameQuery).
export async function listSpreadsheets({ folderId, nameQuery }) {
  const parts = ["mimeType = 'application/vnd.google-apps.spreadsheet'", "trashed = false"];
  if (folderId) parts.push(`'${folderId.replace(/'/g, "\\'")}' in parents`);
  if (nameQuery) parts.push(`(${nameQuery})`);
  const url =
    "https://www.googleapis.com/drive/v3/files?" +
    new URLSearchParams({
      q: parts.join(" and "),
      fields: "files(id,name,modifiedTime)",
      pageSize: "100",
      orderBy: "modifiedTime desc",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
    });
  const data = await gget(url);
  return data.files || [];
}

// Все листы таблицы как { sheetNames, sheets: { имя: строки[][] } }.
// Даты приходят числами (как в Excel) — так они не съезжают из-за часового пояса.
export async function readSpreadsheet(id) {
  const meta = await gget(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(id)}?fields=properties.title,sheets.properties.title`
  );
  const title = meta.properties?.title || id;
  const sheetNames = (meta.sheets || []).map((s) => s.properties.title);
  if (!sheetNames.length) return { title, sheetNames, sheets: {} };
  const params = new URLSearchParams({
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "SERIAL_NUMBER",
  });
  sheetNames.forEach((n) => params.append("ranges", `'${n.replace(/'/g, "''")}'`));
  const data = await gget(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(id)}/values:batchGet?${params}`
  );
  const sheets = {};
  (data.valueRanges || []).forEach((vr, i) => {
    sheets[sheetNames[i]] = vr.values || [];
  });
  return { title, sheetNames, sheets };
}
