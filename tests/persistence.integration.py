"""Seed/check around an actual server restart; cleanup removes only this test's D1 rows.

python3 tests/persistence.integration.py seed /tmp/margin-restart.json
# Restart dev, or build and start production, using the same local state directory.
python3 tests/persistence.integration.py check /tmp/margin-restart.json
python3 tests/persistence.integration.py cleanup /tmp/margin-restart.json
"""
import base64, hashlib, json, os, pathlib, sqlite3, sys, urllib.request, uuid

base = os.environ.get('PDF_NOTE_BASE_URL', 'http://localhost:3002')
action, destination = sys.argv[1:]
manifest = pathlib.Path(destination)

def request(path, body=None, content_type=None, method=None):
    headers = {'Origin': base}
    if isinstance(body, dict):
        body = json.dumps(body).encode()
        content_type = 'application/json'
    if content_type:
        headers['Content-Type'] = content_type
    method = method or ('POST' if body is not None else 'GET')
    with urllib.request.urlopen(urllib.request.Request(base + path, data=body, headers=headers, method=method), timeout=30) as response:
        return response.read()

def digest(body):
    return hashlib.sha256(body).hexdigest()

if action == 'seed':
    if manifest.exists():
        raise RuntimeError('Manifest already exists; check or clean up that run first.')
    pdf = pathlib.Path('public/sample.pdf').read_bytes() + ('\n% restart-check-' + str(uuid.uuid4())).encode()
    record = json.loads(request('/api/documents', pdf, 'application/pdf'))
    test_id = record['id']
    data = {'testId': test_id, 'checks': {}}
    manifest.write_text(json.dumps(data))
    manifest.chmod(0o600)
    image = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=')
    src = json.loads(request(f'/api/documents/{test_id}/images', image, 'image/png'))['src']
    state = {
        'strokes': [{'id': 'restart-stroke', 'page': 1, 'color': '#5265db', 'width': 2, 'opacity': 1, 'points': [{'x': 10, 'y': 20}, {'x': 40, 'y': 50}]}],
        'notes': [{'id': 'restart-note', 'page': 1, 'text': 'Ghi chú vẫn còn sau restart', 'createdAt': '2026-09-07T00:00:00Z'}],
        'objects': [
            {'id': 'restart-text', 'page': 1, 'kind': 'text', 'text': 'Saved text', 'x': 20, 'y': 30, 'width': 120, 'height': 30, 'fontSize': 16, 'color': '#5265db', 'bold': True},
            {'id': 'restart-image', 'page': 1, 'kind': 'image', 'src': src, 'alt': 'Restart check', 'x': 40, 'y': 50, 'width': 20, 'height': 20},
        ],
    }
    request(f'/api/documents/{test_id}', state, method='PUT')
    # Keep a verification fixture out of the user's most-recent-document slot.
    for file in pathlib.Path('.wrangler/state/v3/d1').rglob('*.sqlite'):
        with sqlite3.connect(file) as connection:
            if connection.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='documents'").fetchone():
                connection.execute("UPDATE documents SET last_opened_at='2000-01-01T00:00:00Z' WHERE id=?", (test_id,))
    documents = json.loads(request('/api/documents'))
    data['ids'] = [document['id'] for document in documents]
    for document_id in [*data['ids'], 'sample']:
        path = '/api/documents/' + document_id
        body = request(path)
        data['checks'][path] = digest(body)
        data['checks'][path + '/versions'] = digest(request(path + '/versions'))
        if document_id != 'sample':
            data['checks'][path + '/file'] = digest(request(path + '/file'))
        for obj in json.loads(body)['objects']:
            if obj['kind'] == 'image':
                data['checks'][obj['src']] = digest(request(obj['src']))
    manifest.write_text(json.dumps(data))
    print('Seeded test PDF with ink, note, text and image; recorded hashes for existing data.')
elif action == 'check':
    data = json.loads(manifest.read_text())
    ids = {document['id'] for document in json.loads(request('/api/documents'))}
    assert set(data['ids']) <= ids, 'A previously stored PDF is missing'
    for path, expected in data['checks'].items():
        assert digest(request(path)) == expected, 'Saved data differs: ' + path
    print('PASS: original PDFs, ink, notes, text, images and per-file history survived restart.')
elif action == 'cleanup':
    data = json.loads(manifest.read_text())
    for file in pathlib.Path('.wrangler/state/v3/d1').rglob('*.sqlite'):
        with sqlite3.connect(file) as connection:
            if connection.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='documents'").fetchone():
                connection.execute('DELETE FROM versions WHERE document_id=?', (data['testId'],))
                connection.execute('DELETE FROM documents WHERE id=?', (data['testId'],))
    manifest.unlink()
    print('Removed only the temporary test document and its history from the library.')
else:
    raise ValueError('Expected seed, check or cleanup')
