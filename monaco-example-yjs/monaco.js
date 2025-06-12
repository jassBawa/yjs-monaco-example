/* eslint-env browser */

import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { MonacoBinding } from 'y-monaco';
import * as monaco from 'monaco-editor';
import * as random from 'lib0/random';

export const usercolors = [
  { color: '#30bced', light: '#30bced33' },
  { color: '#6eeb83', light: '#6eeb8333' },
  { color: '#ffbc42', light: '#ffbc4233' },
  { color: '#ecd444', light: '#ecd44433' },
  { color: '#ee6352', light: '#ee635233' },
  { color: '#9ac2c9', light: '#9ac2c933' },
  { color: '#8acb88', light: '#8acb8833' },
  { color: '#1be7ff', light: '#1be7ff33' },
];

export const userColor = usercolors[random.uint32() % usercolors.length];

let provider = null;
let ydoc = null;
let monacoBinding = null;
let editor = null;
let currentRoom = null;

// Get initial auth token
let authToken = await fetch('http://localhost:5173/auth/token').then((res) => res.text());

async function updateAuthToken() {
  try {
    authToken = await fetch('http://localhost:5173/auth/token').then((res) =>
      res.text()
    );
    if (provider) provider.params.yauth = authToken;
  } catch (e) {
    console.error('Failed to refresh token, retrying...', e);
    setTimeout(updateAuthToken, 1000);
    return;
  }
  setTimeout(updateAuthToken, 30 * 60 * 1000); // every 30 mins
}
updateAuthToken();

function loadRoom(roomId) {
  if (currentRoom === roomId) return; // avoid redundant reloads
  currentRoom = roomId;

  if (provider) {
    provider.destroy();
    provider = null;
  }

  ydoc = new Y.Doc();
  provider = new WebsocketProvider('ws://localhost:3002', roomId, ydoc, {
    params: { yauth: authToken },
  });

  const ytext = ydoc.getText('monaco');

  if (!editor) {
    editor = monaco.editor.create(
      document.getElementById('monaco-editor'),
      {
        value: '',
        language: 'javascript',
        theme: 'vs-dark',
      }
    );
  } else {
    editor.setValue('');
  }

  provider.awareness.setLocalStateField('user', {
    name: 'User ' + Math.floor(Math.random() * 100),
    color: userColor.color,
    colorLight: userColor.light,
  });

  monacoBinding = new MonacoBinding(
    ytext,
    editor.getModel(),
    new Set([editor]),
    provider.awareness
  );

  window.example = { provider, ydoc, ytext, monacoBinding };
}

function switchDoc(docId) {
  document.querySelectorAll('button').forEach((btn) =>
    btn.classList.remove('active-doc')
  );

  const btn = Array.from(document.querySelectorAll('button')).find((b) =>
    b.textContent.includes(docId)
  );
  if (btn) btn.classList.add('active-doc');

  loadRoom(docId);
}

function setupConnectButton() {
  const connectBtn = document.getElementById('y-connect-btn');
  connectBtn.addEventListener('click', () => {
    if (provider.shouldConnect) {
      provider.disconnect();
      connectBtn.textContent = 'Connect';
    } else {
      provider.connect();
      connectBtn.textContent = 'Disconnect';
    }
  });
}

// expose globally
window.loadRoom = loadRoom;
window.switchDoc = switchDoc;

window.addEventListener('load', () => {
  setupConnectButton();
  loadRoom('doc1');
});
