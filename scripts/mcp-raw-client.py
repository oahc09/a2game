"""Independent newline JSON-RPC client, standard library only; no model calls."""
import json, pathlib, queue, subprocess, sys, threading
node, server, exercise = sys.argv[1:4]
no_sdk = '--expect-no-sdk' in sys.argv[4:]
child = subprocess.Popen([node, server], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding='utf-8')
messages = queue.Queue()
def receive():
    for line in child.stdout:
        messages.put(json.loads(line))
threading.Thread(target=receive, daemon=True).start()
counter = 0
def request(method, params):
    global counter
    counter += 1
    child.stdin.write(json.dumps({'jsonrpc':'2.0','id':counter,'method':method,'params':params}, ensure_ascii=False)+'\n'); child.stdin.flush()
    while True:
        response = messages.get(timeout=120)
        if response.get('id') == counter:
            if 'error' in response:
                raise RuntimeError(str(response['error']))
            return response['result']
def call(name, arguments):
    response = request('tools/call', {'name':name,'arguments':arguments})
    value = response.get('structuredContent') or json.loads(response['content'][0]['text'])
    assert value['status'] == 'PASS_REFERENCE', value
    return value['data']
try:
    init = request('initialize', {'protocolVersion':'2025-11-25','capabilities':{},'clientInfo':{'name':'a2game-python-raw-client','version':'1.0.0'}})
    child.stdin.write(json.dumps({'jsonrpc':'2.0','method':'notifications/initialized'})+'\n'); child.stdin.flush()
    tools = request('tools/list', {})
    assert len(tools['tools']) == 9
    call('a2game.list_capabilities', {'limit':2})
    call('a2game.get_capability', {'id':'a2game.core.state','version':'0.1.0'})
    fields = {target:pathlib.Path(exercise, source+'.json').read_text(encoding='utf-8') for source,target in [('game','gameJson'),('conformance','conformanceJson'),('solution','solutionJson')]}
    artifact = call('a2game.validate_game', fields)
    tested = call('a2game.test_game', {'artifactId':artifact['artifactId']})
    exported = call('a2game.export_game', {'artifactId':artifact['artifactId']})
    if no_sdk:
        preview = request('tools/call', {'name':'a2game.preview_game','arguments':{'action':'open','artifactId':artifact['artifactId'],'backend':'air'}})
        assert preview['structuredContent']['status'] == 'BLOCKED', preview
        assert preview['structuredContent']['diagnostics'][0]['code'] == 'A2G_GEN_SDK_REQUIRED'
    print(json.dumps({'name':'Python standard-library JSON-RPC client','version':sys.version.split()[0],'status':'PASS_REFERENCE','protocolVersion':init['protocolVersion'],'toolCount':9,'finalHash':tested['exactHash'],'exportSha256':exported['sha256'],'missingSdkRejected':no_sdk,'modelCalls':0}))
finally:
    child.stdin.close()
    try:
        child.wait(timeout=15)
    except subprocess.TimeoutExpired:
        child.kill(); child.wait()
