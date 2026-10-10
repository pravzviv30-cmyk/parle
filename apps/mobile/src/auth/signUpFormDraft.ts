/** Credentials stay only in the mounted auth flow, never in the onboarding store. */
export interface SignUpFormDraft {
  email: string;
  password: string;
  confirm: string;
}

export function emptySignUpFormDraft(): SignUpFormDraft {
  return { email: '', password: '', confirm: '' };
}
