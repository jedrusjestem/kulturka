import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  UserCheck, UserX, Users, Tags, Settings, Download, History, Plus, Trash2, Pencil, X, Search, FolderOpen, RefreshCw, Info, Check,
} from 'lucide-react';
import { api, isDemo } from '../api';
import { useAuth } from '../auth';
import { Avatar, CustomRoleBadges, Empty, Modal, RoleBadge, Spinner, hexA, useConfirm, useToast } from '../components/ui';
import { ROLE_LABELS, ROLE_ORDER, activeAssignments, isActiveRole } from '../lib/perms';
import { fmtDate, fmtDateTime, normalize, relTime } from '../lib/format';
import { downloadCsv } from '../lib/csv';
import { requestSync } from './MeetingDetail';

const COLORS = ['#45B0E5', '#2394D0', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#EF4444', '#64748B'];

export default function Admin() {
  const { perms, counts, refreshCounts } = useAuth();
  const [tab, setTab] = useState(counts.pendingMembers ? 'pending' : 'members');
  const [people, setPeople] = useState(null);
  const [roles, setRoles] = useState([]);

  const load = useCallback(async () => {
    const [p, r] = await Promise.all([api.listProfiles(), api.listCustomRoles()]);
    setPeople(p);
    setRoles(r);
    refreshCounts();
  }, [refreshCounts]);

  useEffect(() => {
    load().catch(console.error);
  }, [load]);

  const tabs = [
    ['pending', UserCheck, 'Zgłoszenia', counts.pendingMembers],
    ['members', Users, 'Członkowie i role'],
    ['roles', Tags, 'Role tymczasowe'],
    ['settings', Settings, 'Google i ustawienia'],
    ['export', Download, 'Eksport'],
    ['audit', History, 'Dziennik'],
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Panel zarządu</h1>
          <p>Akceptacja członków, role, integracja z Google i eksport danych.</p>
        </div>
      </div>
      <div className="tabs" style={{ marginBottom: 18 }}>
        {tabs.map(([key, Icon, label, count]) => (
          <button key={key} className={`tab ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)}>
            <Icon size={16} /> {label} {count > 0 && <span className="count">{count}</span>}
          </button>
        ))}
      </div>
      {!people ? (
        <Spinner center />
      ) : tab === 'pending' ? (
        <PendingTab people={people} reload={load} />
      ) : tab === 'members' ? (
        <MembersTab people={people} roles={roles} reload={load} perms={perms} />
      ) : tab === 'roles' ? (
        <RolesTab roles={roles} people={people} reload={load} />
      ) : tab === 'settings' ? (
        <SettingsTab canEdit={perms.chair} />
      ) : tab === 'export' ? (
        <ExportTab people={people} />
      ) : (
        <AuditTab people={people} />
      )}
    </>
  );
}

// ---------------------------------------------------------------------
function PendingTab({ people, reload }) {
  const toast = useToast();
  const pending = people.filter((p) => p.role === 'pending');
  const act = async (p, role) => {
    try {
      await api.setRole(p.id, role);
      toast.success(role === 'member' ? `${p.full_name} jest teraz członkiem komisji` : 'Zgłoszenie odrzucone');
      reload();
    } catch (e) {
      toast.error(e);
    }
  };
  if (!pending.length)
    return (
      <div className="card">
        <Empty icon={UserCheck} title="Brak nowych zgłoszeń">
          Nowe osoby po rejestracji pojawią się tutaj.
        </Empty>
      </div>
    );
  return (
    <div className="card list">
      {pending.map((p) => (
        <div key={p.id} className="list-item" style={{ flexWrap: 'wrap' }}>
          <Avatar profile={p} size={46} />
          <div style={{ flex: '1 1 200px', minWidth: 0 }}>
            <b>{p.full_name}</b>
            <div className="small muted truncate">{p.email}</div>
            <div className="tiny muted">
              {[p.faculty, p.study_field, p.study_year, `zgłoszenie ${relTime(p.created_at)}`, !p.consent_at && 'brak zgody RODO']
                .filter(Boolean)
                .join(' · ')}
            </div>
          </div>
          <div className="row">
            <button className="btn btn-success btn-sm" onClick={() => act(p, 'member')}>
              <UserCheck size={16} /> Akceptuj
            </button>
            <button className="btn btn-danger btn-sm" onClick={() => act(p, 'rejected')}>
              <UserX size={16} /> Odrzuć
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------
function MembersTab({ people, roles, reload, perms }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [q, setQ] = useState('');
  const [grantFor, setGrantFor] = useState(null);
  const list = useMemo(
    () =>
      people
        .filter((p) => p.role !== 'pending')
        .filter((p) => !q || normalize(p.full_name + ' ' + p.email).includes(normalize(q)))
        .sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.full_name.localeCompare(b.full_name, 'pl')),
    [people, q]
  );

  const roleOptions = (p) => {
    const all = ['member', 'board', 'chair', 'admin', 'alumni', 'rejected'];
    if (perms.admin) return all;
    // tylko administrator nadaje/odbiera rolę administratora
    if (p.role === 'admin') return ['admin'];
    if (perms.chair) return all.filter((r) => r !== 'admin');
    // zarząd nie może ruszać ról zarządu/przewodniczącego
    if (['board', 'chair'].includes(p.role)) return [p.role];
    return ['member', 'alumni', 'rejected'];
  };

  const changeRole = async (p, role) => {
    if (role === p.role) return;
    if (role === 'chair' && !(await confirm(`Nadać ${p.full_name} rolę przewodniczącego (pełne uprawnienia w komisji)?`))) return;
    if (role === 'admin' && !(await confirm(`Nadać ${p.full_name} rolę administratora (pełny dostęp techniczny do aplikacji)?`))) return;
    try {
      await api.setRole(p.id, role);
      toast.success(`Zmieniono rolę: ${ROLE_LABELS[role]}`);
      reload();
    } catch (e) {
      toast.error(e);
    }
  };

  return (
    <>
      <div className="input-icon" style={{ marginBottom: 14, maxWidth: 380 }}>
        <Search size={17} />
        <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Szukaj członka…" />
      </div>
      <div className="card table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Osoba</th>
              <th>Rola</th>
              <th>Role tymczasowe</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id}>
                <td>
                  <Link to={`/u/${p.id}`} className="row" style={{ color: 'inherit', minWidth: 200 }}>
                    <Avatar profile={p} size={34} />
                    <div style={{ minWidth: 0 }}>
                      <b className="small">{p.full_name}</b>
                      <div className="tiny muted truncate" style={{ maxWidth: 220 }}>
                        {p.email}
                      </div>
                    </div>
                  </Link>
                </td>
                <td>
                  <select className="select" style={{ minHeight: 36, padding: '4px 10px', width: 'auto', fontSize: 14 }} value={p.role}
                    onChange={(e) => changeRole(p, e.target.value)} disabled={roleOptions(p).length < 2}>
                    {roleOptions(p).map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <div className="row row-wrap" style={{ gap: 6, minWidth: 180 }}>
                    {(p.assignments || []).map((a) => {
                      const expired = a.expires_at && new Date(a.expires_at) < new Date();
                      return (
                        <span key={a.id} className="badge" style={{ background: hexA(a.role.color, 0.14), opacity: expired ? 0.5 : 1 }}
                          title={a.expires_at ? `do ${fmtDate(a.expires_at)}` : 'bezterminowo'}>
                          <span className="color-dot" style={{ background: a.role.color, width: 8, height: 8 }} />
                          {a.role.name}
                          {a.expires_at && <span style={{ fontWeight: 500 }}>{expired ? '(wygasła)' : `do ${new Date(a.expires_at).toLocaleDateString('pl-PL')}`}</span>}
                          <button
                            style={{ border: 0, background: 'none', cursor: 'pointer', padding: 0, display: 'grid', color: 'inherit' }}
                            aria-label="Odbierz rolę"
                            onClick={async () => {
                              try {
                                await api.revokeCustomRole(a.id);
                                reload();
                              } catch (e) {
                                toast.error(e);
                              }
                            }}
                          >
                            <X size={13} />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                </td>
                <td className="nowrap" style={{ textAlign: 'right' }}>
                  {isActiveRole(p.role) && roles.length > 0 && (
                    <button className="btn btn-ghost btn-sm" onClick={() => setGrantFor(p)}>
                      <Plus size={15} /> Rola
                    </button>
                  )}
                  <Link to={`/ja/edytuj?u=${p.id}`} className="btn btn-ghost btn-sm btn-icon" aria-label="Edytuj profil" style={{ marginLeft: 6 }}>
                    <Pencil size={15} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {grantFor && <GrantModal person={grantFor} roles={roles} onClose={() => setGrantFor(null)} onDone={() => { setGrantFor(null); reload(); }} />}
    </>
  );
}

function GrantModal({ person, roles, onClose, onDone }) {
  const toast = useToast();
  const [roleId, setRoleId] = useState(roles[0]?.id || '');
  const [until, setUntil] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [forever, setForever] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.grantCustomRole(person.id, roleId, forever ? null : new Date(until + 'T23:59:59').toISOString());
      toast.success('Nadano rolę');
      onDone();
    } catch (err) {
      toast.error(err);
    }
  };
  return (
    <Modal
      title={`Nadaj rolę – ${person.full_name}`}
      onClose={onClose}
      width={460}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            Anuluj
          </button>
          <button className="btn btn-primary" form="grant-form">
            Nadaj
          </button>
        </>
      }
    >
      <form id="grant-form" className="stack" onSubmit={submit}>
        <div className="field">
          <label>Rola</label>
          <select className="select" value={roleId} onChange={(e) => setRoleId(e.target.value)}>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Ważna do</label>
          <input className="input" type="date" value={until} onChange={(e) => setUntil(e.target.value)} disabled={forever}
            min={new Date().toISOString().slice(0, 10)} />
        </div>
        <label className="check">
          <input type="checkbox" checked={forever} onChange={(e) => setForever(e.target.checked)} />
          <span>Bezterminowo</span>
        </label>
        <p className="hint">Po upływie terminu rola i jej uprawnienia wygasają automatycznie.</p>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------
function RolesTab({ roles, people, reload }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [edit, setEdit] = useState(null);
  const holders = (r) => people.filter((p) => activeAssignments(p).some((a) => a.role_id === r.id || a.role?.id === r.id));
  return (
    <>
      <div className="row" style={{ marginBottom: 14 }}>
        <p className="muted small" style={{ flex: 1 }}>
          Role niestandardowe (np. „Koordynator wydarzenia”) nadawane na określony czas. Mogą dawać dodatkowe uprawnienia.
        </p>
        <button className="btn btn-primary" onClick={() => setEdit({ name: '', color: COLORS[0], description: '', can_post_important: false, can_scan: false, can_manage_meetings: false })}>
          <Plus size={17} /> Nowa rola
        </button>
      </div>
      {roles.length === 0 ? (
        <div className="card">
          <Empty icon={Tags} title="Brak ról tymczasowych" />
        </div>
      ) : (
        <div className="grid grid-2">
          {roles.map((r) => (
            <div key={r.id} className="card card-pad" style={{ borderTop: `4px solid ${r.color}` }}>
              <div className="row">
                <h3 style={{ flex: 1 }}>{r.name}</h3>
                <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setEdit(r)} aria-label="Edytuj">
                  <Pencil size={15} />
                </button>
                <button
                  className="btn btn-ghost btn-icon btn-sm"
                  aria-label="Usuń"
                  onClick={async () => {
                    if (await confirm({ message: `Usunąć rolę „${r.name}”? Zostanie odebrana wszystkim osobom.`, danger: true, confirmText: 'Usuń' })) {
                      try {
                        await api.deleteCustomRole(r.id);
                        reload();
                      } catch (e) {
                        toast.error(e);
                      }
                    }
                  }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
              {r.description && <p className="small muted" style={{ marginTop: 4 }}>{r.description}</p>}
              <div className="row row-wrap" style={{ gap: 6, marginTop: 10 }}>
                {r.can_post_important && <span className="badge badge-board">Publikuje w „Ważne”</span>}
                {r.can_scan && <span className="badge badge-board">Sprawdza obecność</span>}
                {r.can_manage_meetings && <span className="badge badge-board">Zarządza spotkaniami</span>}
                {!r.can_post_important && !r.can_scan && !r.can_manage_meetings && <span className="badge">Bez dodatkowych uprawnień</span>}
              </div>
              <div className="row" style={{ marginTop: 12 }}>
                {holders(r).slice(0, 6).map((p) => (
                  <Avatar key={p.id} profile={p} size={28} />
                ))}
                <span className="small muted">{holders(r).length} os.</span>
              </div>
            </div>
          ))}
        </div>
      )}
      {edit && <RoleModal role={edit} onClose={() => setEdit(null)} onDone={() => { setEdit(null); reload(); }} />}
    </>
  );
}

function RoleModal({ role, onClose, onDone }) {
  const toast = useToast();
  const [r, setR] = useState(role);
  const set = (k) => (e) => setR((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    try {
      const { id, name, color, description, can_post_important, can_scan, can_manage_meetings } = r;
      await api.saveCustomRole({ id, name: name.trim(), color, description: description.trim(), can_post_important, can_scan, can_manage_meetings });
      toast.success('Zapisano rolę');
      onDone();
    } catch (err) {
      toast.error(err);
    }
  };
  return (
    <Modal
      title={role.id ? 'Edytuj rolę' : 'Nowa rola'}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            Anuluj
          </button>
          <button className="btn btn-primary" form="role-form" disabled={!r.name.trim()}>
            Zapisz
          </button>
        </>
      }
    >
      <form id="role-form" className="stack" onSubmit={submit}>
        <div className="field">
          <label>Nazwa</label>
          <input className="input" value={r.name} onChange={set('name')} maxLength={60} required placeholder="np. Koordynator Nocy Kultury" />
        </div>
        <div className="field">
          <label>Kolor</label>
          <div className="swatches">
            {COLORS.map((c) => (
              <button type="button" key={c} className={`swatch ${r.color === c ? 'on' : ''}`} style={{ background: c }}
                onClick={() => setR((x) => ({ ...x, color: c }))} aria-label={c} />
            ))}
          </div>
        </div>
        <div className="field">
          <label>Opis</label>
          <input className="input" value={r.description} onChange={set('description')} />
        </div>
        <div className="label">Uprawnienia</div>
        <label className="check">
          <input type="checkbox" checked={r.can_post_important} onChange={set('can_post_important')} />
          <span>Publikuje w „Ważne” bez akceptacji zarządu</span>
        </label>
        <label className="check">
          <input type="checkbox" checked={r.can_scan} onChange={set('can_scan')} />
          <span>Sprawdza obecność (skaner QR, ręczne zaznaczanie)</span>
        </label>
        <label className="check">
          <input type="checkbox" checked={r.can_manage_meetings} onChange={set('can_manage_meetings')} />
          <span>Tworzy i edytuje spotkania</span>
        </label>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------
function parseFolderId(v) {
  const m = String(v).match(/folders\/([\w-]{10,})/) || String(v).match(/[?&]id=([\w-]{10,})/);
  return m ? m[1] : String(v).trim();
}
function parseDocId(v) {
  const m = String(v).match(/\/d\/([\w-]{10,})/);
  return m ? m[1] : String(v).trim();
}

function SettingsTab({ canEdit }) {
  const toast = useToast();
  const [s, setS] = useState(null);
  useEffect(() => {
    api.getSettings().then(setS).catch((e) => toast.error(e));
  }, [toast]);
  if (!s) return <Spinner center />;
  const set = (k) => (e) => setS((x) => ({ ...x, [k]: e.target.value }));
  const save = async (e) => {
    e.preventDefault();
    try {
      await api.updateSettings({
        committee_name: s.committee_name.trim(),
        allowed_email_domain: s.allowed_email_domain.trim().replace(/^@/, '').toLowerCase(),
        drive_folder_id: parseFolderId(s.drive_folder_id),
        apps_script_url: s.apps_script_url.trim(),
        agenda_template_id: parseDocId(s.agenda_template_id),
      });
      toast.success('Zapisano ustawienia');
      setS(await api.getSettings());
    } catch (err) {
      toast.error(err);
    }
  };
  return (
    <form className="stack" style={{ gap: 18 }} onSubmit={save}>
      {!canEdit && (
        <div className="alert">
          <Info size={18} /> Ustawienia może zmieniać tylko przewodniczący lub administrator.
        </div>
      )}
      <div className="card card-pad stack">
        <h3>Google Drive – agendy i listy obecności</h3>
        <div className="alert" style={{ fontSize: 13.5 }}>
          <Info size={18} />
          <div>
            Synchronizację wykonuje skrypt Google Apps Script działający na koncie Google komisji (instrukcja w pliku <b>docs/GOOGLE.md</b>). Co kilka minut
            tworzy agendy (Google Docs) i arkusze obecności (Google Sheets) w folderze poniżej oraz uzupełnia zbiorczą frekwencję.
          </div>
        </div>
        <div className="field">
          <label>Folder na Google Drive (link lub ID)</label>
          <div className="input-icon">
            <FolderOpen size={18} />
            <input className="input" value={s.drive_folder_id} onChange={set('drive_folder_id')} disabled={!canEdit}
              placeholder="https://drive.google.com/drive/folders/…" />
          </div>
          <span className="hint">Konto Google, na którym działa skrypt, musi mieć do tego folderu uprawnienia edycji.</span>
        </div>
        <div className="field">
          <label>Szablon agendy (opcjonalnie, link do Google Docs)</label>
          <input className="input" value={s.agenda_template_id} onChange={set('agenda_template_id')} disabled={!canEdit}
            placeholder="https://docs.google.com/document/d/…" />
        </div>
        <div className="field">
          <label>Adres wdrożonego Apps Script (do „Synchronizuj teraz”)</label>
          <input className="input" value={s.apps_script_url} onChange={set('apps_script_url')} disabled={!canEdit}
            placeholder="https://script.google.com/macros/s/…/exec" />
        </div>
        <div className="row row-wrap">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={async () => {
              const ok = await requestSync();
              toast(ok ? 'Wysłano żądanie synchronizacji' : 'Najpierw zapisz adres Apps Script');
            }}
          >
            <RefreshCw size={16} /> Synchronizuj teraz
          </button>
          {s.drive_folder_id && (
            <a className="btn btn-ghost" href={`https://drive.google.com/drive/folders/${s.drive_folder_id}`} target="_blank" rel="noopener noreferrer">
              <FolderOpen size={16} /> Otwórz folder
            </a>
          )}
        </div>
      </div>

      <div className="card card-pad stack">
        <h3>Rejestracja i komisja</h3>
        <div className="field">
          <label>Nazwa komisji</label>
          <input className="input" value={s.committee_name} onChange={set('committee_name')} disabled={!canEdit} />
        </div>
        <div className="field">
          <label>Dozwolona domena e-mail przy rejestracji</label>
          <input className="input" value={s.allowed_email_domain} onChange={set('allowed_email_domain')} disabled={!canEdit} placeholder="student.pwr.edu.pl" />
          <span className="hint">Puste = dowolny adres. Zalecane: student.pwr.edu.pl (ogranicza spam w zgłoszeniach).</span>
        </div>
      </div>

      {canEdit && (
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-primary">
            <Check size={17} /> Zapisz ustawienia
          </button>
        </div>
      )}
      {isDemo && <p className="hint center">W trybie demo synchronizacja z Google nie działa.</p>}
    </form>
  );
}

// ---------------------------------------------------------------------
function ExportTab({ people }) {
  const toast = useToast();
  const members = people.filter((p) => isActiveRole(p.role));

  const exportMembers = () => {
    const rows = [['Imię i nazwisko', 'E-mail', 'Rola', 'Role tymczasowe', 'Wydział', 'Kierunek', 'Rok', 'Telefon', 'W komisji od']];
    members.forEach((p) =>
      rows.push([
        p.full_name,
        p.email,
        ROLE_LABELS[p.role],
        activeAssignments(p).map((a) => a.role.name + (a.expires_at ? ` (do ${new Date(a.expires_at).toLocaleDateString('pl-PL')})` : '')).join(', '),
        p.faculty,
        p.study_field,
        p.study_year,
        p.phone,
        p.approved_at ? new Date(p.approved_at).toLocaleDateString('pl-PL') : '',
      ])
    );
    downloadCsv('czlonkowie-kkip.csv', rows);
  };

  const exportAttendance = async () => {
    try {
      const [meetings, att] = await Promise.all([api.listMeetings(), api.listAllAttendance()]);
      const past = meetings.filter((m) => new Date(m.starts_at) < new Date());
      const rows = [['Imię i nazwisko', ...past.map((m) => `${new Date(m.starts_at).toLocaleDateString('pl-PL')} ${m.title}`), 'Obecności', 'Frekwencja %']];
      members.forEach((p) => {
        let n = 0;
        const cells = past.map((m) => {
          const a = att.find((x) => x.meeting_id === m.id && x.user_id === p.id);
          if (a?.present) n++;
          return a ? (a.present ? '1' : '0') : '';
        });
        rows.push([p.full_name, ...cells, n, past.length ? Math.round((n / past.length) * 100) : 0]);
      });
      downloadCsv('frekwencja-kkip.csv', rows);
    } catch (e) {
      toast.error(e);
    }
  };

  return (
    <div className="grid grid-2">
      <div className="card card-pad stack">
        <h3>Lista członków</h3>
        <p className="small muted">Plik CSV (otworzysz w Excelu lub Arkuszach Google) z danymi wszystkich aktywnych członków.</p>
        <button className="btn btn-secondary" style={{ alignSelf: 'flex-start' }} onClick={exportMembers}>
          <Download size={16} /> Pobierz CSV
        </button>
      </div>
      <div className="card card-pad stack">
        <h3>Frekwencja – wszystkie spotkania</h3>
        <p className="small muted">Macierz członek × spotkanie z procentem frekwencji. Przydatne np. do zaświadczeń o aktywności.</p>
        <button className="btn btn-secondary" style={{ alignSelf: 'flex-start' }} onClick={exportAttendance}>
          <Download size={16} /> Pobierz CSV
        </button>
      </div>
      <div className="card card-pad stack" style={{ gridColumn: '1 / -1' }}>
        <h3>Kopia zapasowa</h3>
        <p className="small muted">
          Darmowy plan Supabase nie robi automatycznych kopii. Raz w miesiącu (oraz przy zmianie zarządu) pobierz oba pliki powyżej i zapisz w folderze komisji
          na Google Drive. Pełną kopię bazy można też pobrać w panelu Supabase.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
function AuditTab({ people }) {
  const [items, setItems] = useState(null);
  useEffect(() => {
    api.listAudit().then(setItems).catch(() => setItems([]));
  }, []);
  if (!items) return <Spinner center />;
  const name = (id) => people.find((p) => p.id === id)?.full_name || 'system';
  if (!items.length)
    return (
      <div className="card">
        <Empty icon={History} title="Dziennik jest pusty">
          Tutaj pojawią się zmiany ról i uprawnień.
        </Empty>
      </div>
    );
  return (
    <div className="card list">
      {items.map((i) => (
        <div key={i.id} className="list-item small">
          <History size={16} className="muted" />
          <div style={{ flex: 1 }}>
            <b>{name(i.actor_id)}</b>{' '}
            {i.action === 'role_change'
              ? `zmienił(a) rolę ${name(i.target_id)}: ${ROLE_LABELS[i.details.from]} → ${ROLE_LABELS[i.details.to]}`
              : i.action === 'custom_role_grant'
                ? `nadał(a) rolę tymczasową osobie ${name(i.target_id)}`
                : i.action}
          </div>
          <span className="tiny muted nowrap" title={fmtDateTime(i.created_at)}>
            {relTime(i.created_at)}
          </span>
        </div>
      ))}
    </div>
  );
}
