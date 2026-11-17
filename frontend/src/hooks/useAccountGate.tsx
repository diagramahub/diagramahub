import { useCallback, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { SignInPromptModal, type AccountGateReason } from '../components/community/SignInPromptModal';

/**
 * For pages anonymous visitors can see: `requireAccount(reason)` is true for a
 * signed-in user; otherwise it opens the sign-in prompt and returns false.
 * Render `accountPrompt` once in the page.
 */
export function useAccountGate() {
  const { isAuthenticated } = useAuth();
  const [reason, setReason] = useState<AccountGateReason | null>(null);

  const requireAccount = useCallback(
    (why: AccountGateReason) => {
      if (isAuthenticated) return true;
      setReason(why);
      return false;
    },
    [isAuthenticated],
  );

  const accountPrompt = <SignInPromptModal reason={reason} onClose={() => setReason(null)} />;
  return { isAuthenticated, requireAccount, accountPrompt };
}
