import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { test } from 'node:test';

for (const screen of ['SignInScreen.tsx', 'SignUpScreen.tsx']) {
  const source = readFileSync(new URL(screen, import.meta.url), 'utf8');
  for (const provider of ['google', 'apple'] as const) {
    test(`${screen}: ${provider} failures appear beside the provider buttons and a retry clears them`, async () => {
      let providerMessage: string | null = 'previous failure';
      let formMessage: string | null = 'previous email failure';
      let pending: string | null = null;
      let calls = 0;
      const requestRunning = { current: false };
      const bindings = {
        busy: false, alive: { current: true }, requestRunning,
        setProviderMessage: (value: string | null) => { providerMessage = value; },
        setFormMessage: (value: string | null) => { formMessage = value; },
        setPending: (value: string | null) => { pending = value; },
        Keyboard: { dismiss() {} }, friendly: () => 'Connection dropped.',
        adapter: { [provider === 'google' ? 'signInWithGoogle' : 'signInWithApple']: async () => {
          calls++;
          assert.equal(providerMessage, null);
          assert.equal(formMessage, null);
          assert.equal(pending, provider);
          return calls === 1 ? { ok: false, message: 'Sign in is unavailable.' } : { ok: true };
        } },
      };
      const start = source.indexOf(`  const ${provider} = async`);
      const end = source.indexOf('\n  };', start) + '\n  };'.length;
      assert.ok(start > 0 && end > start);
      const handler = new Function(...Object.keys(bindings), stripTypeScriptTypes(source.slice(start, end)) + `\nreturn ${provider};`)(...Object.values(bindings));
      await handler();
      assert.equal(providerMessage, 'Sign in is unavailable.');
      assert.equal(formMessage, null);
      assert.equal(pending, null);
      assert.equal(requestRunning.current, false);
      await handler();
      assert.equal(providerMessage, null);
      assert.equal(calls, 2);
      const messagePosition = source.indexOf('{providerMessage != null &&');
      assert.ok(messagePosition > source.indexOf('onPress={() => void google()}') && messagePosition < source.indexOf('<Field'));
    });
  }
}
