import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { describe, test } from 'node:test';

const path = (p: string) => new URL(p, import.meta.url);
const code = (p: string) => readFileSync(path(p), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

describe('auth fields and the browser (F938)', () => {
  test('password fields sit in a form on web', () => {
    assert.ok(existsSync(path('./AuthForm.tsx')), 'there is no AuthForm');
    const form = code('./AuthForm.tsx');
    assert.match(form, /Platform\.OS !== 'web'[\s\S]*?<View/, 'native does not render a plain View');
    assert.match(form, /createElement\(\s*'form'/, 'web does not render a real form');
    assert.match(form, /preventDefault\(\)[\s\S]{0,40}onSubmit\(\)/, 'the form does not stop the page load before submitting');
    assert.match(form, /setAttribute(?:\?\.)?\('name', name\)/, 'fields get no name');

    const expected: Record<string, string[]> = {
      './SignInScreen.tsx': ['email', 'current-password'],
      './SignUpScreen.tsx': ['email', 'new-password', 'new-password'],
    };
    for (const [file, names] of Object.entries(expected)) {
      const screen = code(file);
      const wrapped = screen.match(/<AuthForm onSubmit=\{[^}]*\}>([\s\S]*?)<\/AuthForm>/)?.[1];
      assert.ok(wrapped, `${file} fields are not inside an AuthForm`);
      for (const ref of ['emailRef', 'passwordRef']) assert.match(wrapped, new RegExp(`ref=\\{${ref}\\}`), `${file} ${ref} sits outside the form`);
      const named = [...screen.matchAll(/useWebFieldName\(\w+, '([a-z-]+)'\)/g)].map((m) => m[1]);
      assert.deepEqual(named, names, `${file} field names`);
      // Enter keeps its one path: every field handles onSubmitEditing, which react-native-web
      // preventDefaults, so the form never submits a second time.
      const fields = wrapped.match(/<Field\b[\s\S]*?\/>/g) ?? [];
      for (const field of fields) assert.match(field, /onSubmitEditing=/, `${file} has a field Enter would submit through the form`);
    }
  });
});
