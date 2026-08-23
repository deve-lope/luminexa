#!/usr/bin/env python3
"""Install a Firebase service-account JSON for FCM push (safe to run multiple times).

Hand-editing the env file mangles the private_key \\n escapes, which yields
credentials that are found but rejected (fcm_enabled=True, initialized=False).
This writes the value programmatically instead. Prints no secret values.

  scripts/setup-firebase-credentials.py ~/Downloads/luminexa-c7587-abc123.json
  scripts/setup-firebase-credentials.py <json> --check      # dry run, writes nothing
  scripts/setup-firebase-credentials.py <json> --mode file  # bind-mounted key file
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_ENV_FILE = ROOT / '.env.docker.prod'
GOOGLE_SERVICES = ROOT / 'frontend' / 'android' / 'app' / 'google-services.json'
SECRET_FILE_NAME = 'firebase-service-account.json'
CONTAINER_SECRET_PATH = f'/app/secrets/{SECRET_FILE_NAME}'

REQUIRED_FIELDS = ('project_id', 'private_key', 'client_email', 'token_uri')
PEM_HEADER = '-----BEGIN PRIVATE KEY-----'
PEM_FOOTER = '-----END PRIVATE KEY-----'

JSON_KEY = 'FIREBASE_CREDENTIALS_JSON'
FILE_KEY = 'FIREBASE_CREDENTIALS_FILE'


def fail(message: str) -> None:
    print(f'error: {message}', file=sys.stderr)
    raise SystemExit(1)


def load_service_account(path: Path) -> dict:
    """Parse + validate the download. Never echoes a value back."""
    if not path.is_file():
        fail(f'no such file: {path}')
    try:
        raw = path.read_text(encoding='utf-8')
    except OSError as exc:
        fail(f'cannot read {path}: {exc}')
    try:
        obj = json.loads(raw)
    except json.JSONDecodeError as exc:
        fail(
            f'{path.name} is not valid JSON (line {exc.lineno}, column {exc.colno}). '
            'Re-download it from Firebase → Project settings → Service accounts.'
        )
    if not isinstance(obj, dict):
        fail(f'{path.name} must be a JSON object, got {type(obj).__name__}')
    if obj.get('type') != 'service_account':
        fail(
            f'{path.name} has type={obj.get("type")!r}, expected "service_account". '
            'This looks like google-services.json or an OAuth client, not a '
            'service-account private key.'
        )
    missing = [f for f in REQUIRED_FIELDS if not str(obj.get(f) or '').strip()]
    if missing:
        fail(f'{path.name} is missing or has empty: {", ".join(missing)}')

    key = obj['private_key']
    if PEM_HEADER not in key or PEM_FOOTER not in key:
        fail(
            'private_key has no PEM header/footer after JSON decoding — this download '
            'is already mangled. Get a fresh key and do not edit it by hand.'
        )
    if '\n' not in key:
        fail('private_key decoded without any newlines — this download is mangled.')
    return obj


def check_project(obj: dict, allow_mismatch: bool) -> None:
    """Refuse a key from a different Firebase project than the Android app uses."""
    if not GOOGLE_SERVICES.is_file():
        print(
            f'note: {GOOGLE_SERVICES.relative_to(ROOT)} not present (gitignored) — '
            'skipping the project match check'
        )
        return
    try:
        info = json.loads(GOOGLE_SERVICES.read_text(encoding='utf-8'))
        expected = (info.get('project_info') or {}).get('project_id') or ''
    except (OSError, json.JSONDecodeError, AttributeError) as exc:
        print(f'note: cannot read project_id from google-services.json ({exc})')
        return
    if not expected:
        print('note: google-services.json has no project_info.project_id')
        return
    if obj['project_id'] == expected:
        return
    message = (
        f'project mismatch: this service account is for {obj["project_id"]!r} but the '
        f'Android app ships google-services.json for {expected!r}. A key from another '
        'Firebase project initializes cleanly and then silently delivers nothing, '
        'because the device tokens belong to a different project. Re-download the key '
        'from the correct project, or pass --allow-project-mismatch if you mean it.'
    )
    if not allow_mismatch:
        fail(message)
    print(f'warning: {message}')


def read_env_file(env_file: Path) -> str:
    if not env_file.is_file():
        fail(f'{env_file} not found — run scripts/docker-init-env.sh first')
    try:
        return env_file.read_text(encoding='utf-8')
    except OSError as exc:
        fail(f'cannot read {env_file}: {exc}')


def active_value(text: str, key: str) -> str | None:
    """Value of the first uncommented KEY= line, or None. Commented lines are ignored."""
    prefix = key + '='
    for line in text.splitlines():
        if line.lstrip().startswith(prefix):
            return line.lstrip()[len(prefix):].strip()
    return None


def upsert(text: str, key: str, value: str) -> tuple[str, bool]:
    """Replace the first uncommented KEY= line in place, else append. Every other
    line is preserved byte-for-byte, as is the trailing-newline convention."""
    new_line = f'{key}={value}'
    prefix = key + '='
    out: list[str] = []
    replaced = False
    for line in text.splitlines(keepends=True):
        if not replaced and line.lstrip().startswith(prefix):
            body = line.rstrip('\r\n')
            out.append(new_line + (line[len(body):] or '\n'))
            replaced = True
        else:
            out.append(line)
    if replaced:
        return ''.join(out), True

    trailing_newline = text == '' or text.endswith('\n')
    if out and not out[-1].endswith('\n'):
        out[-1] += '\n'
    out.append(new_line + ('\n' if trailing_newline else ''))
    return ''.join(out), False


def backup_env_file(env_file: Path) -> Path:
    """Timestamped sibling copy. The .bak suffix is what .gitignore matches."""
    stamp = datetime.now().strftime('%Y%m%d-%H%M%S')
    dest = env_file.with_name(f'{env_file.name}.{stamp}.bak')
    shutil.copy2(env_file, dest)
    dest.chmod(0o600)
    return dest


def git_ignored(path: Path) -> bool | None:
    """True / False, or None when git cannot answer (e.g. path outside the repo)."""
    try:
        result = subprocess.run(
            ['git', 'check-ignore', '-q', str(path)],
            cwd=ROOT,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=10,
        )
    except (OSError, subprocess.SubprocessError):
        return None
    return result.returncode == 0 if result.returncode in (0, 1) else None


def warn_if_tracked(path: Path, label: str) -> None:
    ignored = git_ignored(path)
    if ignored is False:
        print(f'WARNING: {label} is NOT gitignored — do not commit it: {path}')
    elif ignored is None:
        print(f'note: could not confirm {label} is gitignored: {path}')


def report_source(obj: dict, path: Path) -> None:
    key = obj['private_key']
    print(f'source:      {path}')
    print(f'fields:      {", ".join(sorted(obj))}')
    print(f'project_id:  {obj["project_id"]}')
    print(f'private_key: {len(key)} chars, {key.count(chr(10))} newlines, PEM header + footer ok')


def next_steps() -> None:
    print('')
    print('Next:')
    print('  docker compose up -d web   # add celery-worker / celery-beat if they send push')
    print('  docker compose exec -T web python -c "')
    print("import os, django; os.environ.setdefault('DJANGO_SETTINGS_MODULE','luminexa.settings'); django.setup()")
    print('from jobs.push_services import fcm_enabled, _ensure_firebase')
    print("print('fcm_enabled =', fcm_enabled(), '| initialized =', _ensure_firebase() is not None)\"")
    print('')
    print('Both must print True. True / False means the credentials were found but')
    print('rejected — check the web log for "Failed to initialize Firebase for FCM".')


def run_env_mode(obj: dict, env_file: Path, text: str, check: bool) -> None:
    payload = json.dumps(obj, separators=(',', ':'))
    if "'" in payload:
        fail(
            'this JSON contains a single quote, which cannot be quoted safely in a '
            'Compose env_file. Use --mode file instead.'
        )
    # The single quotes are required, not cosmetic: Compose interpolates $NAME in an
    # unquoted env_file value, and a double-quoted value ends at the JSON's first
    # inner " which makes the whole env file unreadable.
    value = f"'{payload}'"

    if active_value(text, JSON_KEY) == value:
        print(f'{JSON_KEY} in {env_file.name} is already up to date '
              f'({len(payload)} chars) — nothing to write.')
    elif check:
        action = 'replace in place' if active_value(text, JSON_KEY) is not None else 'append'
        print(f'would {action} {JSON_KEY} in {env_file.name} '
              f'({len(payload)} chars, single-quoted)')
    else:
        backup = backup_env_file(env_file)
        print(f'backup:      {backup}   (this holds your other production secrets)')
        warn_if_tracked(backup, 'the backup')
        updated, replaced = upsert(text, JSON_KEY, value)
        env_file.write_text(updated, encoding='utf-8')
        print(f'{"replaced" if replaced else "appended"}:    {JSON_KEY} in {env_file.name} '
              f'({len(payload)} chars, single-quoted)')

    if active_value(text, FILE_KEY):
        print('')
        print(f'WARNING: {FILE_KEY} is also set in {env_file.name}. _ensure_firebase()')
        print(f'         prefers that path, so {JSON_KEY} would be ignored. Comment the')
        print(f'         {FILE_KEY} line out, or use --mode file instead.')


def run_file_mode(obj: dict, source: Path, env_file: Path, text: str, check: bool) -> None:
    secret_file = env_file.parent / 'secrets' / SECRET_FILE_NAME
    try:
        shown = f'./{secret_file.relative_to(ROOT)}'
    except ValueError:
        shown = str(secret_file)
    existing = active_value(text, FILE_KEY)

    if check:
        print(f'would install the key at {shown} (mode 600)')
        if existing == CONTAINER_SECRET_PATH:
            print(f'{FILE_KEY} already points at {CONTAINER_SECRET_PATH} — no env change')
        else:
            action = 'replace in place' if existing is not None else 'append'
            print(f'would {action} {FILE_KEY}={CONTAINER_SECRET_PATH} in {env_file.name}')
    else:
        secret_file.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, secret_file)
        secret_file.chmod(0o600)
        print(f'installed:   {shown} (mode 600)')
        if existing == CONTAINER_SECRET_PATH:
            print(f'{FILE_KEY} already points at {CONTAINER_SECRET_PATH} — env file unchanged')
        else:
            backup = backup_env_file(env_file)
            print(f'backup:      {backup}   (this holds your other production secrets)')
            warn_if_tracked(backup, 'the backup')
            updated, replaced = upsert(text, FILE_KEY, CONTAINER_SECRET_PATH)
            env_file.write_text(updated, encoding='utf-8')
            print(f'{"replaced" if replaced else "appended"}:    '
                  f'{FILE_KEY}={CONTAINER_SECRET_PATH} in {env_file.name}')
        warn_if_tracked(secret_file, 'the installed key')

    print('')
    print('docker-compose.yml still needs the read-only mount under web (and any celery')
    print('service that sends push) — /app/secrets does not exist otherwise:')
    print(f'    - {shown}:{CONTAINER_SECRET_PATH}:ro')


def main() -> None:
    parser = argparse.ArgumentParser(
        description='Install a Firebase service-account JSON for FCM push.'
    )
    parser.add_argument('service_account', type=Path,
                        help='path to the JSON downloaded from the Firebase console')
    parser.add_argument('--mode', choices=('env', 'file'), default='env',
                        help='env (default): write FIREBASE_CREDENTIALS_JSON into the env '
                             'file. file: install the key and set FIREBASE_CREDENTIALS_FILE '
                             '(needs a compose bind mount).')
    parser.add_argument('--check', action='store_true',
                        help='validate and report planned changes without writing')
    parser.add_argument('--allow-project-mismatch', action='store_true',
                        help='proceed even if project_id differs from google-services.json')
    parser.add_argument('--env-file', type=Path, default=DEFAULT_ENV_FILE,
                        help=f'env file to update (default: {DEFAULT_ENV_FILE})')
    args = parser.parse_args()

    obj = load_service_account(args.service_account)
    check_project(obj, args.allow_project_mismatch)
    report_source(obj, args.service_account)
    env_file = args.env_file.expanduser().resolve()
    text = read_env_file(env_file)
    print('')

    if args.mode == 'env':
        run_env_mode(obj, env_file, text, args.check)
    else:
        run_file_mode(obj, args.service_account, env_file, text, args.check)

    if args.check:
        print('')
        print('--check: nothing was written.')
    else:
        next_steps()


if __name__ == '__main__':
    main()
