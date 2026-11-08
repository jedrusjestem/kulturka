/**
 * Kulturka – synchronizacja z Google Drive / Docs / Sheets
 * ---------------------------------------------------------
 * Działa na KONCIE GOOGLE KOMISJI (nie prywatnym). Co 5 minut:
 *   1. tworzy agendy (Google Docs) dla nowych spotkań,
 *   2. tworzy/aktualizuje arkusz obecności każdego zmienionego spotkania,
 *   3. odświeża zbiorczy arkusz „Frekwencja – KKiP”,
 *   4. wysyła powiadomienia e-mail z kolejki (zatwierdzenie konta, ważne ogłoszenia, wydarzenia, przypomnienia),
 *   5. raz w tygodniu robi kopię zapasową bazy (JSON) w podfolderze „Kopie zapasowe”,
 *   6. przy okazji „budzi” bazę Supabase (darmowy plan usypia ją po 7 dniach bez ruchu).
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
  ScriptApp.newTrigger('backup').timeBased().everyWeeks(1).onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(3).create();
  sync();
  Logger.log('Gotowe. Synchronizacja co 5 minut + kopia zapasowa w poniedziałki ok. 3:00.');
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
    try {
      meetingReminders(settings);
      processNotifications(settings);
    } catch (err) {
      console.error('Powiadomienia: ' + err);
    }
    try {
      cleanupStories();
    } catch (err) {
      console.error('Sprzątanie story: ' + err);
    }
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
    const sharing = settings.share_agendas ? loadSharingData() : null;

    todo.forEach((m) => {
      const patch = {};
      if (m.auto_agenda && !m.agenda_url) {
        patch.agenda_url = createAgenda(m, folder, settings.agenda_template_id);
      }
      if (sharing && (patch.agenda_url || m.agenda_url)) {
        shareAgenda(patch.agenda_url || m.agenda_url, agendaEditors(m, people, sharing));
      }
      if (m.dirty) {
        const att = sb('GET', 'attendance?select=*&meeting_id=eq.' + m.id) || [];
        let list = people;
        if (m.event_id) {
          // spotkanie wydarzenia: lista = zespół wydarzenia
          const team = (sb('GET', 'event_members?select=user_id&status=eq.accepted&event_id=eq.' + m.event_id) || []).map((x) => x.user_id);
          list = people.filter((p) => team.indexOf(p.id) >= 0);
        } else {
          anyAttendanceChange = true;
        }
        patch.sheet_url = writeAttendanceSheet(m, folder, list, att);
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
  const meetings = (sb('GET', 'meetings?select=id,title,starts_at&event_id=is.null&order=starts_at&starts_at=lt.' + encodeURIComponent(new Date().toISOString())) || []);
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
//  Powiadomienia e-mail
// ---------------------------------------------------------------------------
function meetingReminders(settings) {
  if (!settings.meeting_reminders) return;
  const now = new Date();
  const in24 = new Date(now.getTime() + 24 * 3600e3);
  const ms =
    sb('GET', 'meetings?select=id,title,starts_at,location,event_id&reminder_sent_at=is.null&and=(starts_at.gt.' +
      encodeURIComponent(now.toISOString()) + ',starts_at.lt.' + encodeURIComponent(in24.toISOString()) + ')') || [];
  if (!ms.length) return;
  const members = sb('GET', 'profiles?select=id,notify_email,role&role=in.(member,board,chair)') || [];
  ms.forEach((m) => {
    let ids = members.map((p) => p.id);
    if (m.event_id) {
      const team = (sb('GET', 'event_members?select=user_id&status=eq.accepted&event_id=eq.' + m.event_id) || []).map((x) => x.user_id);
      ids = ids.filter((id) => team.indexOf(id) >= 0);
    }
    const allowed = {};
    members.forEach((p) => (allowed[p.id] = p.notify_email !== false));
    const when = Utilities.formatDate(new Date(m.starts_at), TZ, 'EEEE dd.MM, HH:mm');
    const rows = ids.filter((id) => allowed[id]).map((id) => ({
      user_id: id,
      subject: 'Przypomnienie: ' + m.title + ' (' + Utilities.formatDate(new Date(m.starts_at), TZ, 'dd.MM HH:mm') + ')',
      body: 'Jutro / wkrótce: ' + m.title + '\n' + when + (m.location ? '\nMiejsce: ' + m.location : '') + '\n\nPamiętaj o kodzie QR obecności w aplikacji.',
      link: '#/spotkania/' + m.id,
    }));
    if (rows.length) sb('POST', 'notifications', rows);
    sb('PATCH', 'meetings?id=eq.' + m.id, { reminder_sent_at: new Date().toISOString() });
  });
}

function processNotifications(settings) {
  let quota = MailApp.getRemainingDailyQuota();
  if (quota < 3) {
    console.log('Dzienny limit e-maili wyczerpany – reszta wyśle się jutro.');
    return;
  }
  const rows =
    sb('GET', 'notifications?select=id,user_id,subject,body,link,profile:profiles(email,full_name,notify_email)&sent_at=is.null&order=created_at&limit=300') || [];
  if (!rows.length) return;
  const byUser = {};
  rows.forEach((r) => (byUser[r.user_id] = byUser[r.user_id] || []).push(r));
  const appUrl = settings.app_url || '';
  Object.keys(byUser).forEach((uid) => {
    if (quota < 2) return; // zostaw resztę na kolejne uruchomienie / jutro
    const list = byUser[uid];
    const p = list[0].profile;
    const filter = 'notifications?id=in.(' + list.map((r) => r.id).join(',') + ')';
    if (!p || !p.email || p.notify_email === false) {
      sb('PATCH', filter, { sent_at: new Date().toISOString(), error: 'pominięto (brak zgody / adresu)' });
      return;
    }
    const subject = list.length === 1 ? list[0].subject : 'Kulturka: ' + list.length + ' nowe powiadomienia';
    try {
      MailApp.sendEmail({ to: p.email, subject: subject, htmlBody: emailHtml(p.full_name, list, appUrl), name: 'Kulturka – KKiP SS PWr' });
      quota--;
      sb('PATCH', filter, { sent_at: new Date().toISOString() });
    } catch (err) {
      sb('PATCH', filter, { sent_at: new Date().toISOString(), error: String(err).slice(0, 300) });
    }
  });
}

/** Usuwa story wygasłe ponad dobę temu (rekord + zdjęcie), żeby nie zapychać darmowego miejsca */
function cleanupStories() {
  const cutoff = new Date(Date.now() - 24 * 3600e3).toISOString();
  const old = sb('GET', 'stories?select=id,image_url&expires_at=lt.' + encodeURIComponent(cutoff) + '&limit=100') || [];
  if (!old.length) return;
  const p = PropertiesService.getScriptProperties();
  const url = p.getProperty('SUPABASE_URL').replace(/\/$/, '');
  const key = p.getProperty('SUPABASE_SERVICE_KEY');
  const paths = old
    .map((s) => (s.image_url.split('/storage/v1/object/public/community/')[1] || ''))
    .filter(Boolean);
  if (paths.length) {
    const headers = { apikey: key, 'Content-Type': 'application/json' };
    if (key.indexOf('eyJ') === 0) headers.Authorization = 'Bearer ' + key;
    UrlFetchApp.fetch(url + '/storage/v1/object/community', {
      method: 'delete', headers: headers, payload: JSON.stringify({ prefixes: paths }), muteHttpExceptions: true,
    });
  }
  sb('DELETE', 'stories?id=in.(' + old.map((s) => s.id).join(',') + ')');
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

function emailHtml(name, list, appUrl) {
  const items = list
    .map((n) => {
      const href = appUrl ? appUrl + (n.link || '') : '';
      return (
        '<div style="padding:16px 0;border-bottom:1px solid #e3eaf0">' +
        '<div style="font-size:16px;font-weight:600;color:#0d2436">' + esc(n.subject) + '</div>' +
        '<div style="font-size:14px;color:#3d5a73;white-space:pre-wrap;margin-top:6px">' + esc(n.body) + '</div>' +
        (href ? '<a href="' + esc(href) + '" style="display:inline-block;margin-top:10px;background:#2394d0;color:#fff;text-decoration:none;padding:8px 14px;border-radius:10px;font-size:14px;font-weight:600">Otwórz w aplikacji</a>' : '') +
        '</div>'
      );
    })
    .join('');
  return (
    '<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;background:#f5f9fc;padding:20px">' +
    '<div style="background:#7dc9ee;color:#fff;border-radius:16px 16px 0 0;padding:18px 22px;font-size:18px;font-weight:700">KULTURKA · Komisja Kultury i Projektów</div>' +
    '<div style="background:#fff;border-radius:0 0 16px 16px;padding:6px 22px 18px">' +
    '<p style="font-size:14px;color:#0d2436">Cześć ' + esc((name || '').split(' ')[0]) + '!</p>' + items +
    '<p style="font-size:12px;color:#6b7f90;margin-top:16px">Powiadomienia możesz wyłączyć w aplikacji: Mój profil → Edytuj → „Wysyłaj mi powiadomienia e-mail”.</p>' +
    '</div></div>'
  );
}

// ---------------------------------------------------------------------------
//  Kopia zapasowa (co tydzień; można też uruchomić ręcznie funkcję backup)
// ---------------------------------------------------------------------------
function backup() {
  const settings = (sb('GET', 'app_settings?id=eq.1&select=*') || [])[0] || {};
  if (!settings.drive_folder_id || settings.backups_enabled === false) return;
  const tables = [
    'app_settings', 'profiles', 'custom_roles', 'custom_role_assignments', 'announcements', 'meetings', 'attendance',
    'meeting_role_access', 'events', 'event_members', 'event_announcements', 'availability_polls', 'availability_responses',
    'audit_log', 'feedback', 'profile_private', 'event_roles', 'event_role_assignments', 'posts', 'post_likes', 'post_comments',
  ];
  const data = { created_at: new Date().toISOString(), note: 'Kopia Kulturki (bez haseł i sekretów QR)', tables: {} };
  tables.forEach((t) => {
    const all = [];
    for (let offset = 0; offset < 100000; offset += 1000) {
      const page = sb('GET', t + '?select=*&limit=1000&offset=' + offset) || [];
      page.forEach((r) => all.push(r));
      if (page.length < 1000) break;
    }
    data.tables[t] = all;
  });
  const parent = DriveApp.getFolderById(settings.drive_folder_id);
  const it = parent.getFoldersByName('Kopie zapasowe');
  const folder = it.hasNext() ? it.next() : parent.createFolder('Kopie zapasowe');
  folder.createFile('kulturka-kopia-' + Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd_HHmm') + '.json', JSON.stringify(data), 'application/json');
  // zostaw 8 najnowszych kopii
  const files = [];
  const fit = folder.getFiles();
  while (fit.hasNext()) files.push(fit.next());
  files.sort((a, b) => b.getDateCreated() - a.getDateCreated());
  files.slice(8).forEach((f) => f.setTrashed(true));
  console.log('Kopia zapasowa zapisana w folderze „Kopie zapasowe”.');
}

// ---------------------------------------------------------------------------
//  Udostępnianie agend do edycji (opcja „share_agendas” w ustawieniach aplikacji)
// ---------------------------------------------------------------------------
function loadSharingData() {
  const now = new Date().toISOString();
  return {
    access: sb('GET', 'meeting_role_access?select=meeting_id,role_id,can_edit&can_edit=eq.true') || [],
    assignments: sb('GET', 'custom_role_assignments?select=user_id,role_id,expires_at,role:custom_roles(can_edit_own,can_manage_meetings)') || [],
    now: now,
  };
}

/** Kto może edytować agendę: zarząd, przewodniczący, admin + role z dostępem do spotkania + autor (edycja własnych). */
function agendaEditors(m, people, sharing) {
  const active = (a) => !a.expires_at || a.expires_at > sharing.now;
  const byId = {};
  people.forEach((p) => (byId[p.id] = p));
  const ids = {};
  people.filter((p) => ['board', 'chair', 'admin'].indexOf(p.role) >= 0).forEach((p) => (ids[p.id] = 1));
  const roleIds = sharing.access.filter((x) => x.meeting_id === m.id).map((x) => x.role_id);
  sharing.assignments.forEach((a) => {
    if (!active(a)) return;
    if (roleIds.indexOf(a.role_id) >= 0) ids[a.user_id] = 1;
    if (a.role && a.role.can_manage_meetings) ids[a.user_id] = 1;
    if (a.role && a.role.can_edit_own && a.user_id === m.created_by) ids[a.user_id] = 1;
  });
  return Object.keys(ids)
    .map((id) => byId[id])
    .filter((p) => p && ['member', 'board', 'chair', 'admin'].indexOf(p.role) >= 0)
    .map((p) => p.email);
}

function shareAgenda(url, emails) {
  const m = String(url).match(/\/d\/([\w-]{10,})/);
  if (!m) return;
  let file;
  try {
    file = DriveApp.getFileById(m[1]);
  } catch (e) {
    return; // brak dostępu do pliku (np. wklejony cudzy dokument)
  }
  const current = {};
  try {
    file.getEditors().forEach((u) => (current[u.getEmail().toLowerCase()] = 1));
  } catch (e) {}
  emails.forEach((email) => {
    if (!email || current[email.toLowerCase()]) return;
    try {
      file.addEditor(email);
    } catch (e) {
      console.log('Nie można udostępnić ' + email + ' (brak konta Google?): ' + e.message);
    }
  });
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
