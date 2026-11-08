import { createClient } from '@supabase/supabase-js';

const one = (x) => (Array.isArray(x) ? x[0] || null : x || null);
const withPoll = (rows) => (rows || []).map((r) => ({ ...r, poll: one(r.poll) }));
const AUTHOR = 'author:profiles!author_id(id, full_name, avatar_url)';

const PROFILE_SELECT =
  '*, assignments:custom_role_assignments!user_id(id, expires_at, role_id, role:custom_roles(*))';

function check({ data, error }) {
  if (error) throw new Error(translateError(error.message));
  return data;
}

function translateError(msg = '') {
  const map = [
    ['Invalid login credentials', 'Nieprawidłowy e-mail lub hasło'],
    ['Email not confirmed', 'Potwierdź adres e-mail (sprawdź skrzynkę)'],
    ['User already registered', 'Konto z tym adresem już istnieje'],
    ['Password should be at least', 'Hasło musi mieć co najmniej 8 znaków'],
    ['Database error saving new user', 'Nie udało się utworzyć konta – sprawdź, czy używasz właściwej domeny e-mail'],
    ['rate limit', 'Zbyt wiele prób – spróbuj ponownie za chwilę'],
  ];
  for (const [en, pl] of map) if (msg.toLowerCase().includes(en.toLowerCase())) return pl;
  return msg;
}

