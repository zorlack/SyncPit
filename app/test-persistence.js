#!/usr/bin/env node

/**
 * Simple persistence test
 *
 * This creates a Yjs document with strokes and verifies the serialized size
 * is greater than 2 bytes (empty doc).
 */

import * as Y from 'yjs';

// Create doc with strokes like the app does
const ydoc = new Y.Doc();
const strokes = ydoc.getArray('strokes');

// Add a sample stroke
strokes.push([{
  points: [
    { x: 10, y: 10 },
    { x: 50, y: 50 },
    { x: 100, y: 100 }
  ],
  color: '#ff0000',
  width: 3,
  tool: 'pen'
}]);

// Encode and check size
const update = Y.encodeStateAsUpdate(ydoc);

console.log('Empty Yjs doc size: ~2 bytes');
console.log('Doc with 1 stroke (3 points): ' + update.length + ' bytes');
console.log('');
console.log(update.length > 2 ? '✓ Persistence size test passed' : '✗ Persistence size test FAILED');
console.log('');
console.log('Expected: Saved pits should show similar byte counts in logs');
