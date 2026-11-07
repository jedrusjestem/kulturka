export const ROLE_LABELS = {
  pending: 'Oczekuje na akceptację',
  member: 'Członek',
  board: 'Zarząd',
  chair: 'Przewodniczący',
  admin: 'Administrator',
  rejected: 'Odrzucony',
  alumni: 'Absolwent / były członek',
};

export const ROLE_ORDER = { admin: 0, chair: 1, board: 2, member: 3, alumni: 4, pending: 5, rejected: 6 };

/** Role z dostępem do aplikacji */
export const ACTIVE_ROLES = ['member', 'board', 'chair', 'admin'];
export const isActiveRole = (r) => ACTIVE_ROLES.includes(r);
/** Role liczone jako członkowie komisji (administrator NIE jest członkiem) */
export const MEMBER_ROLES = ['member', 'board', 'chair'];
export const isMemberRole = (r) => MEMBER_ROLES.includes(r);

export function activeAssignments(profile) {
  const t = Date.now();
  return (profile?.assignments || []).filter((a) => !a.expires_at || new Date(a.expires_at).getTime() > t);
}

export function computePerms(profile) {
  const role = profile?.role;
  const active = ACTIVE_ROLES.includes(role);
  const board = ['board', 'chair', 'admin'].includes(role);
  const chair = ['chair', 'admin'].includes(role); // uprawnienia przewodniczącego (ma je też admin)
  const admin = role === 'admin';
  const custom = active ? activeAssignments(profile).map((a) => a.role) : [];
  const any = (f) => board || custom.some((r) => r?.[f]);
  return {
    active,
    board,
    chair,
    admin,
    postImportant: any('can_post_important'),
    scan: any('can_scan'),
    manageMeetings: any('can_manage_meetings'),
    editOwn: any('can_edit_own'),
  };
}

export const EVENT_ROLE_LABELS = { coordinator: 'Koordynator główny', staff: 'Sztab', crew: 'Kadra' };

/**
 * Uprawnienia w wydarzeniu. Koordynator główny = przewodniczący wydarzenia, sztab = zarząd wydarzenia,
 * kadra = członkowie. Przewodniczący/admin komisji mają pełnię uprawnień, zarząd komisji – żadnych dodatkowych.
 */
export function eventPerms(perms, membership) {
  const role = membership?.status === 'accepted' ? membership.role : null;
  const admin = perms.chair || (perms.active && role === 'coordinator');
  const staff = admin || (perms.active && role === 'staff');
  const member = staff || (perms.active && !!role);
  return { role, admin, staff, member };
}

/** Uprawnienia do konkretnego spotkania (globalne + nadane roli dla tego spotkania + własne spotkanie) */
export function meetingPerms(profile, perms, meeting, access = [], eventMembership = null) {
  const myRoleIds = activeAssignments(profile).map((a) => a.role_id || a.role?.id);
  const viaRole = (f) => perms.active && access.some((x) => myRoleIds.includes(x.role_id) && x[f]);
  if (meeting?.event_id) {
    const ep = eventPerms(perms, eventMembership);
    return { edit: ep.staff || viaRole('can_edit'), scan: ep.staff || viaRole('can_scan'), del: ep.admin };
  }
  return {
    del: perms.manageMeetings,
    edit: perms.manageMeetings || viaRole('can_edit') || (perms.editOwn && !!meeting && meeting.created_by === profile?.id),
    scan: perms.scan || viaRole('can_scan'),
  };
}
