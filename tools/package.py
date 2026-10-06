from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
root=Path(__file__).resolve().parents[1]
out=root/'dist';out.mkdir(exist_ok=True)
with ZipFile(out/'circle-hostinger-mvp.zip','w',ZIP_DEFLATED) as z:
    for directory in ('circle','private-circle','database','docs','tools'):
        for p in sorted((root/directory).rglob('*')):
            if p.is_file() and p.name!='config.php' and 'storage' not in p.parts:
                z.write(p,p.relative_to(root))
    z.write(root/'README.md','README.md')
print(out/'circle-hostinger-mvp.zip')
