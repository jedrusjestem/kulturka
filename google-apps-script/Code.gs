/**
 * Kulturka – synchronizacja z Google Drive / Docs / Sheets
 * ---------------------------------------------------------
 * Działa na KONCIE GOOGLE KOMISJI (nie prywatnym). Co 5 minut:
 *   1. tworzy agendy (Google Docs) dla nowych spotkań,
 *   2. tworzy/aktualizuje arkusz obecności każdego zmienionego spotkania,
 *   3. odświeża zbiorczy arkusz „Frekwencja – KKiP”,
 *   4. przy okazji „budzi” bazę Supabase (darmowy plan usypia ją po 7 dniach bez ruchu).
 *
 * Źródłem prawdy jest baza (Supabase). Arkusze są lustrem – ręczne zmiany w arkuszu
 * zostaną nadpisane przy następnej synchronizacji. Obecność zmieniaj w aplikacji.
 *
 * Konfiguracja: Project Settings → Script Properties:
 *   SUPABASE_URL          = https://xxxx.supabase.co
 *   SUPABASE_SERVICE_KEY  = klucz "service_role" (albo nowy "secret key") – NIGDY nie wklejaj go do aplikacji ani repozytorium!
 * Następnie uruchom raz funkcję setup().
 */

const TZ = 'Europe/Warsaw';
const BRAND = '#7DC9EE';

// ---------------------------------------------------------------------------
//  Wejścia
// ---------------------------------------------------------------------------

/** Uruchom RAZ ręcznie: instaluje wyzwalacz co 5 minut i robi pierwszą synchronizację. */
function setup() {
  ScriptApp.getProjectTriggers().forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('sync').timeBased().everyMinutes(5).create();
  sync();
  Logger.log('Gotowe. Wyzwalacz co 5 minut zainstalowany.');
}

/** Web app: przycisk „Synchronizuj teraz” w aplikacji wywołuje ?action=sync */
function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || '';
  if (action === 'sync') {
    const cache = CacheService.getScriptCache();
    if (!cache.get('recent-sync')) {
      cache.put('recent-sync', '1', 20); // max raz na 20 s
      try {
        sync();
      } catch (err) {
        console.error(err);
      }
    }
    return ContentService.createTextOutput('ok');
  }
  return ContentService.createTextOutput('Kulturka sync – działa');
}

// ---------------------------------------------------------------------------
//  Synchronizacja
// ---------------------------------------------------------------------------
function sync() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) return;
  try {
    const settings = (sb('GET', 'app_settings?id=eq.1&select=*') || [])[0] || {};
    if (!settings.drive_folder_id) {
      console.log('Brak folderu Google Drive w ustawieniach aplikacji – tylko keep-alive.');
      return;
    }
    const folder = DriveApp.getFolderById(settings.drive_folder_id);
    const since = new Date(Date.now() - 120 * 864e5).toISOString();
    const meetings = sb('GET', 'meetings?select=*&order=starts_at&starts_at=gte.' + encodeURIComponent(since)) || [];
    const todo = meetings.filter((m) => m.dirty || (m.auto_agenda && !m.agenda_url));
    if (!todo.length) return;

    const people = sb('GET', "profiles?select=id,full_name,email,role&order=full_name") || [];
    let anyAttendanceChange = false;

    todo.forEach((m) => {
      const patch = {};
      if (m.auto_agenda && !m.agenda_url) {
        patch.agenda_url = createAgenda(m, folder, settings.agenda_template_id);
      }
      if (m.dirty) {
        const att = sb('GET', 'attendance?select=*&meeting_id=eq.' + m.id) || [];
        patch.sheet_url = writeAttendanceSheet(m, folder, people, att);
        anyAttendanceChange = true;
      }
      patch.dirty = false;
      patch.synced_at = new Date().toISOString();
      sb('PATCH', 'meetings?id=eq.' + m.id, patch);
    });

    if (anyAttendanceChange) writeSummary(folder, people);
  } finally {
    lock.releaseLock();
  }
}

