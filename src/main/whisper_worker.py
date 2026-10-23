# 오프라인 한국어 음성인식 상주 프로세스 (Faster-Whisper small, CPU INT8).
# main.js가 띄우고 stdin/stdout으로 JSON 한 줄씩 주고받는다 (출력은 ASCII 이스케이프라 인코딩 문제 없음).
#   입력: {"hotwords": "피카츄 꼬부기 ..."}            인식 힌트(포켓몬·기술 이름) 설정
#         {"id": 1, "pcm": "<base64 16kHz mono int16le>"}  발화 하나
#   출력: {"ready": true, "threads": 4} / {"id": 1, "text": "...", "ms": 420} / {"error": "..."}
import base64
import json
import os
import sys
import time

import numpy as np
from faster_whisper import WhisperModel

MODEL_DIR = sys.argv[1]
THREADS = max(1, min(4, os.cpu_count() or 1))   # 저사양 PC에서 다른 작업을 막지 않게 최대 4스레드
# 소음에서 지어낸 문장 거르기. 측정값: 명령(TTS)은 평균 로그확률 -0.5 이상·무음 확률 0.02 이하,
# 소음은 힌트 단어("피카츄", "크롬")를 지어내는데 로그확률 -1.1~-2.2·무음 확률 0.44~0.6
MIN_LOGPROB = -1.0   # 이보다 낮으면 버린다
NO_SPEECH = 0.5      # 무음 확률이 이보다 높으면
NO_SPEECH_LOGPROB = -0.6   # 로그확률 기준을 이만큼 엄하게


# Node는 UTF-8로 쓰는데 Windows 파이썬은 파이프를 cp949로 읽어 힌트 단어(한글)가 깨진다
sys.stdin.reconfigure(encoding='utf-8')


def out(obj):
    sys.stdout.write(json.dumps(obj) + '\n')
    sys.stdout.flush()


try:
    model = WhisperModel(MODEL_DIR, device='cpu', compute_type='int8', cpu_threads=THREADS, num_workers=1)
    model.transcribe(np.zeros(16000, dtype=np.float32), language='ko', beam_size=1)   # 첫 인식이 느리지 않게 예열
except Exception as e:
    out({'error': f'모델 로드 실패: {e}'})
    sys.exit(1)
out({'ready': True, 'threads': THREADS})

hotwords = None
for line in sys.stdin:
    try:
        req = json.loads(line)
        if 'hotwords' in req:
            hotwords = req['hotwords'] or None
            continue
        t0 = time.perf_counter()
        audio = np.frombuffer(base64.b64decode(req['pcm']), dtype=np.int16).astype(np.float32) / 32768.0
        segments, _ = model.transcribe(
            audio, language='ko', beam_size=3, temperature=0.0, vad_filter=False,
            condition_on_previous_text=False, without_timestamps=True, hotwords=hotwords,
        )
        text = ' '.join(s.text.strip() for s in segments
                        if s.avg_logprob >= MIN_LOGPROB
                        and not (s.no_speech_prob > NO_SPEECH and s.avg_logprob < NO_SPEECH_LOGPROB)).strip()
        out({'id': req['id'], 'text': text, 'ms': round((time.perf_counter() - t0) * 1000)})
    except Exception as e:
        out({'id': req.get('id') if isinstance(req, dict) else None, 'error': str(e)})