export function createSupabaseApi(url, anonKey) {
  const sb = createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
  });

  const uid = async () => (await sb.auth.getSession()).data.session?.user?.id;

  return {
    mode: 'supabase',

    // ---------- auth ----------
    async getSession() {
      const { data } = await sb.auth.getSession();
      return data.session ? { userId: data.session.user.id, email: data.session.user.email } : null;
    },
    onAuthChange(cb) {
      const { data } = sb.auth.onAuthStateChange((event, session) => {
        // setTimeout: nie wolno czekać na inne wywołania Supabase wewnątrz tego callbacku
        setTimeout(() => cb(session ? { userId: session.user.id, email: session.user.email } : null, event), 0);
      });
      return () => data.subscription.unsubscribe();
    },
    async signUp({ email, password, fullName, consent }) {
      const res = await sb.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName, consent: consent ? 'true' : 'false' },
          emailRedirectTo: window.location.origin + window.location.pathname,
        },
      });
      const data = check(res);
      return { needsConfirmation: !data.session };
    },
    async signIn({ email, password }) {
      check(await sb.auth.signInWithPassword({ email, password }));
    },
    async signOut() {
      await sb.auth.signOut();
    },
    async resetPassword(email) {
      check(
        await sb.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + window.location.pathname + '?reset=1',
        })
      );
    },
    async updatePassword(password) {
      check(await sb.auth.updateUser({ password }));
    },
    async getPublicSettings() {
      return check(await sb.rpc('get_public_settings')) || {};
    },

    // ---------- me ----------
    async getMyProfile() {
      const id = await uid();
      if (!id) return null;
      return check(await sb.from('profiles').select(PROFILE_SELECT).eq('id', id).maybeSingle());
    },
    async updateProfile(id, patch) {
      return check(await sb.from('profiles').update(patch).eq('id', id).select(PROFILE_SELECT).single());
    },
    async uploadAvatar(blob) {
      const id = await uid();
      const path = `${id}/avatar-${Date.now()}.jpg`;
      check(await sb.storage.from('avatars').upload(path, blob, { contentType: 'image/jpeg', upsert: true }));
      return sb.storage.from('avatars').getPublicUrl(path).data.publicUrl;
    },
    async getMyQrSecret() {
      const id = await uid();
      const row = check(await sb.from('qr_secrets').select('secret').eq('user_id', id).maybeSingle());
      return row?.secret || null;
    },
    async regenerateQrSecret() {
      check(await sb.rpc('regenerate_qr_secret'));
    },
    async deleteMyAccount() {
      check(await sb.rpc('delete_my_account'));
      await sb.auth.signOut();
    },

    // ---------- profiles ----------
    async listProfiles() {
      return check(await sb.from('profiles').select(PROFILE_SELECT).order('full_name'));
    },
    async getProfile(id) {
      return check(await sb.from('profiles').select(PROFILE_SELECT).eq('id', id).maybeSingle());
    },
    async setRole(id, role) {
      check(await sb.from('profiles').update({ role }).eq('id', id));
    },

    // ---------- custom roles ----------
    async listCustomRoles() {
      return check(await sb.from('custom_roles').select('*').order('created_at'));
    },
    async saveCustomRole(role) {
      const { id, ...rest } = role;
      if (id) return check(await sb.from('custom_roles').update(rest).eq('id', id).select().single());
      return check(await sb.from('custom_roles').insert({ ...rest, created_by: await uid() }).select().single());
    },
    async deleteCustomRole(id) {
      check(await sb.from('custom_roles').delete().eq('id', id));
    },
    async grantCustomRole(userId, roleId, expiresAt) {
      check(
        await sb
          .from('custom_role_assignments')
          .insert({ user_id: userId, role_id: roleId, expires_at: expiresAt || null, granted_by: await uid() })
      );
    },
    async revokeCustomRole(assignmentId) {
      check(await sb.from('custom_role_assignments').delete().eq('id', assignmentId));
    },

    // ---------- announcements ----------
    async listAnnouncements() {
      return withPoll(check(
        await sb
          .from('announcements')
          .select(`*, ${AUTHOR}, poll:availability_polls(*)`)
          .order('pinned', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(200)
      )
      );
    },
    async createAnnouncement({ title, body, notify }) {
      return check(await sb.from('announcements').insert({ title, body, notify: !!notify }).select().single());
    },
    async updateAnnouncement(id, patch) {
      check(await sb.from('announcements').update(patch).eq('id', id));
    },
    async deleteAnnouncement(id) {
      check(await sb.from('announcements').delete().eq('id', id));
    },

    // ---------- meetings ----------
    async listMeetings() {
      return check(await sb.from('meetings').select('*').order('starts_at'));
    },
    async getMeeting(id) {
      return check(await sb.from('meetings').select('*').eq('id', id).maybeSingle());
    },
    async saveMeeting(m) {
      const { id, ...rest } = m;
      delete rest.dirty;
      delete rest.synced_at;
      delete rest.sheet_url;
      delete rest.created_at;
      delete rest.updated_at;
      delete rest.created_by;
      if (id) return check(await sb.from('meetings').update(rest).eq('id', id).select().single());
      return check(await sb.from('meetings').insert(rest).select().single());
    },
    async deleteMeeting(id) {
      check(await sb.from('meetings').delete().eq('id', id));
    },

    async listMeetingAccess(meetingId) {
      return check(await sb.from('meeting_role_access').select('*, role:custom_roles(*)').eq('meeting_id', meetingId));
    },
    async setMeetingAccess(meetingId, roleId, { can_edit, can_scan }) {
      check(
        await sb
          .from('meeting_role_access')
          .upsert(
            { meeting_id: meetingId, role_id: roleId, can_edit, can_scan, granted_by: await uid() },
            { onConflict: 'meeting_id,role_id' }
          )
      );
    },
    async removeMeetingAccess(meetingId, roleId) {
      check(await sb.from('meeting_role_access').delete().eq('meeting_id', meetingId).eq('role_id', roleId));
    },

    // ---------- attendance ----------
    async listAttendance(meetingId) {
      return check(await sb.from('attendance').select('*').eq('meeting_id', meetingId));
    },
    async listMyAttendance() {
      const id = await uid();
      return check(await sb.from('attendance').select('*').eq('user_id', id));
    },
    async listAllAttendance() {
      return check(await sb.from('attendance').select('*'));
    },
    async setAttendance(meetingId, userId, present) {
      if (present === null) {
        check(await sb.from('attendance').delete().eq('meeting_id', meetingId).eq('user_id', userId));
        return;
      }
      check(
        await sb
          .from('attendance')
          .upsert({ meeting_id: meetingId, user_id: userId, present, method: 'manual' }, { onConflict: 'meeting_id,user_id' })
      );
    },
    async scanAttendance(meetingId, payload, scannedAt) {
      return check(
        await sb.rpc('scan_attendance', { p_meeting: meetingId, p_payload: payload, p_scanned_at: scannedAt })
      );
    },

    // ---------- settings / admin ----------
    async getSettings() {
      return check(await sb.from('app_settings').select('*').eq('id', 1).maybeSingle()) || {};
    },
    async updateSettings(patch) {
      check(await sb.from('app_settings').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', 1));
    },
    async listAudit() {
      return check(await sb.from('audit_log').select('*').order('created_at', { ascending: false }).limit(100));
    },

    // ---------- wydarzenia ----------
    async listEvents() {
      return check(await sb.from('events').select('*').order('starts_at', { ascending: true, nullsFirst: false }));
    },
    async getEvent(id) {
      return check(await sb.from('events').select('*').eq('id', id).maybeSingle());
    },
    async saveEvent(e) {
      const { id, created_by, created_at, ...rest } = e;
      if (id) return check(await sb.from('events').update(rest).eq('id', id).select().single());
      return check(await sb.from('events').insert(rest).select().single());
    },
    async deleteEvent(id) {
      check(await sb.from('events').delete().eq('id', id));
    },
    async listEventMembers(eventId) {
      return check(
        await sb
          .from('event_members')
          .select('*, profile:profiles!user_id(id, full_name, avatar_url, email, phone, show_phone, study_field, role)')
          .eq('event_id', eventId)
      );
    },
    async listMyEventMemberships() {
      const id = await uid();
      return check(await sb.from('event_members').select('*').eq('user_id', id));
    },
    async listAllEventMembers() {
      return check(await sb.from('event_members').select('event_id, user_id, role, status'));
    },
    async applyToEvent(eventId, role, note) {
      check(await sb.from('event_members').insert({ event_id: eventId, user_id: await uid(), role, note, status: 'applied' }));
    },
    async addEventMember(eventId, userId, role) {
      check(
        await sb
          .from('event_members')
          .upsert({ event_id: eventId, user_id: userId, role, status: 'accepted' }, { onConflict: 'event_id,user_id' })
      );
    },
    async updateEventMember(eventId, userId, patch) {
      check(await sb.from('event_members').update(patch).eq('event_id', eventId).eq('user_id', userId));
    },
    async removeEventMember(eventId, userId) {
      check(await sb.from('event_members').delete().eq('event_id', eventId).eq('user_id', userId));
    },
    async listEventAnnouncements(eventId) {
      return withPoll(check(
        await sb
          .from('event_announcements')
          .select(`*, ${AUTHOR}, poll:availability_polls(*)`)
          .eq('event_id', eventId)
          .order('pinned', { ascending: false })
          .order('created_at', { ascending: false })
      )
      );
    },
    async createEventAnnouncement({ event_id, title, body, notify }) {
      return check(
        await sb.from('event_announcements').insert({ event_id, title, body, notify: !!notify }).select().single()
      );
    },
    async updateEventAnnouncement(id, patch) {
      check(await sb.from('event_announcements').update(patch).eq('id', id));
    },
    async deleteEventAnnouncement(id) {
      check(await sb.from('event_announcements').delete().eq('id', id));
    },

    // ---------- ankiety dostępności ----------
    async createPoll(poll) {
      return check(await sb.from('availability_polls').insert({ ...poll, created_by: await uid() }).select().single());
    },
    async deletePoll(id) {
      check(await sb.from('availability_polls').delete().eq('id', id));
    },
    async listPollResponses(pollId) {
      return check(
        await sb
          .from('availability_responses')
          .select('*, profile:profiles!user_id(id, full_name, avatar_url)')
          .eq('poll_id', pollId)
      );
    },
    async saveMyAvailability(pollId, slots, note) {
      check(
        await sb
          .from('availability_responses')
          .upsert({ poll_id: pollId, user_id: await uid(), slots, note }, { onConflict: 'poll_id,user_id' })
      );
    },
    async deleteMyAvailability(pollId) {
      check(await sb.from('availability_responses').delete().eq('poll_id', pollId).eq('user_id', await uid()));
    },

    // ---------- zgłoszenia problemów, aktywność ----------
    async sendFeedback(message, page) {
      check(await sb.from('feedback').insert({ user_id: await uid(), message, page }));
    },
    async listFeedback() {
      return check(
        await sb
          .from('feedback')
          .select('*, author:profiles!user_id(id, full_name, avatar_url)')
          .order('created_at', { ascending: false })
          .limit(200)
      );
    },
    async resolveFeedback(id, resolved = true) {
      check(await sb.from('feedback').update({ resolved }).eq('id', id));
    },
    async touchSeen() {
      await sb.rpc('touch_seen');
    },

    // ---------- kulturkowe sprawy ----------
    async submitCase({ category, category_other, description, anonymous }) {
      return check(
        await sb.rpc('submit_case', {
          p_category: category,
          p_category_other: category_other || '',
          p_description: description,
          p_anonymous: !!anonymous,
        })
      );
    },
    async myCases(tokens) {
      const [byToken, own] = await Promise.all([
        tokens.length ? sb.rpc('case_status', { p_tokens: tokens }).then(check) : [],
        sb
          .from('cases')
          .select('id, category, category_other, anonymous, status, response, created_at, updated_at')
          .eq('reporter_id', await uid())
          .then(check),
      ]);
      const map = new Map();
      [...(byToken || []), ...(own || [])].forEach((c) => map.set(c.id, c));
      return [...map.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
    },
    async listCases() {
      const [rows, notes] = await Promise.all([
        sb
          .from('cases')
          .select(
            'id, category, category_other, description, anonymous, reporter_id, status, priority, assigned_to, response, created_at, updated_at, resolved_at, ' +
              'reporter:profiles!reporter_id(id, full_name, avatar_url), assignee:profiles!assigned_to(id, full_name, avatar_url)'
          )
          .order('created_at', { ascending: false })
          .limit(500)
          .then(check),
        sb.rpc('case_board_notes').then(check),
      ]);
      const n = Object.fromEntries((notes || []).map((x) => [x.id, x.board_note]));
      return rows.map((r) => ({ ...r, board_note: n[r.id] || '' }));
    },
    async updateCase(id, patch) {
      check(await sb.from('cases').update(patch).eq('id', id));
    },
    async deleteCase(id) {
      check(await sb.from('cases').delete().eq('id', id));
    },
    async countNewCases() {
      const { count, error } = await sb.from('cases').select('id', { count: 'exact', head: true }).eq('status', 'new');
      if (error) return 0;
      return count || 0;
    },
  };
}
