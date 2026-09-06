"""Run against the local server; only creates and removes its own test records."""
import urllib.request, urllib.error, json, pathlib, sqlite3, os
base=os.environ.get('PDF_NOTE_BASE_URL','http://localhost:3002')
created_folders=[]
doc=None
other_doc=None

def request(path,method='GET',body=None,headers=None):
    h={'Origin':base,**(headers or {})}
    if isinstance(body,dict): body=json.dumps(body).encode();h['Content-Type']='application/json'
    try:
        with urllib.request.urlopen(urllib.request.Request(base+path,method=method,data=body,headers=h),timeout=25) as r:
            raw=r.read();return r.status,json.loads(raw)
    except urllib.error.HTTPError as e: return e.code,e.read().decode()
try:
    status,parent=request('/api/folders','POST',{'name':'Integration parent'});assert status==201,(status,parent);created_folders.append(parent['id'])
    status,child=request('/api/folders','POST',{'name':'Integration child','parentId':parent['id']});assert status==201;created_folders.append(child['id'])
    status,record=request('/api/documents','POST',pathlib.Path('public/sample.pdf').read_bytes(),{'Content-Type':'application/pdf','X-File-Name':'Integration.pdf','X-Folder-Id':child['id']});assert status==201,(status,record);doc=record['id']
    assert record['folderId']==child['id']
    assert request('/api/documents/'+doc+'/opened','POST')[0]==200
    saved=next(d for d in request('/api/documents')[1] if d['id']==doc);assert saved['lastOpenedAt']
    assert request('/api/documents/'+doc,'PATCH',{'name':'Renamed.pdf','folderId':parent['id']})[0]==200
    saved=next(d for d in request('/api/documents')[1] if d['id']==doc);assert saved['name']=='Renamed.pdf' and saved['folderId']==parent['id']
    assert request('/api/folders/'+child['id'],'PATCH',{'name':'Renamed child'})[0]==200
    path='/api/documents/'+doc
    first={'strokes':[],'notes':[{'id':'first','page':1,'text':'Bản đầu tiên','createdAt':'2026-09-07T00:00:00Z'}],'objects':[]}
    first['objects']=[{'id':'styled-text','page':1,'kind':'text','text':'Chữ đậm và gạch chân','x':40,'y':50,'width':250,'height':70,'fontSize':22,'color':'#cc4455','fontFamily':'Liberation Serif','bold':True,'italic':True,'underline':True,'strikethrough':False,'align':'center','lineHeight':1.5}]
    second={'strokes':[],'notes':[{'id':'second','page':1,'text':'Bản tiếp theo','createdAt':'2026-09-07T00:00:00Z'}],'objects':[]}
    assert request(path,'PUT',first)[0]==200
    status,versions=request(path+'/versions');assert len(versions)==2,(status,versions)
    first_version=next(v for v in versions if v['kind']=='autosave')
    assert request(path,'PUT',first)[0]==200
    assert len(request(path+'/versions')[1])==2, 'identical autosave duplicated history'
    assert request(path,'PUT',second)[0]==200
    restore_path=path+'/versions/'+first_version['id']
    assert request(restore_path,'POST',headers={'Origin':'http://outside.example'})[0]==403
    assert request(restore_path,'POST')[0]==200
    assert request(path)[1]==first
    assert len(request(path+'/versions')[1])==4
    assert request(path+'/versions')[1][0]['kind']=='restore'
    status,other=request('/api/documents','POST',pathlib.Path('public/sample.pdf').read_bytes(),{'Content-Type':'application/pdf','X-File-Name':'Other-integration.pdf'});assert status==201;other_doc=other['id']
    other_path='/api/documents/'+other_doc
    assert request(other_path,'PUT',second)[0]==200
    own=request(path+'/versions')[1];other_versions=request(other_path+'/versions')[1]
    assert all(v['documentId']==doc for v in own)
    assert all(v['documentId']==other_doc for v in other_versions)
    assert not {v['id'] for v in own}.intersection(v['id'] for v in other_versions)
    assert request(other_path+'/versions/'+first_version['id'],'POST')[0]==404
    assert request(other_path)[1]==second
    assert request('/api/versions')[0]==404
    assert request(path,'PATCH',{'folderId':'not-a-folder'})[0]==400
    print('PASS: nested folders, upload into folder, recent opening, rename/move, isolated per-PDF history, version persistence/deduplication/restore, cross-file restore rejection, cross-origin rejection')
finally:
    for file in pathlib.Path('.wrangler/state/v3/d1').rglob('*.sqlite'):
        with sqlite3.connect(file) as connection:
            if connection.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='documents'").fetchone():
                for target in [doc,other_doc]:
                    if target:
                        connection.execute('DELETE FROM versions WHERE document_id=?',(target,))
                        connection.execute('DELETE FROM documents WHERE id=?',(target,))
                for folder in reversed(created_folders):connection.execute('DELETE FROM folders WHERE id=?',(folder,))
                connection.commit()
    print('Temporary test records removed; existing documents untouched')
