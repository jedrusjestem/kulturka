import { Component } from 'react';

/** Gdy ekran się wysypie – zamiast białej strony pokazujemy komunikat i możliwość odświeżenia. */
export default class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error(error, info);
  }
  componentDidUpdate(prev) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="card card-pad center stack" style={{ alignItems: 'center', maxWidth: 480, margin: '40px auto' }}>
        <h2>Ups, coś poszło nie tak</h2>
        <p className="muted small">Ten ekran napotkał błąd. Odśwież stronę – jeśli problem wraca, daj znać administratorowi.</p>
        <p className="tiny muted" style={{ wordBreak: 'break-word' }}>{String(this.state.error?.message || this.state.error)}</p>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>
          Odśwież
        </button>
      </div>
    );
  }
}
