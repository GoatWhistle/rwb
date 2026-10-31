#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
[ -x .venv/bin/python ] || { echo "Сначала создайте .venv через scripts/bootstrap-demo.sh"; exit 1; }
source_models="${1:-../sber_potok/models}"
.venv/bin/python - "$source_models" <<'PY'
import hashlib
from pathlib import Path
import shutil
import sys
from backend.config import settings

source = Path(sys.argv[1]).resolve()
target = settings().gigaam_model_dir.resolve()
names = ("v3_e2e_ctc.ckpt", "v3_e2e_ctc_tokenizer.model")
for name in names:
    if not (source / name).is_file():
        raise SystemExit(f"Нет {source / name}. Передайте путь к готовым моделям: bash scripts/setup-voice.sh /path/to/models")
target.mkdir(parents=True, exist_ok=True)
for name in names:
    origin, dest = source / name, target / name
    if origin != dest:
        shutil.copy2(origin, dest)
    with origin.open("rb") as left, dest.open("rb") as right:
        if hashlib.file_digest(left, "sha256").digest() != hashlib.file_digest(right, "sha256").digest():
            raise SystemExit(f"Не совпала контрольная сумма: {name}")
    print(f"Модель проверена: {dest}")
PY
.venv/bin/python -m pip install -e '.[voice]'
echo "Голосовой ввод готов. Перезапустите API или scripts/run-demo.sh. Веса не скачивались."
