import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../api';
import { Modal, useToast } from './ui';

/** "Zgłoś problem" – trafia do panelu przewodniczącego/administratora */
export default function FeedbackModal({ onClose }) {
  const toast = useToast();
  const loc = useLocation();
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      title="Zgłoś problem lub pomysł"
      onClose={onClose}
      width={480}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            Anuluj
          </button>
          <button
            className="btn btn-primary"
            disabled={busy || !msg.trim()}
            onClick={async () => {
              setBusy(true);
              try {
                await api.sendFeedback(msg.trim(), loc.pathname + ' · ' + navigator.userAgent.slice(0, 120));
                toast.success('Dziękujemy! Zgłoszenie trafiło do administratora.');
                onClose();
              } catch (e) {
                toast.error(e);
                setBusy(false);
              }
            }}
          >
            Wyślij
          </button>
        </>
      }
    >
      <div className="field">
        <label>Co nie działa albo co można ulepszyć?</label>
        <textarea className="textarea" rows={5} maxLength={3000} value={msg} onChange={(e) => setMsg(e.target.value)}
          placeholder="Opisz krótko, co robiłeś(-aś) i co się stało. Do zgłoszenia dołączymy nazwę ekranu i typ urządzenia." />
      </div>
    </Modal>
  );
}
