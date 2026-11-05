# ─────────────────────────────────────────────
# Look at Life - AI 서버(FastAPI) 이미지
# 빌드:  docker build -t lal-ai ./ai_server   (저장소 루트에서)
#
# 이미지에 넣지 않는 것 (실행할 때 연결/주입):
#   - 모델 파일  : ./ai_server/models     → /app/models       (SAM 1.2GB, YOLO)
#   - ChromaDB  : ./ai_server/chroma_data → /app/chroma_data  (데이터 보존)
#   - HF 캐시   : 볼륨                     → /app/.cache/huggingface (FashionCLIP 재다운로드 방지)
#   - 비밀 값    : .env → docker compose의 env_file로 주입
# ─────────────────────────────────────────────

# slim-bookworm으로 고정: 아래 apt 패키지 이름이 데비안 버전에 따라 바뀔 수 있어서
FROM python:3.10-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    HF_HOME=/app/.cache/huggingface

# ultralytics가 쓰는 OpenCV(cv2)가 필요로 하는 시스템 라이브러리
RUN apt-get update \
 && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 의존성 먼저 설치 → 코드만 바뀌면 이 단계는 캐시 재사용
# 0) pip 업그레이드: 오래된 pip는 PyTorch 저장소의 일부 패키지 이름 표기(Jinja2/jinja2 등)를 거부한다.
# 1) torch/torchvision은 CPU 전용 버전(+cpu)을 명시해서 설치한다.
#    기본 저장소(PyPI)의 리눅스용 torch는 NVIDIA GPU 라이브러리(수 GB)를 함께 설치하는데, 서버에는 GPU가 없다.
#    +cpu 버전은 PyTorch 저장소에만 있고, torch가 필요로 하는 다른 패키지는 PyPI에서 받는다.
# 2) 나머지 패키지 설치. ultralytics 등이 torch를 요구해도 이미 설치된 CPU 버전으로 충족된다.
# 3) GPU 라이브러리가 다시 끼어들었으면 빌드를 실패시킨다(용량 폭증 방지).
#    단 nvidia-ml-py(약 58KB, GPU 상태 조회용 순수 파이썬, ultralytics 의존성)는 GPU 연산 라이브러리가 아니므로 허용한다.
COPY requirements-docker.txt .
RUN pip install --upgrade pip \
 && pip install --index-url https://download.pytorch.org/whl/cpu --extra-index-url https://pypi.org/simple \
        torch==2.11.0+cpu torchvision==0.26.0+cpu \
 && pip install -r requirements-docker.txt \
 && if pip list 2>/dev/null | grep -i -E '^(nvidia-|triton |cuda-)' | grep -v -i '^nvidia-ml-py '; then echo 'GPU 패키지가 설치됨: 빌드 중단' && exit 1; fi

# 서버 코드 복사 (.dockerignore로 비밀 값, 모델, 예전 복사본 제외)
COPY . .

# root가 아닌 전용 사용자로 실행. 마운트될 폴더를 미리 만들어 둔다.
RUN useradd --system --create-home --home-dir /home/app app \
 && mkdir -p /app/models /app/chroma_data /app/.cache/huggingface \
 && chown -R app:app /app

USER app
EXPOSE 8000

# 개발용 --reload는 쓰지 않는다. 모델이 프로세스마다 메모리에 올라가므로 worker는 1개.
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
