"""Build artefacts, not app runtime. Audio and content stay on this machine."""
import json, os, pathlib, subprocess, sys, wave
import espeakng_loader
os.environ['PHONEMIZER_ESPEAK_LIBRARY'] = espeakng_loader.get_library_path()
os.environ['ESPEAK_DATA_PATH'] = espeakng_loader.get_data_path()
import numpy as np
import torch
from kokoro import KPipeline

torch.set_num_threads(2)
pipeline = KPipeline(lang_code='f', repo_id='hexgrad/Kokoro-82M', device='cpu')
directory = pathlib.Path(sys.argv[1])
jobs = json.load(sys.stdin)
for index, job in enumerate(jobs):
    target = directory / job['file']
    if not target.exists() or target.stat().st_size < 1000:
        chunks = [result.audio.numpy() for result in pipeline(job['text'], voice='ff_siwis', speed=1)]
        samples = np.concatenate(chunks)
        if len(samples) < 2400 or np.max(np.abs(samples)) < .01:
            raise RuntimeError('Empty audio: ' + job['id'])
        wav = target.with_suffix('.wav')
        with wave.open(str(wav), 'wb') as output:
            output.setnchannels(1); output.setsampwidth(2); output.setframerate(24000)
            output.writeframes((np.clip(samples, -1, 1) * 32767).astype('<i2').tobytes())
        subprocess.run(['ffmpeg','-v','error','-y','-i',str(wav),'-ac','1','-ar','24000','-c:a','aac','-b:a','48k',str(target)],check=True)
        wav.unlink()
    if (index+1)%100==0: print(f'Validated {index+1}/{len(jobs)} recordings',flush=True)
