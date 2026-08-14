import { useNavigate } from 'react-router-dom';

import { PrivacyEyeButton } from './PrivacyEyeButton.jsx';
import { usePlayability } from '../context/PlayabilityContext.jsx';
import { useDb } from '../context/DbContext.jsx';

export function AppHeader() {
  const navigate = useNavigate();
  const { closeDatabase, fileName } = useDb();
  const { runCheck, busy, progress, eligibleCount } = usePlayability();

  const onChangeDb = async () => {
    await closeDatabase();
    navigate('/');
  };

  const checkLabel = busy
    ? `Checking ${Math.min(progress.done + (progress.checking || 0), progress.total)}/${progress.total}`
    : 'Check playable';

  return (
    <header className="top-bar">
      <div className="top-bar-actions">
        <PrivacyEyeButton compact />
        <button type="button" className="btn" onClick={onChangeDb}>
          Change DB
        </button>
        <button
          type="button"
          className="btn"
          onClick={runCheck}
          disabled={busy || eligibleCount === 0}
        >
          {checkLabel}
        </button>
      </div>
      {fileName ? <span className="top-bar-file">{fileName}</span> : null}
    </header>
  );
}
