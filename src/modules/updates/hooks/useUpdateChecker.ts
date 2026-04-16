import { useState, useEffect } from 'react';
import { checkForUpdate, UpdateInfo } from '@services/github-updates';

export function useUpdateChecker() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    checkForUpdate().then((info) => {
      if (info.hasUpdate) setUpdateInfo(info);
    });
  }, []);

  const dismiss = () => setDismissed(true);

  return {
    updateInfo: !dismissed ? updateInfo : null,
    dismiss,
  };
}
