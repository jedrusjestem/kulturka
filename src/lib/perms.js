export const ROLE_LABELS = {
  pending: 'Oczekuje na akceptację',
  member: 'Członek',
  board: 'Zarząd',
  chair: 'Przewodniczący',
  rejected: 'Odrzucony',
  alumni: 'Absolwent / były członek',
};

export const ROLE_ORDER = { chair: 0, board: 1, member: 2, alumni: 3, pending: 4, rejected: 5 };

export function activeAssignments(profile) {
  const t = Date.now();
  return (profile?.assignments || []).filter((a) => !a.expires_at || new Date(a.expires_at).getTime() > t);
}

export function computePerms(profile) {
  const role = profile?.role;
  const active = ['member', 'board', 'chair'].includes(role);
  const board = ['board', 'chair'].includes(role);
  const chair = role === 'chair';
  const custom = active ? activeAssignments(profile).map((a) => a.role) : [];
  const any = (f) => board || custom.some((r) => r?.[f]);
  return {
    active,
    board,
    chair,
    postImportant: any('can_post_important'),
    scan: any('can_scan'),
    manageMeetings: any('can_manage_meetings'),
  };
}
