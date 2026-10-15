import { Text, View } from 'react-native';
import { Press } from '../components.tsx';
import { boldType } from '../theme.ts';
import { c } from '../onboarding/boldRhythm.ts';

/** Reading a policy never declares eligibility or starts a request. */
export function TermsAcceptance({ context, onTerms, onPrivacy }: {
  context: 'practice' | 'account' | 'repair';
  onTerms: () => void;
  onPrivacy: () => void;
}) {
  const action = context === 'practice' ? 'starting practice' : context === 'account' ? 'creating an account' : 'continuing';
  const centered = context === 'practice' || context === 'account';
  return <View style={{ width: '100%', gap: 2 }}>
    <Text style={[boldType.small, { color: c.muted }, centered && { textAlign: 'center' }]}>
      {`By ${action}, you agree to the Terms and acknowledge the Privacy Policy.`}
    </Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: centered ? 'center' : 'flex-start' }}>
      <Press onPress={onTerms} accessibilityRole="button" accessibilityLabel="Read Terms of Use"
        style={{ flex: 1, minWidth: 120, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={[boldType.label, { color: c.violet }]}>Terms of Use</Text>
      </Press>
      <Press onPress={onPrivacy} accessibilityRole="button" accessibilityLabel="Read Privacy Policy"
        style={{ flex: 1, minWidth: 120, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={[boldType.label, { color: c.violet }]}>Privacy Policy</Text>
      </Press>
    </View>
  </View>;
}
