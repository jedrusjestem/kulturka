import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Users } from 'lucide-react';
import { api } from '../api';
import { Avatar, CustomRoleBadges, Empty, RoleBadge, Spinner } from '../components/ui';
import { ROLE_ORDER } from '../lib/perms';
import { normalize } from '../lib/format';

export default function Members() {
  const [people, setPeople] = useState(null);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    api.listProfiles().then(setPeople).catch(console.error);
  }, []);

  const list = useMemo(() => {
    if (!people) return [];
    const nq = normalize(q.trim());
    return people
      .filter((p) => (filter === 'alumni' ? p.role === 'alumni' : ['member', 'board', 'chair'].includes(p.role)))
      .filter((p) => filter !== 'board' || ['board', 'chair'].includes(p.role))
      .filter((p) => {
        if (!nq) return true;
        const hay = normalize(
          [p.full_name, p.faculty, p.study_field, p.bio, ...(p.assignments || []).map((a) => a.role?.name)].join(' ')
        );
        return nq.split(/\s+/).every((w) => hay.includes(w));
      })
      .sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.full_name.localeCompare(b.full_name, 'pl'));
  }, [people, q, filter]);

  if (!people) return <Spinner center />;
  const hasAlumni = people.some((p) => p.role === 'alumni');

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Członkowie</h1>
          <p>Wyszukaj osobę po imieniu, wydziale, kierunku albo roli.</p>
        </div>
      </div>
      <div className="row row-wrap" style={{ marginBottom: 18, gap: 12 }}>
        <div className="input-icon" style={{ flex: '1 1 260px' }}>
          <Search size={18} />
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Szukaj…" type="search" />
        </div>
        <div className="tabs">
          <button className={`tab ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
            Wszyscy
          </button>
          <button className={`tab ${filter === 'board' ? 'active' : ''}`} onClick={() => setFilter('board')}>
            Zarząd
          </button>
          {hasAlumni && (
            <button className={`tab ${filter === 'alumni' ? 'active' : ''}`} onClick={() => setFilter('alumni')}>
              Byli członkowie
            </button>
          )}
        </div>
      </div>

      {list.length === 0 ? (
        <div className="card">
          <Empty icon={Users} title="Nikogo nie znaleziono">
            Spróbuj innej frazy.
          </Empty>
        </div>
      ) : (
        <div className="member-grid">
          {list.map((p) => (
            <Link key={p.id} to={`/u/${p.id}`} className="card member-card">
              <Avatar profile={p} size={72} />
              <b>{p.full_name}</b>
              <span className="small muted truncate" style={{ maxWidth: '100%' }}>
                {[p.study_field, p.study_year].filter(Boolean).join(' · ') || ' '}
              </span>
              <div className="tags">
                {p.role !== 'member' && <RoleBadge role={p.role} />}
                <CustomRoleBadges profile={p} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
