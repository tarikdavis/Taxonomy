import { useState } from 'react';
import {
  clearStoredToken,
  getRepoDisplayName,
  getStoredToken,
  isGitHubConfigured,
  startDeviceFlow,
} from '../lib/github';
import styles from './AuthBar.module.css';

interface AuthBarProps {
  isDirty: boolean;
  isSaving: boolean;
  saveMessage: string | null;
  onSave: () => void;
  onExport: () => void;
  onReload: () => void;
  onDiscardDraft: () => void;
}

export function AuthBar({
  isDirty,
  isSaving,
  saveMessage,
  onSave,
  onExport,
  onReload,
  onDiscardDraft,
}: AuthBarProps) {
  const signedIn = Boolean(getStoredToken());
  const configured = isGitHubConfigured();
  const [deviceCode, setDeviceCode] = useState<string | null>(null);
  const [deviceUri, setDeviceUri] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthorizing, setIsAuthorizing] = useState(false);

  const handleSignIn = async () => {
    setAuthError(null);
    setIsAuthorizing(true);
    try {
      const session = await startDeviceFlow();
      setDeviceCode(session.userCode);
      setDeviceUri(session.verificationUri);
      window.open(session.verificationUri, '_blank', 'noopener,noreferrer');
      await session.poll();
      setDeviceCode(null);
      setDeviceUri(null);
      window.location.reload();
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'GitHub sign-in failed.');
    } finally {
      setIsAuthorizing(false);
    }
  };

  return (
    <header className={styles.bar}>
      <div>
        <h1 className={styles.title}>Avios Taxonomy Tree</h1>
        <p className={styles.subtitle}>
          {configured ? `GitHub source: ${getRepoDisplayName()}` : 'GitHub save is not configured yet'}
        </p>
      </div>

      <div className={styles.actions}>
        {isDirty && <span className={styles.dirty}>Unsaved local changes</span>}

        <button type="button" className={styles.secondaryButton} onClick={onReload}>
          Reload
        </button>
        <button type="button" className={styles.secondaryButton} onClick={onExport}>
          Export JSON
        </button>
        {isDirty && (
          <button type="button" className={styles.secondaryButton} onClick={onDiscardDraft}>
            Discard draft
          </button>
        )}

        {configured && !signedIn && (
          <button
            type="button"
            className={styles.primaryButton}
            disabled={isAuthorizing}
            onClick={() => void handleSignIn()}
          >
            {isAuthorizing ? 'Waiting for GitHub…' : 'Sign in with GitHub'}
          </button>
        )}

        {configured && signedIn && (
          <>
            <button
              type="button"
              className={styles.primaryButton}
              disabled={isSaving || !isDirty}
              onClick={onSave}
            >
              {isSaving ? 'Saving…' : 'Save to GitHub (PR)'}
            </button>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => {
                clearStoredToken();
                window.location.reload();
              }}
            >
              Sign out
            </button>
          </>
        )}
      </div>

      {deviceCode && deviceUri && (
        <p className={styles.message}>
          Enter code <strong>{deviceCode}</strong> at{' '}
          <a href={deviceUri} target="_blank" rel="noreferrer">
            {deviceUri}
          </a>
        </p>
      )}
      {authError && <p className={styles.error}>{authError}</p>}
      {saveMessage && <p className={styles.message}>{saveMessage}</p>}
    </header>
  );
}
