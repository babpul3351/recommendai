"""
/ai/outfit-composite 호출용 수동 테스트 스크립트 (표준 라이브러리만 사용)

사용 전: ai_server 폴더에서 AI 서버를 먼저 실행해 둡니다.
    uvicorn main:app --port 8000      (평소 쓰는 실행 명령/포트가 있다면 그대로 사용)

사용 예 (ai_server 폴더에서):
    python try_outfit_composite.py 상의=/경로/top.jpg 하의=/경로/pants.jpg
    python try_outfit_composite.py 상의=a.jpg 하의=b.jpg 아우터=c.jpg --out result.jpg
    python try_outfit_composite.py 원피스=d.jpg --url http://localhost:8000

인자 형식은 "카테고리=사진경로" 입니다. 카테고리는 상의/하의/아우터/원피스 (top/bottom/outer/onepiece도 가능).
옷장에 저장된 카테고리를 그대로 넣는다고 생각하면 됩니다.

결과:
    - 합성 이미지를 --out 경로(기본: composite_result.jpg)에 저장
    - 아이템별 검출 결과(클래스, 신뢰도, 원본 대체 여부 등)와 걸린 시간을 출력
"""

import argparse
import base64
import json
import mimetypes
import os
import sys
import time
import urllib.error
import urllib.request


def to_data_url(path: str) -> str:
    mime = mimetypes.guess_type(path)[0] or "image/jpeg"
    with open(path, "rb") as f:
        return f"data:{mime};base64," + base64.b64encode(f.read()).decode("utf-8")


def parse_items(pairs):
    items = []
    for pair in pairs:
        if "=" not in pair:
            sys.exit(f"[오류] '{pair}' 형식이 잘못되었습니다. '카테고리=사진경로' 로 입력하세요. 예) 상의=top.jpg")
        category, path = pair.split("=", 1)
        category, path = category.strip(), os.path.expanduser(path.strip())
        if not category:
            sys.exit(f"[오류] '{pair}' 의 카테고리가 비어 있습니다.")
        if not os.path.isfile(path):
            sys.exit(f"[오류] 사진 파일을 찾을 수 없습니다: {path}")
        items.append({"category": category, "imageB64": to_data_url(path), "_path": path})
    return items


def main():
    parser = argparse.ArgumentParser(description="/ai/outfit-composite 호출 테스트")
    parser.add_argument("items", nargs="+", help="카테고리=사진경로 (예: 상의=top.jpg 하의=pants.jpg)")
    parser.add_argument("--url", default="http://localhost:8000", help="AI 서버 주소 (기본: http://localhost:8000)")
    parser.add_argument("--out", default="composite_result.jpg", help="합성 결과 저장 경로")
    parser.add_argument("--timeout", type=int, default=300, help="응답 대기 시간(초). 첫 호출은 모델 로딩 때문에 오래 걸릴 수 있음")
    args = parser.parse_args()

    items = parse_items(args.items)
    payload = {"items": [{"category": i["category"], "imageB64": i["imageB64"]} for i in items]}
    body = json.dumps(payload).encode("utf-8")

    endpoint = args.url.rstrip("/") + "/ai/outfit-composite"
    print(f"요청: {endpoint}")
    for i in items:
        print(f"  - {i['category']}: {i['_path']}")
    print("처리 중... (첫 호출은 YOLO/SAM 모델 로딩 때문에 오래 걸릴 수 있습니다)")

    req = urllib.request.Request(endpoint, data=body, headers={"Content-Type": "application/json"}, method="POST")
    started = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=args.timeout) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        elapsed = time.perf_counter() - started
        detail = e.read().decode("utf-8", errors="replace")
        sys.exit(f"[실패] HTTP {e.code} ({elapsed:.1f}초)\n{detail}")
    except urllib.error.URLError as e:
        sys.exit(f"[실패] 서버에 연결하지 못했습니다: {e.reason}\nAI 서버가 실행 중인지, 주소/포트가 맞는지 확인하세요.")
    except TimeoutError:
        sys.exit(f"[실패] {args.timeout}초 안에 응답이 오지 않았습니다. --timeout 값을 늘려 보세요.")
    elapsed = time.perf_counter() - started

    image_b64 = data.get("imageB64", "")
    if "," in image_b64:
        image_b64 = image_b64.split(",", 1)[1]
    with open(args.out, "wb") as f:
        f.write(base64.b64decode(image_b64))

    print(f"\n[성공] {elapsed:.1f}초 소요")
    print(f"합성 이미지 저장: {os.path.abspath(args.out)}")
    print("\n아이템별 결과:")
    print(json.dumps(data.get("items", []), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()