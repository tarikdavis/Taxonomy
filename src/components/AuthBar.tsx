import { useState } from 'react';
import {
  clearStoredToken,
  getRepoDisplayName,
  getStoredToken,
  getTokenCreateUrl,
  isGitHubConfigured,
  setStoredToken,
  validateToken,
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
  const [showTokenForm, setShowTokenForm] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [signedInAs, setSignedInAs] = useState<string | null>(null);

  const handleSignIn = async () => {
    setAuthError(null);
    setIsAuthorizing(true);
    try {
      const user = await validateToken(tokenInput);
      setStoredToken(tokenInput);
      setSignedInAs(user.login);
      setTokenInput('');
      setShowTokenForm(false);
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
        <h1 className={styles.title}>Taxonomy Tree</h1>
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

        {configured && !signedIn && !showTokenForm && (
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => setShowTokenForm(true)}
          >
            Sign in with GitHub
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

      {showTokenForm && !signedIn && (
        <div className={styles.tokenPanel}>
          <p className={styles.tokenHelp}>
            GitHub OAuth cannot run directly in the browser on GitHub Pages. Create a{' '}
            <strong>classic personal access token</strong> with <code>repo</code> scope, then paste
            it below. The token stays in this browser session only.
          </p>
          <p className={styles.tokenHelp}>
            <a href={getTokenCreateUrl()} target="_blank" rel="noreferrer">
              Create a token on GitHub
            </a>
          </p>
          <label className={styles.tokenField}>
            <span>Personal access token</span>
            <input
              type="password"
              value={tokenInput}
              onChange={(event) => setTokenInput(event.target.value)}
              placeholder="ghp_..."
              autoComplete="off"
            />
          </label>
          <div className={styles.tokenActions}>
            <button
              type="button"
              className={styles.primaryButton}
              disabled={isAuthorizing || !tokenInput.trim()}
              onClick={() => void handleSignIn()}
            >
              {isAuthorizing ? 'Verifying…' : 'Sign in'}
            </button>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => {
                setShowTokenForm(false);
                setTokenInput('');
                setAuthError(null);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {signedInAs && <p className={styles.message}>Signed in as {signedInAs}</p>}
      {authError && <p className={styles.error}>{authError}</p>}
      {saveMessage && <p className={styles.message}>{saveMessage}</p>}
    </header>
  );
}
