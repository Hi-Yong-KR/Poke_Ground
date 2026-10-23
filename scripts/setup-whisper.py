# 오프라인 한국어 음성인식(Faster-Whisper small) 준비: 파이썬 가상환경 .venv 를 만들고
# faster-whisper를 설치한 뒤 small 모델(약 480MB)을 받는다. CPU 전용이라 GPU 없는 저사양 PC에서도 돈다
# (불러올 때 INT8로 양자화해서 메모리 약 0.5GB).
# 사용법: python scripts/setup-whisper.py   (또는 npm run fetch-whisper)
import os
import subprocess
import venv

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VENV = os.path.join(ROOT, '.venv')
PY = os.path.join(VENV, 'Scripts', 'python.exe') if os.name == 'nt' else os.path.join(VENV, 'bin', 'python')
MODEL_REPO = 'Systran/faster-whisper-small'
MODEL_DIR = os.path.join(ROOT, 'assets', 'models', 'whisper-small')


def run(*args):
    print('>', ' '.join(args), flush=True)
    subprocess.check_call(args)


if not os.path.exists(PY):
    print('가상환경 만드는 중:', VENV, flush=True)
    venv.create(VENV, with_pip=True)

run(PY, '-m', 'pip', 'install', '--disable-pip-version-check', '-q', 'faster-whisper', 'huggingface_hub')

if os.path.exists(os.path.join(MODEL_DIR, 'model.bin')):
    print('이미 있음:', MODEL_DIR)
else:
    print(f'모델 받는 중 (약 480MB): {MODEL_REPO}', flush=True)
    run(PY, '-c', 'import sys; from huggingface_hub import snapshot_download; '
        'snapshot_download(sys.argv[1], local_dir=sys.argv[2])', MODEL_REPO, MODEL_DIR)
print('완료:', MODEL_DIR)
