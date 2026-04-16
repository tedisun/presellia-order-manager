import { GITHUB_REPO, APP_VERSION, USE_MOCK } from '@config/constants';
import type { GithubRelease } from '@app-types/woocommerce';

export interface UpdateInfo {
  hasUpdate: boolean;
  latestVersion: string;
  currentVersion: string;
  releaseNotes: string;
  apkDownloadUrl: string | null;
  releaseUrl: string;
}

// Compare deux versions semver — retourne true si latest > current
function isNewerVersion(latest: string, current: string): boolean {
  const parse = (v: string) => v.replace(/^v/, '').split('.').map(Number);
  const [lMaj, lMin, lPatch] = parse(latest);
  const [cMaj, cMin, cPatch] = parse(current);
  if (lMaj !== cMaj) return lMaj > cMaj;
  if (lMin !== cMin) return lMin > cMin;
  return lPatch > cPatch;
}

export async function checkForUpdate(): Promise<UpdateInfo> {
  if (USE_MOCK) {
    // En mock, simuler qu'il n'y a pas de mise à jour
    return {
      hasUpdate: false,
      latestVersion: APP_VERSION,
      currentVersion: APP_VERSION,
      releaseNotes: '',
      apkDownloadUrl: null,
      releaseUrl: `https://github.com/${GITHUB_REPO}/releases`,
    };
  }

  try {
    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
      {
        headers: {
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      }
    );

    if (!response.ok) {
      // GitHub API non disponible — pas bloquant
      return {
        hasUpdate: false,
        latestVersion: APP_VERSION,
        currentVersion: APP_VERSION,
        releaseNotes: '',
        apkDownloadUrl: null,
        releaseUrl: `https://github.com/${GITHUB_REPO}/releases`,
      };
    }

    const release = (await response.json()) as GithubRelease;
    const latestVersion = release.tag_name.replace(/^v/, '');
    const hasUpdate = isNewerVersion(latestVersion, APP_VERSION);

    // Trouver l'APK dans les assets
    const apkAsset = release.assets.find(
      (a) => a.name.endsWith('.apk') || a.content_type === 'application/vnd.android.package-archive'
    );

    return {
      hasUpdate,
      latestVersion,
      currentVersion: APP_VERSION,
      releaseNotes: release.body || '',
      apkDownloadUrl: apkAsset?.browser_download_url ?? null,
      releaseUrl: release.html_url,
    };
  } catch {
    // Erreur réseau — silencieux, pas bloquant au démarrage
    return {
      hasUpdate: false,
      latestVersion: APP_VERSION,
      currentVersion: APP_VERSION,
      releaseNotes: '',
      apkDownloadUrl: null,
      releaseUrl: `https://github.com/${GITHUB_REPO}/releases`,
    };
  }
}
