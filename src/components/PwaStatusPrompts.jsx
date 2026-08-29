import { useEffect, useState } from 'react';

export function PwaStatusPrompts() {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    const onInstallPrompt = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    const onUpdateReady = () => setUpdateReady(true);
    window.addEventListener('beforeinstallprompt', onInstallPrompt);
    window.addEventListener('bookmview-pwa-update-ready', onUpdateReady);
    return () => {
      window.removeEventListener('beforeinstallprompt', onInstallPrompt);
      window.removeEventListener('bookmview-pwa-update-ready', onUpdateReady);
    };
  }, []);

  if (!installPrompt && !updateReady) return null;

  const install = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    setInstallPrompt(null);
  };

  return (
    <div className="pwa-status-prompts" role="status">
      {updateReady ? (
        <button type="button" className="pwa-status-pill" onClick={() => window.location.reload()}>
          Update ready
        </button>
      ) : null}
      {installPrompt ? (
        <button type="button" className="pwa-status-pill" onClick={install}>
          Install app
        </button>
      ) : null}
    </div>
  );
}
