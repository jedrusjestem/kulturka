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

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  const db = seed();
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
const count = (role) => db.users.filter((x) => x.role === role).length;
function hasPerm(u, p) {
  if (isBoard(u)) return true;
  if (!isActive(u)) return false;
  const field = { post_important: 'can_post_important', scan: 'can_scan', manage_meetings: 'can_manage_meetings' }[p];
  return db.assignments.some((a) => {
    if (a.user_id !== u.id) return false;
    if (a.expires_at && new Date(a.expires_at) < new Date()) return false;
    const r = db.roles.find((x) => x.id === a.role_id);
    return r && r[field];
  });
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
          return { ...a, author: au ? { id: au.id, full_name: au.full_name, avatar_url: au.avatar_url } : null };
        })
        .sort((a, b) => (b.pinned - a.pinned) || b.created_at.localeCompare(a.created_at));
    },
    async createAnnouncement({ title, body }) {
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
      deny(isBoard(u) || (a.author_id === u.id && a.status === 'pending'));
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
      deny(isActive(me()));
      return [...db.meetings].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    },
    async getMeeting(id) {
      deny(isActive(me()));
      return db.meetings.find((m) => m.id === id) || null;
    },
    async saveMeeting(m) {
      await delay();
      deny(hasPerm(me(), 'manage_meetings'));
      if (m.id) {
        const x = db.meetings.find((y) => y.id === m.id);
        Object.assign(x, m, { dirty: true, updated_at: now() });
        save();
        return x;
      }
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
      deny(hasPerm(me(), 'manage_meetings'));
      db.meetings = db.meetings.filter((m) => m.id !== id);
      db.attendance = db.attendance.filter((a) => a.meeting_id !== id);
      save();
    },

    // ---------- attendance ----------
    async listAttendance(meetingId) {
      const u = me();
      return db.attendance.filter((a) => a.meeting_id === meetingId && (a.user_id === u.id || hasPerm(u, 'scan')));
    },
    async listMyAttendance() {
      return db.attendance.filter((a) => a.user_id === sessionUserId());
    },
    async listAllAttendance() {
      deny(hasPerm(me(), 'scan'));
      return [...db.attendance];
    },
    async setAttendance(meetingId, userId, present) {
      await delay(60);
      deny(hasPerm(me(), 'scan'), 'Brak uprawnień do sprawdzania obecności');
      db.attendance = db.attendance.filter((a) => !(a.meeting_id === meetingId && a.user_id === userId));
      if (present !== null)
        db.attendance.push({ meeting_id: meetingId, user_id: userId, present, method: 'manual', marked_by: me().id, marked_at: now() });
      markDirty(meetingId);
      save();
    },
    async scanAttendance(meetingId, payload, scannedAt) {
      await delay(80);
      deny(hasPerm(me(), 'scan'), 'Brak uprawnień do sprawdzania obecności');
      const p = parsePayload(payload);
      if (!p) return { ok: false, error: 'To nie jest kod obecności Kulturki' };
      const scanW = currentWindow(new Date(scannedAt || Date.now()).getTime());
      if (Math.abs(scanW - p.window) > 2)
        return { ok: false, error: 'Kod wygasł – poproś o odświeżenie kodu (to może być zrzut ekranu)' };
      const secret = db.secrets[p.userId];
      if (!secret || (await hmacHex(secret, String(p.window))).slice(0, 10) !== p.code)
        return { ok: false, error: 'Nieprawidłowy kod' };
      const u = db.users.find((x) => x.id === p.userId);
      if (!isActive(u)) return { ok: false, error: 'Ta osoba nie jest aktywnym członkiem' };
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
  };
}
