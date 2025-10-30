#!/usr/bin/env node

/**
 * Audio analyzer - creates a loudness track from an audio file
 * Generates measurements every 100ms for light show synchronization
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const AUDIO_FILE = path.join(__dirname, '..', 'static', 'SYNC_PIT.mp3');
const OUTPUT_FILE = path.join(__dirname, '..', 'static', 'SYNC_PIT_loudness.json');
const INTERVAL_MS = 50; // Measurement interval in milliseconds

console.log('Analyzing audio file:', AUDIO_FILE);
console.log('Measurement interval:', INTERVAL_MS, 'ms');

// First, get the duration of the audio file
console.log('\nGetting audio duration...');
const durationCmd = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${AUDIO_FILE}"`;
const duration = parseFloat(execSync(durationCmd, { encoding: 'utf8' }).trim());
console.log('Audio duration:', duration.toFixed(2), 'seconds');

// Calculate loudness using astats filter with 100ms segments
console.log('\nAnalyzing loudness...');
const ffmpegCmd = `ffmpeg -i "${AUDIO_FILE}" -af "astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level:file=-" -f null - 2>&1`;

try {
  const output = execSync(ffmpegCmd, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });

  // Parse the output to extract RMS levels
  const lines = output.split('\n');
  const rmsValues = [];

  for (const line of lines) {
    const match = line.match(/lavfi\.astats\.Overall\.RMS_level=(-?\d+\.?\d*)/);
    if (match) {
      const rmsDb = parseFloat(match[1]);
      rmsValues.push(rmsDb);
    }
  }

  console.log('Found', rmsValues.length, 'RMS measurements');

  // Create time-stamped loudness data
  const loudnessTrack = [];
  const samplesPerInterval = Math.ceil((rmsValues.length / duration) * (INTERVAL_MS / 1000));

  console.log('Samples per interval:', samplesPerInterval);

  for (let i = 0; i < rmsValues.length; i += samplesPerInterval) {
    const timestamp = (i / rmsValues.length) * duration * 1000; // Convert to milliseconds
    const samples = rmsValues.slice(i, i + samplesPerInterval);

    if (samples.length === 0) continue;

    // Calculate average RMS for this interval
    const avgRms = samples.reduce((sum, val) => sum + val, 0) / samples.length;

    // Convert RMS dB to normalized value (0-1)
    // Typical RMS range is -60dB (quiet) to 0dB (loud)
    const normalized = Math.max(0, Math.min(1, (avgRms + 60) / 60));

    loudnessTrack.push({
      time: Math.round(timestamp),
      rmsDb: parseFloat(avgRms.toFixed(2)),
      normalized: parseFloat(normalized.toFixed(3))
    });
  }

  console.log('\nGenerated', loudnessTrack.length, 'loudness measurements');
  console.log('Time range:', loudnessTrack[0]?.time, 'ms to', loudnessTrack[loudnessTrack.length - 1]?.time, 'ms');

  // Find peaks
  const sorted = [...loudnessTrack].sort((a, b) => b.normalized - a.normalized);
  console.log('\nTop 5 loudest moments:');
  sorted.slice(0, 5).forEach(({ time, normalized }) => {
    console.log(`  ${(time / 1000).toFixed(2)}s: ${(normalized * 100).toFixed(1)}%`);
  });

  // Write to file
  const outputData = {
    metadata: {
      file: 'SYNC_PIT.mp3',
      duration: parseFloat(duration.toFixed(2)),
      intervalMs: INTERVAL_MS,
      samples: loudnessTrack.length,
      generated: new Date().toISOString()
    },
    loudness: loudnessTrack
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(outputData, null, 2));
  console.log('\nLoudness track written to:', OUTPUT_FILE);

} catch (error) {
  console.error('Error analyzing audio:', error.message);
  process.exit(1);
}
