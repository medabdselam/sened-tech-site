"""Build a public-only Pages artifact; new files require an explicit manifest entry."""
import json, re, shutil, sys
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

# كل ملف عام يحتاج سطرًا في المانيفست، وإغفاله لا يُسقط البناء بل يُنتج صفحة
# حيّة بأصل ناقص — تنسيق ضائع أو صورة مكسورة لا يراها أحد حتى يشتكي زائر.
# نقرأ هنا ما تشير إليه الصفحات فعلًا ونطابقه بما نُسخ.
REF = re.compile(r'(?:src|href)="(/[^"#?]*)', re.I)
staged = {p.relative_to(output).as_posix() for p in output.rglob('*') if p.is_file()}
missing = {}
for page in sorted(output.rglob('*')):
    if page.suffix.lower() not in ('.html', '.css'):
        continue
    for ref in REF.findall(page.read_text(encoding='utf-8', errors='replace')):
        target = ref.lstrip('/')
        if target.endswith('/') or not target:
            target += 'index.html'
        if target not in staged:
            missing.setdefault(target, set()).add(page.relative_to(output).as_posix())
if missing:
    for target, pages in sorted(missing.items()):
        print('  referenced but not published: /%s  (from %s)' % (target, ', '.join(sorted(pages))), file=sys.stderr)
    raise SystemExit('Add the file(s) above to tools/public-files.json, or fix the reference.')

print('Staged', len(checked), 'public files to', output)
print('Checked', len(staged), 'published paths; every local reference resolves.')