// ---------------------------------------------------------------------------
//  Agenda (Google Docs)
// ---------------------------------------------------------------------------
function createAgenda(m, folder, templateId) {
  const start = new Date(m.starts_at);
  const dateStr = Utilities.formatDate(start, TZ, 'dd.MM.yyyy');
  const timeStr = Utilities.formatDate(start, TZ, 'HH:mm');
  const name = 'Agenda – ' + Utilities.formatDate(start, TZ, 'yyyy-MM-dd') + ' – ' + m.title;
  let doc;

  if (templateId) {
    const copy = DriveApp.getFileById(templateId).makeCopy(name, folder);
    doc = DocumentApp.openById(copy.getId());
    const body = doc.getBody();
    body.replaceText('\\{\\{TYTUL\\}\\}', m.title);
    body.replaceText('\\{\\{DATA\\}\\}', dateStr);
    body.replaceText('\\{\\{GODZINA\\}\\}', timeStr);
    body.replaceText('\\{\\{MIEJSCE\\}\\}', m.location || '—');
    body.replaceText('\\{\\{OPIS\\}\\}', m.description || '');
  } else {
    doc = DocumentApp.create(name);
    DriveApp.getFileById(doc.getId()).moveTo(folder);
    const body = doc.getBody();
    body.clear();
    const h = body.appendParagraph(m.title);
    h.setHeading(DocumentApp.ParagraphHeading.TITLE);
    body.appendParagraph('Komisja Kultury i Projektów · Samorząd Studencki PWr').setHeading(DocumentApp.ParagraphHeading.SUBTITLE);
    body.appendParagraph('📅 ' + dateStr + ', godz. ' + timeStr + (m.location ? '   📍 ' + m.location : ''));
    if (m.description) body.appendParagraph(m.description);
    body.appendParagraph('Agenda').setHeading(DocumentApp.ParagraphHeading.HEADING1);
    ['Przywitanie i sprawdzenie obecności', 'Sprawy bieżące i projekty', 'Podział zadań', 'Wolne wnioski'].forEach((t) =>
      body.appendListItem(t).setGlyphType(DocumentApp.GlyphType.NUMBER)
    );
    body.appendParagraph('Notatki ze spotkania').setHeading(DocumentApp.ParagraphHeading.HEADING1);
    body.appendParagraph('');
    body.appendParagraph('Ustalenia / zadania').setHeading(DocumentApp.ParagraphHeading.HEADING1);
    const t = body.appendTable([['Zadanie', 'Osoba', 'Termin'], ['', '', '']]);
    t.getRow(0).editAsText().setBold(true);
    t.getRow(0).getCell(0).setBackgroundColor(BRAND);
    t.getRow(0).getCell(1).setBackgroundColor(BRAND);
    t.getRow(0).getCell(2).setBackgroundColor(BRAND);
    // pierwszy pusty akapit, który tworzy DocumentApp
    const first = body.getChild(0);
    if (first.getType() === DocumentApp.ElementType.PARAGRAPH && first.asParagraph().getText() === '' && body.getNumChildren() > 1) {
      first.removeFromParent();
    }
  }
  doc.saveAndClose();
  return doc.getUrl();
}

// ---------------------------------------------------------------------------
//  Lista obecności (Google Sheets) – jeden plik na spotkanie
// ---------------------------------------------------------------------------
function writeAttendanceSheet(m, folder, people, att) {
  const start = new Date(m.starts_at);
  const name = 'Obecność – ' + Utilities.formatDate(start, TZ, 'yyyy-MM-dd') + ' – ' + m.title;
  let ss;
  if (m.sheet_url) {
    try {
      ss = SpreadsheetApp.openByUrl(m.sheet_url);
    } catch (e) {
      ss = null;
    }
  }
  if (!ss) {
    ss = SpreadsheetApp.create(name);
    DriveApp.getFileById(ss.getId()).moveTo(folder);
  } else if (ss.getName() !== name) {
    ss.rename(name);
  }

  const sh = ss.getSheets()[0];
  sh.setName('Obecność');
  sh.clear();
  sh.clearConditionalFormatRules();

  const attMap = {};
  att.forEach((a) => (attMap[a.user_id] = a));
  const active = people.filter((p) => ['member', 'board', 'chair'].indexOf(p.role) >= 0);
  // osoby, które mają wpis obecności, ale nie są już aktywne – też pokazujemy
  const extra = people.filter((p) => attMap[p.id] && active.indexOf(p) < 0);
  const list = active.concat(extra);

  const rows = list.map((p, i) => {
    const a = attMap[p.id];
    return [
      i + 1,
      safe(p.full_name),
      safe(p.email),
      a ? (a.present ? '✓ obecny' : '✗ nieobecny') : '—',
      a ? (a.method === 'qr' ? 'kod QR' : 'ręcznie') : '',
      a ? Utilities.formatDate(new Date(a.marked_at), TZ, 'HH:mm') : '',
    ];
  });
  const present = list.filter((p) => attMap[p.id] && attMap[p.id].present).length;

  sh.getRange(1, 1).setValue(m.title).setFontSize(16).setFontWeight('bold');
  sh.getRange(2, 1).setValue(
    Utilities.formatDate(start, TZ, 'dd.MM.yyyy, HH:mm') + (m.location ? '  ·  ' + m.location : '') + '  ·  obecnych: ' + present + '/' + list.length
  );
  sh.getRange(3, 1).setValue('Arkusz generowany automatycznie przez aplikację Kulturka – zmiany wprowadzaj w aplikacji.').setFontColor('#6b7f90').setFontStyle('italic');

  const header = [['Lp.', 'Imię i nazwisko', 'E-mail', 'Obecność', 'Sposób', 'Godzina']];
  sh.getRange(5, 1, 1, 6).setValues(header).setFontWeight('bold').setBackground(BRAND).setFontColor('#ffffff');
  if (rows.length) sh.getRange(6, 1, rows.length, 6).setValues(rows);
  sh.setFrozenRows(5);
  sh.autoResizeColumns(1, 6);
  sh.setColumnWidth(2, Math.max(sh.getColumnWidth(2), 200));

  if (rows.length) {
    const range = sh.getRange(6, 4, rows.length, 1);
    sh.setConditionalFormatRules([
      SpreadsheetApp.newConditionalFormatRule().whenTextStartsWith('✓').setBackground('#e8f8ee').setFontColor('#166534').setRanges([range]).build(),
      SpreadsheetApp.newConditionalFormatRule().whenTextStartsWith('✗').setBackground('#fdecec').setFontColor('#991b1b').setRanges([range]).build(),
    ]);
  }
  return ss.getUrl();
}

