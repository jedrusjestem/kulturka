import { createClient } from '@supabase/supabase-js';

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
      return check(
        await sb
          .from('announcements')
          .select('*, author:profiles!author_id(id, full_name, avatar_url)')
          .order('pinned', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(200)
      );
    },
    async createAnnouncement({ title, body }) {
      return check(await sb.from('announcements').insert({ title, body }).select().single());
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
  };
}
