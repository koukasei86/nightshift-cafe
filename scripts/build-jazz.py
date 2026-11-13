"""Compose Midnight Reserve. Requires numpy and lameenc; no third-party samples."""
from pathlib import Path
import sys, json, wave
import numpy as np
import lameenc
ROOT=Path(__file__).resolve().parents[1]
RATE=44100; BPM=76; BEAT=60/BPM; BARS=32
N=round(BARS*4*BEAT*RATE)
audio=np.zeros((N,2),dtype=np.float64)
rng=np.random.default_rng(761109)
def hz(note):return 440*2**((note-69)/12)
def add(sig,beat,pan=0,gain=1):
    start=round(beat*BEAT*RATE);indices=(np.arange(len(sig))+start)%N
    audio[indices,0]+=sig*gain*np.sqrt((1-pan)/2)
    audio[indices,1]+=sig*gain*np.sqrt((1+pan)/2)
def piano(note,duration,velocity=.2):
    t=np.arange(round((duration*BEAT+1.5)*RATE))/RATE;f=hz(note)
    # Soft hammer, detuned strings, and quicker decay of upper partials.
    env=(1-np.exp(-t/.008))*np.exp(-t/(1.15+150/f))
    release=np.exp(-np.maximum(0,t-duration*BEAT)/.25)
    sig=np.zeros_like(t)
    for k,weight in [(1,1),(2,.32),(3,.13),(4,.055),(5,.024)]:
        partial=f*k*np.sqrt(1+.00008*k*k)
        sig+=weight*np.exp(-t*k*.28)*(np.sin(2*np.pi*partial*t)+.28*np.sin(2*np.pi*partial*1.0013*t))
    sig+=rng.normal(0,1,len(t))*.017*np.exp(-t/.009)
    return sig*env*release*velocity

def bass(note,velocity=.28):
    t=np.arange(round(.86*BEAT*RATE))/RATE;f=hz(note)
    sig=sum(a*np.sin(2*np.pi*f*k*t)*np.exp(-t*(2+k*.9)) for k,a in [(1,1),(2,.42),(3,.13),(4,.045)])
    sig+=.11*np.sin(2*np.pi*92*t)*np.exp(-t*26)
    return sig*(1-np.exp(-t/.003))*np.minimum(1,(t[-1]-t)/.035)*velocity

def brush(duration=.23,velocity=.025):
    t=np.arange(round(duration*RATE))/RATE;n=rng.normal(0,1,len(t));smooth=np.convolve(n,np.ones(10)/10,'same')
    return smooth*np.sin(np.pi*np.minimum(1,t/duration))**.7*np.exp(-t*3)*velocity

def ride(velocity=.012):
    t=np.arange(round(.24*RATE))/RATE
    s=sum(np.sin(2*np.pi*f*t) for f in [3260,4837,6173,8821])*.17+rng.normal(0,1,len(t))*.23
    return s*(1-np.exp(-t/.002))*np.exp(-t*23)*velocity

