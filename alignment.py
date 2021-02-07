# https://github.com/allisonnicoledeal/VideoSync/blob/master/alignment_by_row_channels.py

import scipy.io.wavfile
import numpy as np
import scipy as sc
from scipy import signal
import matplotlib.pyplot as plt
import scipy.io.wavfile as wavfile
from scipy.signal import find_peaks
from pydub import AudioSegment
from itertools import groupby 

import math

def normalize_audio(sound, target_dBFS):
    """Normalize audio"""

    change_in_dBFS = target_dBFS - sound.dBFS
    return sound.apply_gain(change_in_dBFS)


def detect_leading_silence(sound, silence_threshold=-30.0, chunk_size=5):
    """Find leading silence"""

    trim_ms = 0
    assert chunk_size > 0 
    while sound[trim_ms:trim_ms+chunk_size].dBFS < silence_threshold and trim_ms < len(sound):
        trim_ms += chunk_size

    return trim_ms


def find_beep(audio, start=0, end=0):
    """Find Beep by Mayank Goel"""

    fs_audio,y_audio = wavfile.read(audio)
    try:
        y_audio = y_audio[:,0]
    except:
        pass
    y_trimmed = y_audio[:(int)(y_audio.shape[0])]

    FFT_SIZE = 256
    NOVERLAP = (3*FFT_SIZE/4)
    f,t,pxx = signal.spectrogram(y_trimmed, nperseg=FFT_SIZE, fs=fs_audio, noverlap=NOVERLAP)
    trackBeep = np.argmax(pxx,0)

    sounds = [list(b) for a, b, in groupby(enumerate(trackBeep), lambda x: x[1])]
    beep = max(sounds, key = lambda sub: len(list(sub)))
    first_oc = beep[0][0]
    last_oc = beep[len(beep) - 1][0]
    length = t[last_oc] - t[first_oc]

    return (t[first_oc], length)


def sync_audio(audio1, audio2):
    """Sync Audio by finding beep sound"""

    sync_point1 = find_beep(audio1)
    sync_point2 = find_beep(audio2)

    return {'sync_point1': sync_point1, 'sync_point2': sync_point2}


def normalize_align(audio1, audio2):
    """Align audio through normalize"""

    sound1 = AudioSegment.from_wav("temp1.wav")
    sound2 = AudioSegment.from_file("temp2.m4a")
    normalized_sound = normalize_audio(sound2, sound1.dBFS)
    sync1 = (detect_leading_silence(sound1) / 1000)
    sync2 = (detect_leading_silence(normalized_sound) / 1000)

    return (sync1, sync2)
