/** Authored recognition, local and unassessed. No account, microphone or service. */
export const FIRST_CHOICES = [
  { id: 'coffee', fr: 'Bonjour, je vais prendre un café.', en: 'Hello, I will have a coffee.' },
  { id: 'water', fr: 'Bonjour, je vais prendre de l’eau.', en: 'Hello, I will have some water.' },
] as const;
export type FirstChoice = (typeof FIRST_CHOICES)[number]['id'];
export function firstChoiceFeedback(choice: FirstChoice, helped: boolean): string {
  if (choice === 'water') return 'That asks for water. For coffee, choose « un café ».';
  return helped ? 'With the hint, you chose the coffee order.' : 'You chose the coffee order.';
}
