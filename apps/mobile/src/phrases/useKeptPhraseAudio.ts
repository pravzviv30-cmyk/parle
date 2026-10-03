import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import type { PhraseAudioSource, TutorVoiceKey } from '@luvani/core';
import { activeUserId, scopeGeneration } from '../storage/scope.ts';
import { useRecordedLine } from '../practice/recordedPlayer.ts';
import { keptPhraseAudio } from './phraseAudioClient.ts';
export function useKeptPhraseAudio(voice:TutorVoiceKey) {
  const owner=scopeGeneration(),focused=useIsFocused();
  const focusedNow=useRef(focused);focusedNow.current=focused;
  const voiceNow=useRef(voice);voiceNow.current=voice;
  const active=useRef(AppState.currentState==='active');
  const ticket=useRef(0),pending=useRef<AbortController|null>(null);
  const pendingId=useRef<string|null>(null);
  const [loadingId,setLoadingId]=useState<string|null>(null),[playingId,setPlayingId]=useState<string|null>(null),[failedId,setFailedId]=useState<string|null>(null);
  const valid=()=>focusedNow.current&&active.current&&owner===scopeGeneration()&&voiceNow.current===voice;
  const player=useRecordedLine({isCurrent:valid});
  const stop=useCallback(()=>{ticket.current++;pending.current?.abort();pending.current=null;pendingId.current=null;player.stop();setLoadingId(null);setPlayingId(null);},[player.stop]);
  useEffect(()=>{stop();setFailedId(null);},[voice,owner,stop]);
  useEffect(()=>{if(!focused)stop();},[focused,stop]);
  useEffect(()=>{const subscription=AppState.addEventListener('change',state=>{active.current=state==='active';if(!active.current)stop();});return()=>subscription.remove();},[stop]);
  useEffect(()=>()=>{ticket.current++;pending.current?.abort();},[]);
  const hear=async(id:string,french:string,source:PhraseAudioSource)=>{
    if(!valid())return;
    if(pendingId.current===id||(playingId===id&&player.playingUri!==null)){stop();return;}
    stop();setFailedId(null);
    const userId=activeUserId();if(!userId)return;
    const mine=++ticket.current,controller=new AbortController();pending.current=controller;pendingId.current=id;setLoadingId(id);
    const current=()=>valid()&&mine===ticket.current&&!controller.signal.aborted;
    const uri=await keptPhraseAudio({userId,owner,source,voice,french,signal:controller.signal,current});
    if(!current())return;
    pending.current=null;pendingId.current=null;setLoadingId(null);
    if(uri){setPlayingId(id);player.playUri(uri);}else{setFailedId(id);}
  };
  return {hear,stop,loadingId,failedId,playingId:player.playingUri===null?null:playingId};
}
