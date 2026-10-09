import { useEffect, useState } from 'react';

/**
 * Captura el evento beforeinstallprompt (Chrome/Edge Android y escritorio)
 * para ofrecer el botón "Instalar app". En iOS no existe ese evento:
 * devuelve disponible=false y la app se instala desde Compartir.
 */
export const useInstallPrompt = () => {
  const [promptEvent, setPromptEvent] = useState(null);
  const [instalada, setInstalada] = useState(
    () =>
      typeof window !== 'undefined' &&
      (window.matchMedia?.('(display-mode: standalone)').matches ||
        window.navigator?.standalone === true)
  );

  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault();
      setPromptEvent(e);
    };
    const onInstalled = () => {
      setInstalada(true);
      setPromptEvent(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const instalar = async () => {
    if (!promptEvent) return false;
    promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice.catch(() => ({ outcome: 'dismissed' }));
    if (outcome === 'accepted') setPromptEvent(null);
    return outcome === 'accepted';
  };

  return { disponible: !!promptEvent && !instalada, instalar };
};
