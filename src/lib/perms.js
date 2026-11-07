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

/** Uprawnienia do konkretnego spotkania (globalne + nadane roli dla tego spotkania + własne spotkanie) */
export function meetingPerms(profile, perms, meeting, access = []) {
  const myRoleIds = activeAssignments(profile).map((a) => a.role_id || a.role?.id);
  const viaRole = (f) => perms.active && access.some((x) => myRoleIds.includes(x.role_id) && x[f]);
  return {
    edit: perms.manageMeetings || viaRole('can_edit') || (perms.editOwn && !!meeting && meeting.created_by === profile?.id),
    scan: perms.scan || viaRole('can_scan'),
  };
}