// ---------------------------------------------------------------------------
//  Zbiorcza frekwencja (jeden plik na cały folder)
// ---------------------------------------------------------------------------
function writeSummary(folder, people) {
  const props = PropertiesService.getScriptProperties();
  const key = 'SUMMARY_ID_' + folder.getId();
  let ss = null;
  const id = props.getProperty(key);
  if (id) {
    try {
      ss = SpreadsheetApp.openById(id);
    } catch (e) {
      ss = null;
    }
  }
  if (!ss) {
    ss = SpreadsheetApp.create('Frekwencja – Komisja Kultury i Projektów');
    DriveApp.getFileById(ss.getId()).moveTo(folder);
    props.setProperty(key, ss.getId());
  }
  const meetings = (sb('GET', 'meetings?select=id,title,starts_at&order=starts_at&starts_at=lt.' + encodeURIComponent(new Date().toISOString())) || []);
  const att = sb('GET', 'attendance?select=meeting_id,user_id,present') || [];
  const map = {};
  att.forEach((a) => (map[a.meeting_id + '|' + a.user_id] = a.present));
  const active = people.filter((p) => ['member', 'board', 'chair'].indexOf(p.role) >= 0);

  const header = ['Imię i nazwisko'].concat(meetings.map((m) => Utilities.formatDate(new Date(m.starts_at), TZ, 'dd.MM') + ' ' + m.title), ['Obecności', 'Frekwencja']);
  const rows = active.map((p) => {
    let n = 0;
    const cells = meetings.map((m) => {
      const v = map[m.id + '|' + p.id];
      if (v === true) n++;
      return v === true ? 1 : v === false ? 0 : '';
    });
    return [safe(p.full_name)].concat(cells, [n, meetings.length ? n / meetings.length : 0]);
  });

  const sh = ss.getSheets()[0];
  sh.setName('Frekwencja');
  sh.clear();
  sh.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold').setBackground(BRAND).setFontColor('#ffffff').setWrap(true);
  if (rows.length) {
    sh.getRange(2, 1, rows.length, header.length).setValues(rows);
    sh.getRange(2, header.length, rows.length, 1).setNumberFormat('0%');
  }
  sh.setFrozenRows(1);
  sh.setFrozenColumns(1);
  sh.autoResizeColumn(1);
}

// ---------------------------------------------------------------------------
//  Pomocnicze
// ---------------------------------------------------------------------------
function sb(method, path, body) {
  const p = PropertiesService.getScriptProperties();
  const url = p.getProperty('SUPABASE_URL');
  const key = p.getProperty('SUPABASE_SERVICE_KEY');
  if (!url || !key) throw new Error('Ustaw SUPABASE_URL i SUPABASE_SERVICE_KEY w Script Properties');
  const headers = { apikey: key, 'Content-Type': 'application/json', Prefer: 'return=minimal' };
  if (key.indexOf('eyJ') === 0) headers.Authorization = 'Bearer ' + key; // stary klucz JWT
  const res = UrlFetchApp.fetch(url.replace(/\/$/, '') + '/rest/v1/' + path, {
    method: method,
    headers: headers,
    payload: body ? JSON.stringify(body) : undefined,
    muteHttpExceptions: true,
  });
  const code = res.getResponseCode();
  if (code >= 300) throw new Error('Supabase ' + method + ' ' + path + ' → ' + code + ': ' + res.getContentText());
  const text = res.getContentText();
  return text ? JSON.parse(text) : null;
}

/** Ochrona przed wstrzyknięciem formuł do arkusza (np. imię zaczynające się od "="). */
function safe(v) {
  const s = v == null ? '' : String(v);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}
