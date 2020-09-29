# https://github.com/allisonnicoledeal/VideoSync/blob/master/alignment_by_row_channels.py

import scipy.io.wavfile
import numpy as np
from subprocess import call
from pydub import AudioSegment
import math

def read_m4a(audio_file):
    #Return the sample rate (in samples/sec) and data from a m4a file
    audio = AudioSegment.from_file(audio_file)
    data = np.array(audio.get_array_of_samples())
    rate = audio.frame_rate
    return data, rate


def read_audio(audio_file):
    #Return the sample rate (in samples/sec) and data from a WAV file
    rate, data = scipy.io.wavfile.read(audio_file)  #@UndefinedVariable
    print(type(data))
    return data, rate


def make_horiz_bins(data, fft_bin_size, overlap, box_height):
    horiz_bins = {}
    # process first sample and set matrix height
    sample_data = data[0:fft_bin_size]  # get data for first sample
    if (len(sample_data) == fft_bin_size):  # if there are enough audio points left to create a full fft bin
        intensities = fourier(sample_data)  # intensities is list of fft results
        for i_intensity in range(len(intensities)):
            #TODO: replace all int(a / b) with explicit integer division where required, 
            #the "//" operator, to yeild a faster and (arguably) nicer code
            
            #have to force int, since int by float division yields float in Python3
            #original causes mem overflow due to too many bins -Greg
            box_y = int(i_intensity/box_height)
            if box_y in horiz_bins:
                horiz_bins[box_y].append((intensities[i_intensity], 0, i_intensity))  # (intensity, x, y)
            else:
                horiz_bins[box_y] = [(intensities[i_intensity], 0, i_intensity)]
                
    # process remainder of samples
    x_coord_counter = 1  # starting at second sample, with x index 1
    for i_bin in range(int(fft_bin_size - overlap), len(data), int(fft_bin_size-overlap)):
        sample_data = data[i_bin:i_bin + fft_bin_size]
        if (len(sample_data) == fft_bin_size):
            intensities = fourier(sample_data)
            for i_intensity in range(len(intensities)):
                #have to force int, since int by float division yields float in python 3
                #original causes mem overflow due to too many bins -Greg
                box_y = int(i_intensity/box_height) 
                if box_y in horiz_bins:
                    horiz_bins[box_y].append((intensities[i_intensity], x_coord_counter, i_intensity))  # (intensity, x, y)
                else:
                    horiz_bins[box_y] = [(intensities[i_intensity], x_coord_counter, i_intensity)]
        x_coord_counter += 1

    return horiz_bins


# Compute the one-dimensional discrete Fourier Transform
# INPUT: list with length of number of samples per second
# OUTPUT: list of real values len of num samples per second
def fourier(sample):  #, overlap):
    mag = []
    fft_data = np.fft.fft(sample)  # Returns real and complex value pairs
    for i in range(int(len(fft_data)/2)): # Python 3 defaults to float division, convert to int -Greg 
        r = fft_data[i].real**2
        j = fft_data[i].imag**2
        mag.append(round(math.sqrt(r+j),2))

    return mag


def make_vert_bins(horiz_bins, box_width):
    boxes = {}
    for key in horiz_bins.keys():
        for i_bin in range(len(horiz_bins[key])):
            # Python 3 defaults to float division, convert to int -Greg 
            box_x = int(horiz_bins[key][i_bin][1] / box_width)
            if (box_x,key) in boxes:
                boxes[(box_x,key)].append((horiz_bins[key][i_bin]))
            else:
                boxes[(box_x,key)] = [(horiz_bins[key][i_bin])]

    return boxes


def find_bin_max(boxes, maxes_per_box):
    freqs_dict = {}
    for key in boxes.keys():
        max_intensities = [(1,2,3)]
        for i_box in range(len(boxes[key])):
            if boxes[key][i_box][0] > min(max_intensities)[0]:
                if len(max_intensities) < maxes_per_box:  # add if < number of points per box
                    max_intensities.append(boxes[key][i_box])
                else:  # else add new number and remove min
                    max_intensities.append(boxes[key][i_box])
                    max_intensities.remove(min(max_intensities))
        for i_intensity in range(len(max_intensities)):
            if max_intensities[i_intensity][2] in freqs_dict:
                freqs_dict[max_intensities[i_intensity][2]].append(max_intensities[i_intensity][1])
            else:
                freqs_dict[max_intensities[i_intensity][2]] = [max_intensities[i_intensity][1]]

    return freqs_dict


def find_freq_pairs(freqs_dict_orig, freqs_dict_sample):
    time_pairs = []
    for key in freqs_dict_sample.keys():  # iterate through freqs in sample
        if key in freqs_dict_orig:        # if same sample occurs in base
            for i_sample_freq in range(len(freqs_dict_sample[key])):  # determine time offset
                for i_orig_freq in range(len(freqs_dict_orig[key])):
                    time_pairs.append((freqs_dict_sample[key][i_sample_freq], freqs_dict_orig[key][i_orig_freq]))

    return time_pairs


def find_delay(time_pairs):
    t_diffs = {}
    for i_time_pair in range(len(time_pairs)):
        delta_t = time_pairs[i_time_pair][0] - time_pairs[i_time_pair][1]
        if delta_t in t_diffs:
            t_diffs[delta_t] += 1
        else:
            t_diffs[delta_t] = 1
    t_diffs_sorted = sorted(t_diffs.items(), key=lambda x: x[1])
    #print(t_diffs_sorted)
    time_delay = t_diffs_sorted[-1][0]

    return time_delay


# Find time delay between two video files
def align(video1, video2, fft_bin_size=1024, overlap=0, box_height=512, box_width=43, samples_per_box=7):
    # Process first file
    raw_audio1, rate = read_audio(video1)
    bins_dict1 = make_horiz_bins(raw_audio1[:44100*120], fft_bin_size, overlap, box_height) #bins, overlap, box height
    boxes1 = make_vert_bins(bins_dict1, box_width)  # box width
    ft_dict1 = find_bin_max(boxes1, samples_per_box)  # samples per box

    # Process second file
    raw_audio2, rate = read_m4a(video2)
    bins_dict2 = make_horiz_bins(raw_audio2[:44100*60], fft_bin_size, overlap, box_height)
    boxes2 = make_vert_bins(bins_dict2, box_width)
    ft_dict2 = find_bin_max(boxes2, samples_per_box)

    # Determie time delay
    pairs = find_freq_pairs(ft_dict1, ft_dict2)
    delay = find_delay(pairs)
    samples_per_sec = float(rate) / float(fft_bin_size)
    seconds= round(float(delay) / float(samples_per_sec), 4)

    if seconds > 0:
        return (seconds, 0)
    else:
        return (0, abs(seconds))
