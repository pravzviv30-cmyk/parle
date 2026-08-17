/**
 * Pronunciation assessment — implementation shared with the token server.
 *
 * The client lives in services/shared/ because two services score utterances:
 * this worker (live conversation audio, once the audio tap lands) and the
 * token server (drill mode's POST /drill/score). One vendor integration, one
 * parser, one place to swap Speechace out.
 */

export * from '../../shared/speechace.ts';
