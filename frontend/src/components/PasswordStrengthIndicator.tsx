import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

interface PasswordStrengthIndicatorProps {
  password: string;
  email?: string;
}

interface CriterionResult {
  key: string;
  label: string;
  met: boolean;
}

const PasswordStrengthIndicator: React.FC<PasswordStrengthIndicatorProps> = ({ password, email }) => {
  const { t } = useTranslation();

  const criteria: CriterionResult[] = useMemo(() => {
    const results: CriterionResult[] = [
      {
        key: 'minLength',
        label: t('password.strength.minLength'),
        met: password.length >= 12,
      },
      {
        key: 'uppercase',
        label: t('password.strength.uppercase'),
        met: /[A-Z]/.test(password),
      },
      {
        key: 'lowercase',
        label: t('password.strength.lowercase'),
        met: /[a-z]/.test(password),
      },
      {
        key: 'digit',
        label: t('password.strength.digit'),
        met: /\d/.test(password),
      },
      {
        key: 'special',
        label: t('password.strength.special'),
        met: /[!@#$%^&*()_+\-=\[\]{}|;:',.<>?/~`]/.test(password),
      },
    ];

    if (email) {
      results.push({
        key: 'notEmail',
        label: t('password.strength.notEmail'),
        met: password.length === 0 || password.toLowerCase() !== email.toLowerCase(),
      });
    }

    return results;
  }, [password, email, t]);

  const metCount = criteria.filter((c) => c.met).length;
  const totalCount = criteria.length;
  const strengthPercent = totalCount > 0 ? (metCount / totalCount) * 100 : 0;

  const getBarColor = (): string => {
    if (strengthPercent <= 33) return 'bg-red-500';
    if (strengthPercent <= 66) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  if (!password) {
    return null;
  }

  return (
    <div className="mt-2 space-y-2">
      {/* Strength bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${getBarColor()}`}
            style={{ width: `${strengthPercent}%` }}
          />
        </div>
        <span className="text-xs text-gray-500 flex-shrink-0">
          {metCount}/{totalCount}
        </span>
      </div>

      {/* Criteria checklist */}
      <ul className="space-y-1">
        {criteria.map((criterion) => (
          <li key={criterion.key} className="flex items-center gap-2 text-xs">
            {criterion.met ? (
              <svg
                className="w-3.5 h-3.5 text-green-500 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            ) : (
              <svg
                className="w-3.5 h-3.5 text-red-400 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            )}
            <span className={criterion.met ? 'text-green-700' : 'text-gray-600'}>
              {criterion.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default PasswordStrengthIndicator;
