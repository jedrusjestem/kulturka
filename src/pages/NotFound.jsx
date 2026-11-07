import { Link } from 'react-router-dom';
import { gear } from '../components/ui';

export default function NotFound() {
  return (
    <div className="card card-pad center stack" style={{ alignItems: 'center', padding: 48 }}>
      <img src={gear} alt="" style={{ width: 90, filter: 'invert(62%) sepia(55%) saturate(500%) hue-rotate(170deg)' }} />
      <h1>404</h1>
      <p className="muted">Tej strony nie ma – może zębatka się zacięła.</p>
      <Link to="/" className="btn btn-primary">
        Strona główna
      </Link>
    </div>
  );
}
