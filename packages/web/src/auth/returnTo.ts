import type { Location } from 'react-router-dom';

type AuthLocationState = { from?: Location };

export const resolveReturnTo = (location: Location): string => {
  const state = location.state as AuthLocationState | null;
  const from = state?.from;
  return from ? `${from.pathname}${from.search}` : '/';
};