# AABA; rootless seventh/ninth/thirteenth voicings, with a minor ii–V in the bridge.
A=[(39,[55,62,65,70]),(36,[58,62,63,67]),(41,[56,60,63,67]),(34,[56,60,62,67]),(43,[58,62,65,69]),(36,[58,61,64,69]),(41,[56,60,63,67]),(34,[56,60,62,67])]
B=[(33,[55,60,63,67]),(38,[54,60,63,66]),(43,[58,62,65,69]),(36,[58,62,64,69]),(41,[56,60,63,67]),(34,[56,60,62,67]),(39,[55,60,62,65]),(33,[55,61,64,70])]
progression=A+A+B+A
# Sparse, composed motifs leave space between phrases; swing belongs in the phrasing.
melodies=[
 [(1,1,70),(2.65,.5,67),(3.3,.5,65)],[(.65,1.5,63),(2.65,.7,62)],
 [(1,1,65),(2.65,.45,67),(3.3,.6,68)],[(.65,.7,67),(1.65,.7,65),(2.65,1.1,62)],
 [(1,1.2,65),(2.65,.55,69)],[(.65,.8,70),(2,.6,69),(2.65,.9,64)],
 [(1,1,63),(2.65,.65,60)],[(.65,.65,62),(2,1.2,65)],
]
bridge=[[(.65,1.2,67),(2.65,.65,63)],[(1,1,66),(2.65,.65,63)],[(.65,1.4,65),(2.65,.6,62)],[(1,1,64),(2.65,.55,62)],[(.65,1.1,63),(2.65,.6,67)],[(1,.6,65),(2,.6,62),(2.65,.9,60)],[(.65,1.6,62),(2.65,.65,60)],[(1,1,61),(2.65,.7,64)]]
for bar,(root,chord) in enumerate(progression):
    t=bar*4
    # Low-key walking bass with approach notes into each change.
    nextroot=progression[(bar+1)%BARS][0]
    third=root+(3 if bar%8 in [1,2,4,6] else 4)
    line=[root,root+7,third,nextroot-1]
    if bar in [7,15,23,31]:line=[root,root+7,root+10,nextroot-1]
    for beat,note in enumerate(line):add(bass(note,.23 if beat%2 else .28),t+beat,0)
    # Gentle offbeat comping; chords are rolled by a few milliseconds.
    for at,vel in [(0,.067 if bar%2 else .08),(2.65,.055)]:
        for j,note in enumerate(chord):add(piano(note,1.1,vel),t+at+j*.012,-.24)
    phrase=bridge[bar-16] if 16<=bar<24 else melodies[bar%8]
    if bar in [7,15,23,31]:phrase=phrase[:2]
    for at,duration,note in phrase:
        if 8<=bar<16 and bar%2==0:note+=12
        add(piano(note,duration,.13 if bar<16 else .14),t+at+.012,.18)
    for beat in range(4):
        add(ride(.011 if beat%2 else .008),t+beat,.35)
        add(brush(.22,.065 if beat%2 else .025),t+beat+.025,.28)
        if beat in [1,3]:add(ride(.006),t+beat+.66,.3)
        if beat%2==0:
            tt=np.arange(round(.12*RATE))/RATE;add(np.sin(2*np.pi*(49*tt-12*tt*tt))*np.exp(-tt*32)*.045,t+beat,-.1)
# Short, low-level stereo room reflections. Circular tails preserve the loop.
dry=audio.copy()
for seconds,gain in [(.043,.09),(.079,.065),(.131,.045),(.211,.028),(.317,.017)]:
    audio+=np.roll(dry[:,::-1],round(seconds*RATE),axis=0)*gain
peak=np.max(np.abs(audio));audio*=.76/peak
pcm=(np.clip(audio,-1,1)*32767).astype('<i2')
assets=ROOT/'src/audio';assets.mkdir(exist_ok=True)
out=ROOT.parent/'nightshift-midnight-reserve.wav'
with wave.open(str(out),'wb') as w:w.setnchannels(2);w.setsampwidth(2);w.setframerate(RATE);w.writeframes(pcm.tobytes())
# Cyclic handles on either side allow an exact-length loop after MP3 decoder padding.
pad=round(.4*RATE);padded=np.concatenate([pcm[-pad:],pcm,pcm[:pad]])
enc=lameenc.Encoder();enc.set_bit_rate(160);enc.set_in_sample_rate(RATE);enc.set_channels(2);enc.set_quality(2)
mp3=enc.encode(padded.tobytes())+enc.flush()
(assets/'midnight-reserve.mp3').write_bytes(mp3)
(ROOT.parent/'nightshift-midnight-reserve.mp3').write_bytes(mp3)
meta={'title':'Midnight Reserve','bpm':BPM,'bars':BARS,'duration':N/RATE,'sampleRate':RATE,'peak':float(np.max(np.abs(audio))),'rms':float(np.sqrt(np.mean(audio**2))),'bytes':len(mp3)}
(assets/'music-info.json').write_text(json.dumps(meta,indent=2)+'\n',encoding='utf-8');print(json.dumps(meta))
