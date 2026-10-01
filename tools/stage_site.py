"""Build a public-only Pages artifact; new files require an explicit manifest entry."""
import json, shutil, sys
from pathlib import Path
root = Path(__file__).resolve().parents[1]
output = Path(sys.argv[1]).resolve() if len(sys.argv)>1 else root/'_site'
if output.exists():
    raise SystemExit('Output must not already exist; choose an empty new path.')
files = json.loads((root/'tools/public-files.json').read_text(encoding='utf-8'))
if not isinstance(files, list):
    raise SystemExit('Manifest must be a JSON array of path strings.')
checked = []
for name in files:
    if not isinstance(name, str) or not name:
        raise SystemExit('Manifest entries must be non-empty strings: '+repr(name))
    rel = Path(name)
    if rel.is_absolute() or '..' in rel.parts or any(p.startswith('.') for p in rel.parts if p != '.well-known'):
        raise SystemExit('Invalid public path: '+name)
    src = root/rel
    if not src.resolve().is_relative_to(root) or any(p.is_symlink() for p in [src, *src.parents] if p.is_relative_to(root)):
        raise SystemExit('Symlink or path escape: '+name)
    if not src.is_file():
        raise SystemExit('Missing public file: '+name)
    checked.append((src, rel))
for src, rel in checked:
    dest = output/rel
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(src, dest)
(output/'.nojekyll').touch()
print('Staged', len(checked), 'public files to', output)
