import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { MonacoBinding } from 'y-monaco';
import * as monaco from 'monaco-editor';
import * as random from 'lib0/random';

document.addEventListener('DOMContentLoaded', () => {
  const ydoc = new Y.Doc();
  const docsMap = ydoc.getMap('documents');
  const docList = ydoc.getArray('doc-list');

  (async () => {
    const token = await fetch('http://localhost:5173/auth/token').then(r => r.text());

    window.provider = new WebsocketProvider('ws://localhost:3002', 'shared-room', ydoc, {
      params: { yauth: token }
    });

    provider.awareness.setLocalStateField('user', {
      name: 'User ' + Math.floor(Math.random() * 100),
      color: random.uint32() % 2 ? '#30bced' : '#ee6352',
      colorLight: random.uint32() % 2 ? '#30bced33' : '#ee635233'
    });

    setupUI(ydoc, docsMap, docList);
  })();
});

async function setupUI(ydoc, docsMap, docList) {
  const editor = monaco.editor.create(document.getElementById('monaco-editor'), {
    value: '',
    language: 'javascript',
    theme: 'vs-dark',
    automaticLayout: true
  });

  let currentBinding = null;

  function bindEditorToDoc(docname) {
    if (currentBinding) {
      currentBinding.destroy();
    }

    let ytext = docsMap.get(docname);
    if (!ytext) {
      ytext = new Y.Text();
      docsMap.set(docname, ytext);
    }

    // Set Monaco model content and bind
    const model = editor.getModel();
    model.setValue(ytext.toString());

    currentBinding = new MonacoBinding(ytext, model, new Set([editor]), provider.awareness);
    currentBinding.docname = docname;

    renderDocList();
  }

  function renderDocList() {
    const ul = document.getElementById('doc-list');
    ul.innerHTML = '';
    const names = docList.toArray();
    const active = currentBinding?.docname;
    names.forEach(name => {
      const li = document.createElement('li');
      li.textContent = name;
      if (name === active) li.classList.add('active');
      ul.appendChild(li);
    });
  }

  // Setup doc list interaction
  document.getElementById('doc-list').addEventListener('click', e => {
    if (e.target.tagName === 'LI') {
      const docname = e.target.textContent;
      bindEditorToDoc(docname);
    }
  });

  document.getElementById('new-doc-btn').addEventListener('click', () => {
    const name = prompt('New document name');
    if (name && !docList.toArray().includes(name)) {
      docList.push([name]);
      bindEditorToDoc(name);
    }
  });

  docList.observe(() => renderDocList());

  // Load initial document
  const all = docList.toArray();
  if (all.length) {
    bindEditorToDoc(all[0]);
  }

  // Awareness: show users
  provider.awareness.on('change', () => {
    const usersDiv = document.getElementById('users');
    usersDiv.innerHTML = Array.from(provider.awareness.getStates().values())
      .filter(s => s.user)
      .map(s => `<div style="color:${s.user.color}">• ${s.user.name}</div>`)
      .join('');
  });

  // Connect/disconnect
  document.getElementById('y-connect-btn').onclick = () => {
    const btn = document.getElementById('y-connect-btn');
    if (provider.wsconnected) {
      provider.disconnect();
      btn.textContent = 'Connect';
    } else {
      provider.connect();
      btn.textContent = 'Disconnect';
    }
  };
}
