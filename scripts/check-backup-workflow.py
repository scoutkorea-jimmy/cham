"""Run workflow guards with fake R2 responses; no credentials/network required."""
import os
import pathlib
import subprocess
import tempfile
import textwrap

root = pathlib.Path(__file__).resolve().parents[1]
workflow = (root / '.github/workflows/backup.yml').read_text()
blocks = []
for part in workflow.split('        run: |\n')[1:]:
    lines = []
    for line in part.splitlines():
        if line and not line.startswith('          '):
            break
        lines.append(line[10:])
    blocks.append('\n'.join(lines))
guard, export, upload, verify = blocks
assert 'r2 object get' in verify and '--remote' in verify

with tempfile.TemporaryDirectory() as tmp:
    work = pathlib.Path(tmp)
    mock = work / 'npx'
    mock.write_text(textwrap.dedent('''\
        #!/bin/bash
        set -eu
        while [ "$#" -gt 0 ]; do
          case "$1" in --file=*) target="${1#--file=}";; esac
          shift
        done
        case "$R2_RESPONSE" in
          match) cp "cham-${DAY}.sql" "$target";;
          wrong) echo 'wrong object' > "$target";;
          empty) : > "$target";;
          missing) exit 1;;
        esac
    '''))
    mock.chmod(0o700)
    env = {**os.environ, 'PATH': tmp + os.pathsep + os.environ['PATH'], 'DAY': '2026-09-30'}
    (work / 'cham-2026-09-30.sql').write_text('CREATE TABLE demo (id INTEGER);\n')
    for token, account, expected in [('', '', False), ('fake', '', False), ('', 'fake', False), ('fake', 'fake', True)]:
        result = subprocess.run(['bash', '-e', '-c', guard], cwd=tmp,
                                env={**env, 'TOKEN': token, 'ACCOUNT': account}, capture_output=True)
        assert (result.returncode == 0) == expected, ('secret guard', token, account)
    for response in ['match', 'wrong', 'empty', 'missing']:
        result = subprocess.run(['bash', '-e', '-c', verify], cwd=tmp,
                                env={**env, 'R2_RESPONSE': response}, capture_output=True)
        assert (result.returncode == 0) == (response == 'match'), response
    for block in blocks:
        assert subprocess.run(['bash', '-n'], input=block, text=True, capture_output=True).returncode == 0
print('PASS: secret guards (4), R2 verification (4), bash syntax (4)')
