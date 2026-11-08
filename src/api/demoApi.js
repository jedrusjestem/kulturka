// Tryb DEMO – działa bez backendu, dane trzymane w localStorage przeglądarki.
// Służy do podglądu i testów. Po podłączeniu Supabase (plik .env) nie jest używany.
import { currentWindow, hmacHex, parsePayload } from '../lib/qr';

const KEY = 'kulturka-demo-db-v1';
const SESSION_KEY = 'kulturka-demo-session';
const listeners = new Set();
const uuid = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const delay = (ms = 120) => new Promise((r) => setTimeout(r, ms));

function randomSecret() {
  return [...crypto.getRandomValues(new Uint8Array(20))].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function daysFromNow(d, h = 18, m = 0) {
  const x = new Date();
  x.setDate(x.getDate() + d);
  x.setHours(h, m, 0, 0);
  return x.toISOString();
}

function seed() {
  const p = (full_name, email, role, extra = {}) => ({
    id: uuid(),
    email,
    full_name,
    role,
    faculty: '',
    study_field: '',
    study_year: '',
    bio: '',
    phone: '',
    instagram: '',
    facebook: '',
    show_email: true,
    show_phone: false,
    avatar_url: '',
    consent_at: now(),
    approved_by: null,
    approved_at: role === 'pending' ? null : now(),
    created_at: now(),
    updated_at: now(),
    ...extra,
  });
  const users = [
    p('Anna Kowalska', 'anna.kowalska@student.pwr.edu.pl', 'chair', {
      faculty: 'W4N – Informatyki i Telekomunikacji',
      study_field: 'Informatyka Stosowana',
      study_year: '3 rok',
      bio: 'Przewodnicząca Komisji Kultury i Projektów. Kocham teatr, planszówki i dobrze zorganizowane wydarzenia 🎭',
      instagram: 'anna.k',
    }),
    p('Michał Nowak', 'michal.nowak@student.pwr.edu.pl', 'board', {
      faculty: 'W10 – Mechaniczny',
      study_field: 'Mechatronika',
      study_year: '2 rok',
      bio: 'Zarząd KKiP – logistyka i sprzęt nagłośnieniowy.',
    }),
    p('Zofia Wiśniewska', 'zofia.wisniewska@student.pwr.edu.pl', 'member', {
      faculty: 'W1 – Architektury',
      study_field: 'Architektura',
      study_year: '4 rok',
      bio: 'Grafika, plakaty i identyfikacja wizualna wydarzeń.',
    }),
    p('Kacper Wójcik', 'kacper.wojcik@student.pwr.edu.pl', 'member', {
      faculty: 'W12 – Elektroniki, Fotoniki i Mikrosystemów',
      study_field: 'Elektronika',
      study_year: '1 rok mgr',
    }),
    p('Julia Kamińska', 'julia.kaminska@student.pwr.edu.pl', 'member', {
      faculty: 'W8N – Zarządzania',
      study_field: 'Zarządzanie',
      study_year: '2 rok',
      bio: 'Social media i kontakt z partnerami.',
    }),
    p('Igor Lewandowski', 'igor.lewandowski@student.pwr.edu.pl', 'member', {
      faculty: 'W5 – Elektryczny',
      study_field: 'Automatyka i Robotyka',
      study_year: '3 rok',
    }),
    p('Admin Kulturki', 'admin.kulturka@student.pwr.edu.pl', 'admin', { bio: 'Administrator techniczny aplikacji.' }),
    p('Tomasz Zieliński', 'tomasz.zielinski@student.pwr.edu.pl', 'pending', { study_year: '1 rok' }),
    p('Natalia Szymańska', 'natalia.szymanska@student.pwr.edu.pl', 'pending', { study_year: '2 rok' }),
  ];
  const [anna, michal, zofia, kacper, julia, igor] = users;
  const roles = [
    {
      id: uuid(),
      name: 'Koordynator Juwenaliów',
      color: '#F59E0B',
      description: 'Koordynacja strefy kultury na Juwenaliach',
      can_post_important: true,
      can_scan: true,
      can_manage_meetings: false,
      created_by: anna.id,
      created_at: now(),
    },
    {
      id: uuid(),
      name: 'Fotograf',
      color: '#8B5CF6',
      description: 'Dokumentacja zdjęciowa wydarzeń',
      can_post_important: false,
      can_scan: false,
      can_manage_meetings: false,
      created_by: anna.id,
      created_at: now(),
    },
  ];
  const assignments = [
    { id: uuid(), user_id: zofia.id, role_id: roles[0].id, expires_at: daysFromNow(30, 23, 59), granted_by: anna.id, created_at: now() },
    { id: uuid(), user_id: julia.id, role_id: roles[1].id, expires_at: null, granted_by: michal.id, created_at: now() },
  ];
  const meetings = [
    { title: 'Spotkanie organizacyjne', d: -21, loc: 'C-13, sala 0.31' },
    { title: 'Planowanie Nocy Kultury', d: -14, loc: 'D-20, sala 105' },
    { title: 'Spotkanie komisji', d: -7, loc: 'C-13, sala 0.31' },
    { title: 'Spotkanie komisji', d: 2, loc: 'C-13, sala 0.31' },
    { title: 'Warsztaty grafiki – plakaty', d: 6, loc: 'Online (Teams)', h: 19 },
    { title: 'Spotkanie komisji', d: 9, loc: 'C-13, sala 0.31' },
    { title: 'Próba generalna – koncert', d: 16, loc: 'Klub Studencki „Kwadrat"', h: 17 },
  ].map((m) => ({
    id: uuid(),
    title: m.title,
    description: 'Omówienie bieżących projektów, podział zadań i sprawy różne.',
    location: m.loc,
    starts_at: daysFromNow(m.d, m.h ?? 18),
    ends_at: daysFromNow(m.d, (m.h ?? 18) + 1, 30),
    agenda_url: m.d < 0 ? 'https://docs.google.com/document/d/DEMO/edit' : '',
    sheet_url: m.d < 0 ? 'https://docs.google.com/spreadsheets/d/DEMO/edit' : '',
    auto_agenda: true,
    dirty: false,
    synced_at: now(),
    created_by: anna.id,
    created_at: now(),
    updated_at: now(),
  }));
  const attendance = [];
  const active = [anna, michal, zofia, kacper, julia, igor];
  meetings
    .filter((m) => new Date(m.starts_at) < new Date())
    .forEach((m, i) => {
      active.forEach((u, j) => {
        if ((i + j) % 4 === 3) return;
        attendance.push({ meeting_id: m.id, user_id: u.id, present: true, method: j % 2 ? 'qr' : 'manual', marked_by: michal.id, marked_at: m.starts_at });
      });
    });
  const announcements = [
    {
      id: uuid(),
      title: 'Zgłoszenia na Noc Kultury – do piątku!',
      body: 'Kochani, zbieramy zgłoszenia wolontariuszy na Noc Kultury. Wpiszcie się w formularz u Michała lub napiszcie na grupie.\n\nPotrzebujemy osób do: obsługi wejścia, sceny i strefy chill.',
      author_id: anna.id,
      status: 'published',
      pinned: true,
      reviewed_by: anna.id,
      reviewed_at: now(),
      created_at: daysFromNow(-2, 10),
    },
    {
      id: uuid(),
      title: 'Nowe klucze do magazynu',
      body: 'Klucze do magazynu w C-13 odbieramy teraz w biurze Samorządu (pok. 14) za okazaniem legitymacji.',
      author_id: michal.id,
      status: 'published',
      pinned: false,
      reviewed_by: michal.id,
      reviewed_at: now(),
      created_at: daysFromNow(-5, 12),
    },
    {
      id: uuid(),
      title: 'Plakaty na koncert gotowe 🎨',
      body: 'Wrzuciłam projekty plakatów na dysk komisji – dajcie znać, który wariant najbardziej Wam się podoba.',
      author_id: zofia.id,
      status: 'published',
      pinned: false,
      reviewed_by: michal.id,
      reviewed_at: now(),
      created_at: daysFromNow(-6, 15),
    },
    {
      id: uuid(),
      title: 'Propozycja: wyjście do teatru',
      body: 'Może zorganizujemy wspólne wyjście do Teatru Polskiego? Są zniżki grupowe dla studentów.',
      author_id: kacper.id,
      status: 'pending',
      pinned: false,
      reviewed_by: null,
      reviewed_at: null,
      created_at: daysFromNow(-1, 20),
    },
  ];
  return {
    users,
    secrets: Object.fromEntries(users.map((u) => [u.id, randomSecret()])),
    roles,
    assignments,
    meetings,
    attendance,
    announcements,
    audit: [],
    settings: {
      id: 1,
      committee_name: 'Komisja Kultury i Projektów',
      allowed_email_domain: '',
      drive_folder_id: '',
      apps_script_url: '',
      agenda_template_id: '',
      updated_at: now(),
    },
  };
}

function dayAt(d, h, m = 0) {
  const x = new Date();
  x.setDate(x.getDate() + d);
  x.setHours(h, m, 0, 0);
  return x;
}
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Wydarzenie przykładowe: Noc Kultury z zespołem, ogłoszeniem i ankietą dostępności */
function seedEvents(db) {
  db.events = [];
  db.eventMembers = [];
  db.eventAnnouncements = [];
  db.polls = [];
  db.pollResponses = [];
  db.feedback = db.feedback || [];
  const by = (n) => db.users.find((u) => u.full_name.startsWith(n));
  const kac = by('Kacper');
  db.cases = [
    { id: uuid(), category: 'integration', category_other: '', description: 'Nowe osoby w komisji czują się trochę pominięte – może zrobilibyśmy wieczór integracyjny przed Nocą Kultury?', anonymous: true, reporter_id: null, tracking_token: randomSecret(), status: 'new', priority: 'normal', assigned_to: null, board_note: '', response: '', created_at: dayAt(-1, 21).toISOString(), updated_at: now(), resolved_at: null },
    { id: uuid(), category: 'other', category_other: 'Sprzęt nagłośnieniowy', description: 'Mikrofon bezprzewodowy z magazynu nie działa, a w piątek mamy próbę. Czy ktoś może zgłosić naprawę?', anonymous: false, reporter_id: kac ? kac.id : null, tracking_token: randomSecret(), status: 'in_progress', priority: 'high', assigned_to: by('Michał')?.id || null, board_note: 'Michał sprawdza gwarancję.', response: 'Dzięki! Michał zajmuje się naprawą, do piątku dostaniecie zapasowy mikrofon.', created_at: dayAt(-3, 14).toISOString(), updated_at: now(), resolved_at: null },
  ];
  const zofia = by('Zofia'), michal = by('Michał'), kacper = by('Kacper'), julia = by('Julia'), igor = by('Igor'), anna = by('Anna');
  if (!zofia || !anna) return db;
  const ev = {
    id: uuid(),
    name: 'Noc Kultury 2026',
    description: 'Całonocne wydarzenie kulturalne w kampusie: koncerty, kino plenerowe, strefa gier i warsztaty.\n\nSzukamy osób do sztabu i kadry!',
    location: 'Kampus PWr, Plac Grunwaldzki',
    starts_at: dayAt(21, 18).toISOString(),
    ends_at: dayAt(22, 4).toISOString(),
    color: '#8B5CF6',
    recruitment_open: true,
    status: 'active',
    created_by: anna.id,
    created_at: now(),
  };
  const ev2 = {
    id: uuid(),
    name: 'Wiosenny koncert charytatywny',
    description: 'Koncert zespołów studenckich na rzecz schroniska.',
    location: 'Klub Studencki „Kwadrat"',
    starts_at: dayAt(60, 19).toISOString(),
    ends_at: dayAt(60, 23).toISOString(),
    color: '#F59E0B',
    recruitment_open: true,
    status: 'active',
    created_by: anna.id,
    created_at: now(),
  };
  db.events.push(ev, ev2);
  const mem = (e, u, role, status = 'accepted', note = '') =>
    u && db.eventMembers.push({ event_id: e.id, user_id: u.id, role, status, note, decided_by: anna.id, decided_at: now(), created_at: now() });
  mem(ev, zofia, 'coordinator');
  mem(ev, michal, 'staff');
  mem(ev, kacper, 'crew');
  mem(ev, julia, 'crew');
  mem(ev, igor, 'crew', 'applied', 'Mogę pomóc przy nagłośnieniu, ale dopiero od 20:00.');
  mem(ev2, julia, 'coordinator');
  const ann = {
    id: uuid(),
    event_id: ev.id,
    title: 'Próba generalna – kiedy możecie?',
    body: 'Zaznaczcie w ankiecie, kiedy możecie przyjść na próbę generalną. Jeśli nie jesteście pewni, dopiszcie notatkę.',
    author_id: zofia.id,
    status: 'published',
    pinned: true,
    notify: false,
    reviewed_by: zofia.id,
    reviewed_at: now(),
    created_at: now(),
  };
  db.eventAnnouncements.push(ann);
  const days = [dayAt(5, 0), dayAt(6, 0), dayAt(7, 0)].map(ymd);
  const poll = { id: uuid(), announcement_id: null, event_announcement_id: ann.id, dates: days, start_minute: 960, end_minute: 1320, slot_minutes: 30, created_by: zofia.id, created_at: now() };
  db.polls.push(poll);
  const slotsFor = (day, from, to) => {
    const out = [];
    for (let m = from; m < to; m += 30) out.push(`${day} ${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
    return out;
  };
  const resp = (u, slots, note = '') => db.pollResponses.push({ poll_id: poll.id, user_id: u.id, slots, note, updated_at: now() });
  resp(zofia, [...slotsFor(days[0], 960, 1200), ...slotsFor(days[1], 1080, 1320)]);
  resp(michal, [...slotsFor(days[0], 1020, 1260), ...slotsFor(days[2], 960, 1140)]);
  resp(kacper, [...slotsFor(days[0], 1080, 1320)], 'W środę raczej tak, potwierdzę do poniedziałku.');
  db.eventAnnouncements.push({
    id: uuid(), event_id: ev.id, title: 'Podział stref', body: 'Lista stref i osób odpowiedzialnych będzie w agendzie najbliższego spotkania.',
    author_id: michal.id, status: 'published', pinned: false, notify: false, reviewed_by: michal.id, reviewed_at: now(), created_at: dayAt(-1, 12).toISOString(),
  });
  db.meetings.push({
    id: uuid(), title: 'Spotkanie sztabu Nocy Kultury', description: 'Podział zadań na strefy.', location: 'C-13, sala 0.31',
    starts_at: dayAt(3, 19).toISOString(), ends_at: dayAt(3, 20, 30).toISOString(), agenda_url: '', sheet_url: '', auto_agenda: true,
    dirty: false, synced_at: now(), created_by: zofia.id, created_at: now(), updated_at: now(), event_id: ev.id,
  });
  return db;
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw);
      if (!d.events) seedEvents(d);
      if (!d.cases) d.cases = [];
      return d;
    }
  } catch {
    /* ignore */
  }
  const db = seedEvents(seed());
  localStorage.setItem(KEY, JSON.stringify(db));
  return db;
}
let db = load();
const save = () => localStorage.setItem(KEY, JSON.stringify(db));

function sessionUserId() {
  return localStorage.getItem(SESSION_KEY);
}
function me() {
  return db.users.find((u) => u.id === sessionUserId()) || null;
}
const isActive = (u) => u && ['member', 'board', 'chair', 'admin'].includes(u.role);
const isBoard = (u) => u && ['board', 'chair', 'admin'].includes(u.role);
const isChair = (u) => u && ['chair', 'admin'].includes(u.role);
const isAdmin = (u) => u && u.role === 'admin';
const isMember = (u) => u && ['member', 'board', 'chair'].includes(u.role);
const count = (role) => db.users.filter((x) => x.role === role).length;
function hasPerm(u, p) {
  if (isBoard(u)) return true;
  if (!isActive(u)) return false;
  const field = { post_important: 'can_post_important', scan: 'can_scan', manage_meetings: 'can_manage_meetings', edit_own: 'can_edit_own' }[p];
  return db.assignments.some((a) => {
    if (a.user_id !== u.id) return false;
    if (a.expires_at && new Date(a.expires_at) < new Date()) return false;
    const r = db.roles.find((x) => x.id === a.role_id);
    return r && r[field];
  });
}
function activeRoleIds(u) {
  return db.assignments.filter((a) => a.user_id === u.id && (!a.expires_at || new Date(a.expires_at) > new Date())).map((a) => a.role_id);
}
function hasMeetingPerm(u, meetingId, p) {
  const mt = db.meetings.find((x) => x.id === meetingId);
  if (mt?.event_id) {
    if (isEvStaff(u, mt.event_id)) return true;
    const ids0 = activeRoleIds(u);
    return (db.meetingAccess || []).some((x) => x.meeting_id === meetingId && ids0.includes(x.role_id) && (p === 'edit' ? x.can_edit : x.can_scan));
  }
  if (hasPerm(u, p === 'edit' ? 'manage_meetings' : 'scan')) return true;
  if (!isActive(u)) return false;
  const ids = activeRoleIds(u);
  if ((db.meetingAccess || []).some((x) => x.meeting_id === meetingId && ids.includes(x.role_id) && (p === 'edit' ? x.can_edit : x.can_scan)))
    return true;
  const m = db.meetings.find((x) => x.id === meetingId);
  return p === 'edit' && hasPerm(u, 'edit_own') && m?.created_by === u.id;
}
function evRole(u, eventId) {
  const m = (db.eventMembers || []).find((x) => x.event_id === eventId && x.user_id === u?.id && x.status === 'accepted');
  return m?.role || null;
}
const isEvAdmin = (u, e) => isChair(u) || (isActive(u) && evRole(u, e) === 'coordinator');
const isEvStaff = (u, e) => isEvAdmin(u, e) || (isActive(u) && evRole(u, e) === 'staff');
const isEvMember = (u, e) => isEvStaff(u, e) || (isActive(u) && !!evRole(u, e));
function canSeeMeeting(u, m) {
  return isActive(u) && (!m.event_id || isEvMember(u, m.event_id));
}
function deny(cond, msg = 'Brak uprawnień') {
  if (!cond) throw new Error(msg);
}
function withAssignments(u) {
  if (!u) return null;
  return {
    ...u,
    assignments: db.assignments
      .filter((a) => a.user_id === u.id)
      .map((a) => ({ ...a, role: db.roles.find((r) => r.id === a.role_id) }))
      .filter((a) => a.role),
  };
}
function log(action, target, details = {}) {
  db.audit.unshift({ id: Date.now(), actor_id: me()?.id, action, target_id: target, details, created_at: now() });
  db.audit = db.audit.slice(0, 200);
}
function emit() {
  const s = sessionUserId() ? { userId: sessionUserId(), email: me()?.email } : null;
  listeners.forEach((cb) => cb(s));
}
function markDirty(meetingId) {
  const m = db.meetings.find((x) => x.id === meetingId);
  if (m) m.dirty = true;
}

export function createDemoApi() {
  return {
    mode: 'demo',
    resetDemo() {
      localStorage.removeItem(KEY);
      localStorage.removeItem(SESSION_KEY);
      db = load();
      emit();
    },
    demoPersonas() {
      const pick = (role) => db.users.find((u) => u.role === role);
      return [
        ['Administrator', pick('admin')],
        ['Przewodniczący', pick('chair')],
        ['Zarząd', pick('board')],
        ['Członek', db.users.find((u) => u.role === 'member' && db.assignments.some((a) => a.user_id === u.id)) || pick('member')],
        ['Kadra wydarzenia', db.users.find((u) => u.full_name.startsWith('Kacper'))],
        ['Oczekujący', pick('pending')],
      ].filter(([, u]) => u);
    },

    // ---------- auth ----------
    async getSession() {
      const u = me();
      return u ? { userId: u.id, email: u.email } : null;
    },
    onAuthChange(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    async signUp({ email, password, fullName, consent }) {
      await delay();
      const domain = db.settings.allowed_email_domain;
      if (domain && !email.toLowerCase().endsWith('@' + domain.toLowerCase()))
        throw new Error(`Rejestracja możliwa tylko z adresem @${domain}`);
      if (password.length < 8) throw new Error('Hasło musi mieć co najmniej 8 znaków');
      if (db.users.some((u) => u.email.toLowerCase() === email.toLowerCase()))
        throw new Error('Konto z tym adresem już istnieje');
      const noChair = !db.users.some((u) => ['admin', 'chair'].includes(u.role));
      const u = {
        id: uuid(),
        email,
        full_name: fullName || email.split('@')[0],
        role: noChair ? 'admin' : 'pending',
        faculty: '',
        study_field: '',
        study_year: '',
        bio: '',
        phone: '',
        instagram: '',
        facebook: '',
        show_email: true,
        show_phone: false,
        avatar_url: '',
        consent_at: consent ? now() : null,
        approved_by: null,
        approved_at: null,
        created_at: now(),
        updated_at: now(),
      };
      db.users.push(u);
      db.secrets[u.id] = randomSecret();
      save();
      localStorage.setItem(SESSION_KEY, u.id);
      emit();
      return { needsConfirmation: false };
    },
    async signIn({ email }) {
      await delay();
      const u = db.users.find((x) => x.email.toLowerCase() === String(email).toLowerCase());
      if (!u) throw new Error('Nieprawidłowy e-mail lub hasło');
      localStorage.setItem(SESSION_KEY, u.id);
      emit();
    },
    async signInAs(userId) {
      localStorage.setItem(SESSION_KEY, userId);
      emit();
    },
    async signOut() {
      localStorage.removeItem(SESSION_KEY);
      emit();
    },
    async resetPassword() {
      await delay();
    },
    async updatePassword() {
      await delay();
    },
    async getPublicSettings() {
      return { committee_name: db.settings.committee_name, allowed_email_domain: db.settings.allowed_email_domain };
    },

    // ---------- me ----------
    async getMyProfile() {
      return withAssignments(me());
    },
    async updateProfile(id, patch) {
      await delay();
      const u = me();
      const target = db.users.find((x) => x.id === id);
      deny(target && (u.id === id || isBoard(u)));
      const clean = { ...patch };
      ['id', 'email', 'created_at', 'approved_by', 'approved_at', 'role', 'consent_at', 'assignments'].forEach((k) => delete clean[k]);
      Object.assign(target, clean, { updated_at: now() });
      save();
      return withAssignments(target);
    },
    async uploadAvatar(blob) {
      return await new Promise((res) => {
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.readAsDataURL(blob);
      });
    },
    async getMyQrSecret() {
      return db.secrets[sessionUserId()] || null;
    },
    async regenerateQrSecret() {
      db.secrets[sessionUserId()] = randomSecret();
      save();
    },
    async deleteMyAccount() {
      const u = me();
      if (isAdmin(u) && count('admin') <= 1) throw new Error('Jesteś jedynym administratorem – najpierw nadaj tę rolę komuś innemu');
      if (u.role === 'chair' && count('chair') <= 1 && !count('admin'))
        throw new Error('Jesteś jedynym przewodniczącym – najpierw przekaż tę rolę');
      db.users = db.users.filter((x) => x.id !== u.id);
      db.attendance = db.attendance.filter((a) => a.user_id !== u.id);
      db.assignments = db.assignments.filter((a) => a.user_id !== u.id);
      delete db.secrets[u.id];
      save();
      await this.signOut();
    },

    // ---------- profiles ----------
    async listProfiles() {
      await delay(60);
      const u = me();
      return db.users
        .filter((x) => x.id === u.id || isBoard(u) || (isActive(u) && ['member', 'board', 'chair', 'admin', 'alumni'].includes(x.role)))
        .map(withAssignments)
        .sort((a, b) => a.full_name.localeCompare(b.full_name, 'pl'));
    },
    async getProfile(id) {
      const list = await this.listProfiles();
      return list.find((x) => x.id === id) || null;
    },
    async setRole(id, role) {
      await delay();
      const u = me();
      const t = db.users.find((x) => x.id === id);
      deny(isBoard(u), 'Brak uprawnień do zmiany roli');
      if ((t.role === 'admin' || role === 'admin') && !isAdmin(u))
        throw new Error('Tylko administrator może nadawać lub odbierać rolę administratora');
      if ((['board', 'chair'].includes(t.role) || ['board', 'chair'].includes(role)) && !isChair(u))
        throw new Error('Tylko przewodniczący lub administrator może nadawać lub odbierać role zarządu i przewodniczącego');
      if (t.role === 'admin' && role !== 'admin' && count('admin') <= 1)
        throw new Error('Musi zostać co najmniej jeden administrator – najpierw nadaj tę rolę komuś innemu');
      if (t.role === 'chair' && role !== 'chair' && count('chair') <= 1 && !count('admin'))
        throw new Error('Musi zostać co najmniej jeden przewodniczący – najpierw nadaj tę rolę komuś innemu');
      log('role_change', id, { from: t.role, to: role });
      if (t.role === 'pending' && ['member', 'board', 'chair', 'admin'].includes(role)) {
        t.approved_by = u.id;
        t.approved_at = now();
      }
      t.role = role;
      db.meetings.filter((m) => new Date(m.starts_at) > new Date(Date.now() - 864e5)).forEach((m) => (m.dirty = true));
      save();
    },

    // ---------- custom roles ----------
    async listCustomRoles() {
      deny(isActive(me()));
      return [...db.roles];
    },
    async saveCustomRole(role) {
      deny(isBoard(me()));
      if (role.id) {
        const r = db.roles.find((x) => x.id === role.id);
        Object.assign(r, role);
        save();
        return r;
      }
      const r = { ...role, id: uuid(), created_by: me().id, created_at: now() };
      db.roles.push(r);
      save();
      return r;
    },
    async deleteCustomRole(id) {
      deny(isBoard(me()));
      db.roles = db.roles.filter((r) => r.id !== id);
      db.assignments = db.assignments.filter((a) => a.role_id !== id);
      save();
    },
    async grantCustomRole(userId, roleId, expiresAt) {
      deny(isBoard(me()));
      db.assignments.push({ id: uuid(), user_id: userId, role_id: roleId, expires_at: expiresAt || null, granted_by: me().id, created_at: now() });
      log('custom_role_grant', userId, { role_id: roleId, expires_at: expiresAt });
      save();
    },
    async revokeCustomRole(assignmentId) {
      deny(isBoard(me()));
      db.assignments = db.assignments.filter((a) => a.id !== assignmentId);
      save();
    },

    // ---------- announcements ----------
    async listAnnouncements() {
      await delay(60);
      const u = me();
      return db.announcements
        .filter((a) => (a.status === 'published' && isActive(u)) || a.author_id === u.id || isBoard(u))
        .map((a) => {
          const au = db.users.find((x) => x.id === a.author_id);
          return {
            ...a,
            author: au ? { id: au.id, full_name: au.full_name, avatar_url: au.avatar_url } : null,
            poll: (db.polls || []).find((pl) => pl.announcement_id === a.id) || null,
          };
        })
        .sort((a, b) => (b.pinned - a.pinned) || b.created_at.localeCompare(a.created_at));
    },
    async createAnnouncement({ title, body, notify }) {
      await delay();
      const u = me();
      deny(isActive(u));
      const direct = hasPerm(u, 'post_important');
      const a = {
        id: uuid(),
        title,
        body,
        author_id: u.id,
        status: direct ? 'published' : 'pending',
        pinned: false,
        notify: direct && !!notify,
        reviewed_by: direct ? u.id : null,
        reviewed_at: direct ? now() : null,
        created_at: now(),
      };
      db.announcements.push(a);
      save();
      return a;
    },
    async updateAnnouncement(id, patch) {
      const u = me();
      const a = db.announcements.find((x) => x.id === id);
      deny(isBoard(u) || (a.author_id === u.id && (a.status === 'pending' || (a.status === 'published' && hasPerm(u, 'edit_own')))));
      if (!isBoard(u)) {
        delete patch.status;
        delete patch.pinned;
      } else if (patch.status && patch.status !== a.status) {
        a.reviewed_by = u.id;
        a.reviewed_at = now();
      }
      Object.assign(a, patch);
      save();
    },
    async deleteAnnouncement(id) {
      const u = me();
      const a = db.announcements.find((x) => x.id === id);
      deny(isBoard(u) || a.author_id === u.id);
      db.announcements = db.announcements.filter((x) => x.id !== id);
      save();
    },

    // ---------- meetings ----------
    async listMeetings() {
      await delay(60);
      const u = me();
      deny(isActive(u));
      return db.meetings.filter((m) => canSeeMeeting(u, m)).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    },
    async getMeeting(id) {
      const m = db.meetings.find((x) => x.id === id);
      return m && canSeeMeeting(me(), m) ? m : null;
    },
    async saveMeeting(m) {
      await delay();
      if (m.id) {
        deny(hasMeetingPerm(me(), m.id, 'edit'));
        const x = db.meetings.find((y) => y.id === m.id);
        Object.assign(x, m, { dirty: true, updated_at: now() });
        save();
        return x;
      }
      deny(m.event_id ? isEvStaff(me(), m.event_id) : hasPerm(me(), 'manage_meetings'));
      const x = {
        ...m,
        id: uuid(),
        sheet_url: '',
        agenda_url: m.agenda_url || '',
        dirty: true,
        synced_at: null,
        created_by: me().id,
        created_at: now(),
        updated_at: now(),
      };
      db.meetings.push(x);
      save();
      return x;
    },
    async deleteMeeting(id) {
      const mt = db.meetings.find((x) => x.id === id);
      deny(mt?.event_id ? isEvAdmin(me(), mt.event_id) : hasPerm(me(), 'manage_meetings'));
      db.meetings = db.meetings.filter((m) => m.id !== id);
      db.attendance = db.attendance.filter((a) => a.meeting_id !== id);
      db.meetingAccess = (db.meetingAccess || []).filter((x) => x.meeting_id !== id);
      save();
    },
    async listMeetingAccess(meetingId) {
      return (db.meetingAccess || [])
        .filter((x) => x.meeting_id === meetingId)
        .map((x) => ({ ...x, role: db.roles.find((r) => r.id === x.role_id) }))
        .filter((x) => x.role);
    },
    async setMeetingAccess(meetingId, roleId, { can_edit, can_scan }) {
      deny(isBoard(me()));
      db.meetingAccess = (db.meetingAccess || []).filter((x) => !(x.meeting_id === meetingId && x.role_id === roleId));
      db.meetingAccess.push({ meeting_id: meetingId, role_id: roleId, can_edit, can_scan, granted_by: me().id, created_at: now() });
      save();
    },
    async removeMeetingAccess(meetingId, roleId) {
      deny(isBoard(me()));
      db.meetingAccess = (db.meetingAccess || []).filter((x) => !(x.meeting_id === meetingId && x.role_id === roleId));
      save();
    },

    // ---------- attendance ----------
    async listAttendance(meetingId) {
      const u = me();
      return db.attendance.filter((a) => a.meeting_id === meetingId && (a.user_id === u.id || hasMeetingPerm(u, meetingId, 'scan')));
    },
    async listMyAttendance() {
      return db.attendance.filter((a) => a.user_id === sessionUserId());
    },
    async listAllAttendance() {
      const u = me();
      return db.attendance.filter((a) => hasMeetingPerm(u, a.meeting_id, 'scan'));
    },
    async setAttendance(meetingId, userId, present) {
      await delay(60);
      deny(hasMeetingPerm(me(), meetingId, 'scan'), 'Brak uprawnień do sprawdzania obecności');
      db.attendance = db.attendance.filter((a) => !(a.meeting_id === meetingId && a.user_id === userId));
      if (present !== null)
        db.attendance.push({ meeting_id: meetingId, user_id: userId, present, method: 'manual', marked_by: me().id, marked_at: now() });
      markDirty(meetingId);
      save();
    },
    async scanAttendance(meetingId, payload, scannedAt) {
      await delay(80);
      deny(hasMeetingPerm(me(), meetingId, 'scan'), 'Brak uprawnień do sprawdzania obecności na tym spotkaniu');
      const p = parsePayload(payload);
      if (!p) return { ok: false, error: 'To nie jest kod obecności Kulturki' };
      const scanW = currentWindow(new Date(scannedAt || Date.now()).getTime());
      if (Math.abs(scanW - p.window) > 2)
        return { ok: false, error: 'Kod wygasł – poproś o odświeżenie kodu (to może być zrzut ekranu)' };
      const secret = db.secrets[p.userId];
      if (!secret || (await hmacHex(secret, String(p.window))).slice(0, 10) !== p.code)
        return { ok: false, error: 'Nieprawidłowy kod' };
      const u = db.users.find((x) => x.id === p.userId);
      if (isAdmin(u)) return { ok: false, error: 'Administrator nie jest liczony jako członek komisji' };
      if (!isMember(u)) return { ok: false, error: 'Ta osoba nie jest aktywnym członkiem' };
      const prev = db.attendance.find((a) => a.meeting_id === meetingId && a.user_id === u.id);
      db.attendance = db.attendance.filter((a) => a !== prev);
      db.attendance.push({ meeting_id: meetingId, user_id: u.id, present: true, method: 'qr', marked_by: me().id, marked_at: now() });
      markDirty(meetingId);
      save();
      return { ok: true, already: !!prev?.present, user_id: u.id, full_name: u.full_name, avatar_url: u.avatar_url };
    },

    // ---------- settings / admin ----------
    async getSettings() {
      return { ...db.settings };
    },
    async updateSettings(patch) {
      deny(isChair(me()), 'Tylko przewodniczący może zmieniać ustawienia');
      Object.assign(db.settings, patch, { updated_at: now() });
      save();
    },
    async listAudit() {
      deny(isBoard(me()));
      return db.audit;
    },

    // ---------- wydarzenia ----------
    async listEvents() {
      await delay(60);
      deny(isActive(me()));
      return [...db.events].sort((a, b) => (a.starts_at || '').localeCompare(b.starts_at || ''));
    },
    async getEvent(id) {
      deny(isActive(me()));
      return db.events.find((e) => e.id === id) || null;
    },
    async saveEvent(e) {
      await delay();
      const u = me();
      if (e.id) {
        deny(isEvAdmin(u, e.id), 'Wydarzenie edytuje koordynator główny lub przewodniczący');
        const x = db.events.find((y) => y.id === e.id);
        Object.assign(x, e);
        save();
        return x;
      }
      deny(isChair(u), 'Wydarzenia tworzy przewodniczący');
      const x = { color: '#45B0E5', recruitment_open: true, status: 'active', ...e, id: uuid(), created_by: u.id, created_at: now() };
      db.events.push(x);
      save();
      return x;
    },
    async deleteEvent(id) {
      deny(isChair(me()));
      db.events = db.events.filter((e) => e.id !== id);
      db.eventMembers = db.eventMembers.filter((m) => m.event_id !== id);
      const annIds = db.eventAnnouncements.filter((a) => a.event_id === id).map((a) => a.id);
      db.eventAnnouncements = db.eventAnnouncements.filter((a) => a.event_id !== id);
      db.polls = db.polls.filter((p) => !annIds.includes(p.event_announcement_id));
      db.meetings = db.meetings.filter((m) => m.event_id !== id);
      save();
    },
    async listEventMembers(eventId) {
      const u = me();
      return db.eventMembers
        .filter((m) => m.event_id === eventId && (m.user_id === u.id || isEvStaff(u, eventId) || m.status === 'accepted'))
        .map((m) => ({ ...m, profile: db.users.find((x) => x.id === m.user_id) }));
    },
    async listMyEventMemberships() {
      return db.eventMembers.filter((m) => m.user_id === sessionUserId());
    },
    async listAllEventMembers() {
      return db.eventMembers.filter((m) => m.status === 'accepted' || m.user_id === sessionUserId());
    },
    async applyToEvent(eventId, role, note) {
      await delay();
      const u = me();
      const e = db.events.find((x) => x.id === eventId);
      deny(e?.recruitment_open, 'Rekrutacja do tego wydarzenia jest zamknięta');
      deny(!db.eventMembers.some((m) => m.event_id === eventId && m.user_id === u.id), 'Już się zgłosiłeś(-aś) do tego wydarzenia');
      db.eventMembers.push({ event_id: eventId, user_id: u.id, role: role === 'staff' ? 'staff' : 'crew', status: 'applied', note: note || '', created_at: now() });
      save();
    },
    async addEventMember(eventId, userId, role) {
      await delay();
      const u = me();
      if (role === 'coordinator') {
        deny(isChair(u), 'Koordynatora głównego wyznacza przewodniczący komisji');
        db.eventMembers = db.eventMembers.map((m) => (m.event_id === eventId && m.role === 'coordinator' ? { ...m, role: 'staff' } : m));
      } else if (role === 'staff') deny(isEvAdmin(u, eventId), 'Do sztabu dodaje koordynator główny');
      else deny(isEvStaff(u, eventId), 'Brak uprawnień');
      db.eventMembers = db.eventMembers.filter((m) => !(m.event_id === eventId && m.user_id === userId));
      db.eventMembers.push({ event_id: eventId, user_id: userId, role, status: 'accepted', note: '', decided_by: u.id, decided_at: now(), created_at: now() });
      save();
    },
    async updateEventMember(eventId, userId, patch) {
      await delay();
      const u = me();
      const m = db.eventMembers.find((x) => x.event_id === eventId && x.user_id === userId);
      deny(m);
      const role = patch.role ?? m.role;
      if ((role === 'coordinator' || m.role === 'coordinator') && role !== m.role) deny(isChair(u), 'Koordynatora głównego wyznacza przewodniczący komisji');
      if (role === 'staff' || (m.role === 'staff' && m.status === 'accepted')) deny(isEvAdmin(u, eventId), 'O sztabie decyduje koordynator główny');
      deny(isEvStaff(u, eventId));
      Object.assign(m, patch, { decided_by: u.id, decided_at: now() });
      save();
    },
    async removeEventMember(eventId, userId) {
      await delay();
      const u = me();
      const m = db.eventMembers.find((x) => x.event_id === eventId && x.user_id === userId);
      if (m && m.user_id !== u.id) {
        if (m.role === 'coordinator') deny(isChair(u), 'Koordynatora głównego może usunąć tylko przewodniczący komisji');
        if (m.role === 'staff') deny(isEvAdmin(u, eventId), 'Członków sztabu usuwa koordynator główny');
        deny(isEvStaff(u, eventId));
      }
      db.eventMembers = db.eventMembers.filter((x) => x !== m);
      save();
    },
    async listEventAnnouncements(eventId) {
      await delay(60);
      const u = me();
      if (!isEvMember(u, eventId)) return [];
      return db.eventAnnouncements
        .filter((a) => a.event_id === eventId && (a.status === 'published' || a.author_id === u.id || isEvStaff(u, eventId)))
        .map((a) => {
          const au = db.users.find((x) => x.id === a.author_id);
          return {
            ...a,
            author: au ? { id: au.id, full_name: au.full_name, avatar_url: au.avatar_url } : null,
            poll: db.polls.find((pl) => pl.event_announcement_id === a.id) || null,
          };
        })
        .sort((a, b) => (b.pinned - a.pinned) || b.created_at.localeCompare(a.created_at));
    },
    async createEventAnnouncement({ event_id, title, body, notify }) {
      await delay();
      const u = me();
      deny(isEvMember(u, event_id));
      const direct = isEvStaff(u, event_id);
      const a = {
        id: uuid(), event_id, title, body, author_id: u.id, status: direct ? 'published' : 'pending', pinned: false,
        notify: direct && !!notify, reviewed_by: direct ? u.id : null, reviewed_at: direct ? now() : null, created_at: now(),
      };
      db.eventAnnouncements.push(a);
      save();
      return a;
    },
    async updateEventAnnouncement(id, patch) {
      const u = me();
      const a = db.eventAnnouncements.find((x) => x.id === id);
      const staff = isEvStaff(u, a.event_id);
      deny(staff || (a.author_id === u.id && a.status === 'pending'));
      if (!staff) {
        delete patch.status;
        delete patch.pinned;
        delete patch.notify;
      }
      Object.assign(a, patch);
      save();
    },
    async deleteEventAnnouncement(id) {
      const u = me();
      const a = db.eventAnnouncements.find((x) => x.id === id);
      deny(isEvStaff(u, a.event_id) || a.author_id === u.id);
      db.eventAnnouncements = db.eventAnnouncements.filter((x) => x.id !== id);
      db.polls = db.polls.filter((p) => p.event_announcement_id !== id);
      save();
    },

    // ---------- ankiety dostępności ----------
    async createPoll(poll) {
      const u = me();
      if (poll.announcement_id) {
        const a = db.announcements.find((x) => x.id === poll.announcement_id);
        deny(a && (a.author_id === u.id || isBoard(u)));
      } else {
        const a = db.eventAnnouncements.find((x) => x.id === poll.event_announcement_id);
        deny(a && (a.author_id === u.id || isEvStaff(u, a.event_id)));
      }
      const x = { announcement_id: null, event_announcement_id: null, ...poll, id: uuid(), created_by: u.id, created_at: now() };
      db.polls.push(x);
      save();
      return x;
    },
    async deletePoll(id) {
      db.polls = db.polls.filter((p) => p.id !== id);
      db.pollResponses = db.pollResponses.filter((r) => r.poll_id !== id);
      save();
    },
    async listPollResponses(pollId) {
      await delay(40);
      return db.pollResponses
        .filter((r) => r.poll_id === pollId)
        .map((r) => {
          const p = db.users.find((x) => x.id === r.user_id);
          return { ...r, profile: p ? { id: p.id, full_name: p.full_name, avatar_url: p.avatar_url } : null };
        });
    },
    async saveMyAvailability(pollId, slots, note) {
      await delay();
      const uid = sessionUserId();
      db.pollResponses = db.pollResponses.filter((r) => !(r.poll_id === pollId && r.user_id === uid));
      db.pollResponses.push({ poll_id: pollId, user_id: uid, slots, note, updated_at: now() });
      save();
    },
    async deleteMyAvailability(pollId) {
      const uid = sessionUserId();
      db.pollResponses = db.pollResponses.filter((r) => !(r.poll_id === pollId && r.user_id === uid));
      save();
    },

    // ---------- zgłoszenia problemów, aktywność ----------
    async sendFeedback(message, page) {
      await delay();
      db.feedback = db.feedback || [];
      db.feedback.unshift({ id: Date.now(), user_id: sessionUserId(), message, page, resolved: false, created_at: now() });
      save();
    },
    async listFeedback() {
      const u = me();
      return (db.feedback || [])
        .filter((f) => isChair(u) || f.user_id === u.id)
        .map((f) => {
          const p = db.users.find((x) => x.id === f.user_id);
          return { ...f, author: p ? { id: p.id, full_name: p.full_name, avatar_url: p.avatar_url } : null };
        });
    },
    async resolveFeedback(id, resolved = true) {
      deny(isChair(me()));
      const f = (db.feedback || []).find((x) => x.id === id);
      if (f) f.resolved = resolved;
      save();
    },
    async touchSeen() {
      const u = me();
      if (u) {
        u.last_seen_at = now();
        save();
      }
    },

    // ---------- kulturkowe sprawy ----------
    async submitCase({ category, category_other, description, anonymous }) {
      await delay();
      const u = me();
      deny(isActive(u), 'Zawiadomienia mogą wysyłać tylko aktywni członkowie');
      if (category === 'other' && (category_other || '').trim().length < 3) throw new Error('Napisz, czego dotyczy sprawa');
      if ((description || '').trim().length < 10) throw new Error('Opis musi mieć co najmniej 10 znaków');
      db.cases = db.cases || [];
      const c = {
        id: uuid(),
        category,
        category_other: category === 'other' ? category_other.trim() : '',
        description: description.trim(),
        anonymous: !!anonymous,
        reporter_id: anonymous ? null : u.id,
        tracking_token: randomSecret() + randomSecret().slice(0, 4),
        status: 'new',
        priority: 'normal',
        assigned_to: null,
        board_note: '',
        response: '',
        created_at: now(),
        updated_at: now(),
        resolved_at: null,
      };
      db.cases.unshift(c);
      save();
      return { id: c.id, tracking_token: c.tracking_token, anonymous: c.anonymous };
    },
    async myCases(tokens) {
      const u = me();
      const pick = ({ id, category, category_other, anonymous, status, response, created_at, updated_at }) => ({
        id, category, category_other, anonymous, status, response, created_at, updated_at,
      });
      return (db.cases || []).filter((c) => tokens.includes(c.tracking_token) || c.reporter_id === u.id).map(pick);
    },
    async listCases() {
      await delay(60);
      deny(isBoard(me()));
      const p = (id) => {
        const x = db.users.find((y) => y.id === id);
        return x ? { id: x.id, full_name: x.full_name, avatar_url: x.avatar_url } : null;
      };
      return (db.cases || []).map(({ tracking_token, ...c }) => ({ ...c, reporter: p(c.reporter_id), assignee: p(c.assigned_to) }));
    },
    async updateCase(id, patch) {
      await delay();
      deny(isBoard(me()));
      const c = db.cases.find((x) => x.id === id);
      const allowed = ['status', 'priority', 'assigned_to', 'board_note', 'response'];
      allowed.forEach((k) => k in patch && (c[k] = patch[k]));
      c.updated_at = now();
      c.resolved_at = ['resolved', 'rejected'].includes(c.status) ? c.resolved_at || now() : null;
      save();
    },
    async deleteCase(id) {
      deny(isChair(me()));
      db.cases = db.cases.filter((x) => x.id !== id);
      save();
    },
    async countNewCases() {
      return isBoard(me()) ? (db.cases || []).filter((c) => c.status === 'new').length : 0;
    },
  };
}
