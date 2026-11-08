"""Package the repository Skill without installing it or modifying host configuration."""
import hashlib, json, pathlib, re, uuid, zipfile
root = pathlib.Path(__file__).resolve().parent.parent
source = root / 'integrations' / 'skill' / 'a2game'
files = sorted(source.rglob('*'))
assert not any(p.is_symlink() for p in files), 'Skill symlinks are not allowed'
files = [p for p in files if p.is_file()]
entry = (source/'SKILL.md').read_text(encoding='utf-8')
assert entry.startswith('---\n') and re.search(r'^name: a2game$', entry, re.M) and re.search(r'^description: .+', entry, re.M)
for target in re.findall(r'\]\(([^)]+)\)', entry):
    assert not pathlib.PurePosixPath(target).is_absolute() and '..' not in pathlib.PurePosixPath(target).parts
    assert (source/target).is_file(), target
for path in files:
    relative = path.relative_to(source).as_posix()
    assert (path.suffix == '.md' or relative in {'agents/openai.yaml', 'LICENSE'}) and path.stat().st_size <= 64*1024
directory = root/'output'/'skill'/str(uuid.uuid4()); directory.mkdir(parents=True)
destination = directory/'a2game.zip'
with zipfile.ZipFile(destination, 'x', zipfile.ZIP_DEFLATED) as archive:
    for path in files:
        archive.write(path, pathlib.PurePosixPath('a2game', *path.relative_to(source).parts).as_posix())
with zipfile.ZipFile(destination) as archive:
    assert archive.testzip() is None
    assert archive.read('a2game/SKILL.md').decode('utf-8') == entry
    for path in files:
        assert archive.read('a2game/' + path.relative_to(source).as_posix()) == path.read_bytes()
receipt = {'format':'a2game-skill-package','version':1,'status':'PASS_LOCAL','package':destination.relative_to(root).as_posix(),'sha256':hashlib.sha256(destination.read_bytes()).hexdigest(),'files':{p.relative_to(source).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in files},'installation':'NOT_RUN','agentHostExecution':'NOT_RUN','modelCalls':0}
(directory/'receipt.json').write_text(json.dumps(receipt, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print(json.dumps(receipt, ensure_ascii=False))
