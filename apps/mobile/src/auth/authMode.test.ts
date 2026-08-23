import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { selectAuthMode } from './authMode.ts';

describe('authentication mode — production refuses mock identity', () => {
  test('a production build without Supabase cannot silently create local users', () => {
    assert.throws(
      () => selectAuthMode({ nodeEnv: 'production' }),
      /refuses to run without Supabase authentication/,
    );
  });

  test('partial Supabase configuration is refused instead of falling back to mock users', () => {
    assert.throws(
      () => selectAuthMode({ nodeEnv: 'development', supabaseUrl: 'https://project.supabase.co' }),
      /set both Supabase public variables/,
    );
  });

  test('keyless development keeps the explicit local demo identity', () => {
    assert.equal(selectAuthMode({ nodeEnv: 'development', localDevelopment: '1' }), 'mock');
  });

  test('development without the explicit local flag also fails closed', () => {
    assert.throws(() => selectAuthMode({ nodeEnv: 'development' }), /unless local development is explicit/);
  });

  test('complete Supabase configuration is used in every environment', () => {
    assert.equal(
      selectAuthMode({
        nodeEnv: 'production',
        supabaseUrl: 'https://project.supabase.co',
        supabaseAnonKey: 'public-anon-key',
      }),
      'supabase',
    );
  });

  test('a deployed Supabase endpoint must use HTTPS', () => {
    assert.throws(
      () => selectAuthMode({
        nodeEnv: 'production',
        supabaseUrl: 'http://project.supabase.co',
        supabaseAnonKey: 'public-anon-key',
      }),
      /not HTTPS/,
    );
  });
});
