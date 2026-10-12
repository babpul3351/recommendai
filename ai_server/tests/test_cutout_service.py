"""
cutout_service 단위 테스트 (YOLO/SAM 모델 없이 가짜 detector/segmenter로 실행)

실행: ai_server 폴더에서
    python -m unittest discover -s tests -v

ex)
python3 try_outfit_composite.p'/Users/choiyujin/Documents/2026/capstone/업로드 이미지/20.png' '/Users/choiyujin/Documents/2026/capstone/업/업 로드 이
로드 이미지/8.jpg'
python3 try_outfit_composite.p'/Users/choiyujin/Documents/2026/capstone/업로드 이미지/KakaoTalk_Photo_2026-05-25-23-03-36 003.jpeg'/Users/choiyujin
/Documents/2026/capstone/업로드 이미지/IMG_9213.PNG' '/Users/choiyujin/Documents/2026/capstone/업로드 이미지/KakaoTalk_Photo_2026-05-26-14-00-53 012.png' --out result.jpg

주의: 여기서 검증하는 것은 "카테고리 매칭 / 신체 제외 / 합성 배치 / 실패 시 원본 사용" 같은 로직.
실제 best.pt + SAM 으로 만든 누끼의 품질은 이 테스트로 확인 불가.
"""
import base64
import io
import os
import sys
import unittest

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from services import cutout_service as cs  # noqa: E402
from services.cutout_service import Detection  # noqa: E402


class FakeDetector:
    def __init__(self, detections):
        self._detections = detections

    def detect(self, image):
        return list(self._detections)


class FakeSegmenter:
    """박스 영역 전체를 마스크로 돌려주는 가짜 SAM. 호출된 박스를 기록."""

    def __init__(self):
        self.shape = None
        self.calls = []

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def set_image(self, image_np):
        self.shape = image_np.shape[:2]

    def mask_for_box(self, box):
        self.calls.append(tuple(box))
        h, w = self.shape
        x1, y1, x2, y2 = [int(round(v)) for v in box]
        mask = np.zeros((h, w), dtype=bool)
        mask[max(y1, 0):min(y2, h), max(x1, 0):min(x2, w)] = True
        return mask


def make_photo(w=200, h=300):
    """상의(빨강, 위쪽) + 하의(파랑, 아래쪽) + 팔(초록, 상의 오른쪽 가장자리)이 있는 합성 사진"""
    arr = np.full((h, w, 3), 255, dtype=np.uint8)
    arr[20:140, 40:160] = (220, 30, 30)    # top: red
    arr[150:290, 50:150] = (30, 30, 220)   # bottom: blue
    arr[40:120, 140:160] = (30, 200, 30)   # arm: green (상의와 겹침)
    return Image.fromarray(arr)


def to_b64(img, fmt="PNG"):
    buf = io.BytesIO()
    img.save(buf, format=fmt)
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


TOP = Detection("top_long_sleeve", 0.80, (40, 20, 160, 140))
PANTS = Detection("pants", 0.90, (50, 150, 150, 290))
ARM = Detection("arm_lower", 0.70, (140, 40, 160, 120))


class NormalizeCategoryTest(unittest.TestCase):
    def test_korean_and_english(self):
        self.assertEqual(cs.normalize_category("상의"), "top")
        self.assertEqual(cs.normalize_category("하의"), "bottom")
        self.assertEqual(cs.normalize_category("아우터"), "outer")
        self.assertEqual(cs.normalize_category("원피스"), "onepiece")
        self.assertEqual(cs.normalize_category("Top"), "top")
        self.assertEqual(cs.normalize_category("OUTER"), "outer")

    def test_onepiece_wins_over_top_keyword(self):
        self.assertEqual(cs.normalize_category("니트 원피스"), "onepiece")

    def test_unknown(self):
        self.assertIsNone(cs.normalize_category("기타"))
        self.assertIsNone(cs.normalize_category(""))
        self.assertIsNone(cs.normalize_category(None))


class SelectTargetTest(unittest.TestCase):
    def test_only_matching_slot_and_highest_conf(self):
        dets = [PANTS, Detection("top_short_sleeve", 0.5, (0, 0, 1, 1)), TOP]
        self.assertEqual(cs.select_target_detection(dets, "top"), TOP)
        self.assertEqual(cs.select_target_detection(dets, "bottom"), PANTS)

    def test_body_classes_never_selected(self):
        self.assertIsNone(cs.select_target_detection([ARM], "top"))
        self.assertIsNone(cs.select_target_detection([TOP], "outer"))


class MaskOpsTest(unittest.TestCase):
    def test_subtract_body(self):
        item = np.zeros((10, 10), dtype=bool)
        item[:, :10] = True                      # 100px
        body = np.zeros((10, 10), dtype=bool)
        body[:, 8:] = True                       # 20px -> 20%
        out = cs.subtract_body_masks(item, [body])
        self.assertEqual(int(out.sum()), 80)

    def test_subtract_body_ignored_when_it_eats_too_much(self):
        item = np.zeros((10, 10), dtype=bool)
        item[:, :] = True
        body = np.zeros((10, 10), dtype=bool)
        body[:, 4:] = True                       # 60% -> 임계(35%) 초과 -> 무시
        out = cs.subtract_body_masks(item, [body])
        self.assertEqual(int(out.sum()), 100)

    def test_drop_small_islands(self):
        m = np.zeros((50, 50), dtype=bool)
        m[5:35, 5:35] = True                     # 900px
        m[45:47, 45:47] = True                   # 4px (< 2%)
        out = cs.drop_small_islands(m)
        self.assertEqual(int(out.sum()), 900)

    def test_drop_small_islands_keeps_large_second_part(self):
        m = np.zeros((50, 50), dtype=bool)
        m[0:20, 0:20] = True                     # 400
        m[30:50, 30:50] = True                   # 400
        self.assertEqual(int(cs.drop_small_islands(m).sum()), 800)

    def test_mask_to_rgba_crops_and_makes_outside_transparent(self):
        photo = np.asarray(make_photo())
        mask = np.zeros(photo.shape[:2], dtype=bool)
        mask[20:140, 40:160] = True
        rgba = cs.mask_to_rgba(photo, mask, pad_ratio=0.0)
        self.assertEqual(rgba.size, (120, 120))
        self.assertEqual(rgba.mode, "RGBA")
        self.assertGreater(rgba.getpixel((60, 60))[3], 250)   # 중앙은 불투명

    def test_mask_to_rgba_empty_mask(self):
        with self.assertRaises(ValueError):
            cs.mask_to_rgba(np.asarray(make_photo()), np.zeros((300, 200), dtype=bool))


class LayoutTest(unittest.TestCase):
    def _inside_and_disjoint(self, cells):
        w, h = cs.CANVAS_SIZE
        rects = list(cells.values())
        for x0, y0, x1, y1 in rects:
            self.assertGreaterEqual(x0, 0)
            self.assertGreaterEqual(y0, 0)
            self.assertLessEqual(x1, w)
            self.assertLessEqual(y1, h)
        for i in range(len(rects)):
            for j in range(i + 1, len(rects)):
                a, b = rects[i], rects[j]
                overlap = not (a[2] <= b[0] or b[2] <= a[0] or a[3] <= b[1] or b[3] <= a[1])
                self.assertFalse(overlap, f"겹침: {a} {b}")

    def test_outer_left_top_bottom_right(self):
        cells = cs.compute_layout(["outer", "top", "bottom"])
        self._inside_and_disjoint(cells)
        mid = cs.CANVAS_SIZE[0] / 2
        self.assertLess(cells["outer"][2], mid)
        self.assertGreater(cells["top"][0], mid)
        self.assertGreater(cells["bottom"][0], mid)
        self.assertLess(cells["top"][1], cells["bottom"][1])

    def test_without_outer_single_column(self):
        cells = cs.compute_layout(["top", "bottom"])
        self._inside_and_disjoint(cells)
        self.assertEqual(cells["top"][0], cells["bottom"][0])

    def test_onepiece_with_outer(self):
        cells = cs.compute_layout(["outer", "onepiece"])
        self._inside_and_disjoint(cells)

    def test_only_outer(self):
        cells = cs.compute_layout(["outer"])
        self.assertEqual(list(cells), ["outer"])


class ComposeTest(unittest.TestCase):
    def test_compose_has_white_background_and_places_items(self):
        red = Image.new("RGBA", (100, 100), (200, 0, 0, 255))
        blue = Image.new("RGBA", (100, 100), (0, 0, 200, 255))
        canvas = cs.compose_outfit({"top": red, "bottom": blue})
        self.assertEqual(canvas.size, cs.CANVAS_SIZE)
        self.assertEqual(canvas.getpixel((0, 0)), (255, 255, 255))
        cells = cs.compute_layout(["top", "bottom"])
        tx = int((cells["top"][0] + cells["top"][2]) / 2)
        ty = int((cells["top"][1] + cells["top"][3]) / 2)
        bx = int((cells["bottom"][0] + cells["bottom"][2]) / 2)
        by = int((cells["bottom"][1] + cells["bottom"][3]) / 2)
        self.assertEqual(canvas.getpixel((tx, ty)), (200, 0, 0))
        self.assertEqual(canvas.getpixel((bx, by)), (0, 0, 200))

    def test_transparent_pixels_stay_white(self):
        img = Image.new("RGBA", (100, 100), (0, 0, 0, 0))   # 완전 투명
        canvas = cs.compose_outfit({"top": img})
        self.assertEqual(canvas.getpixel((cs.CANVAS_SIZE[0] // 2, cs.CANVAS_SIZE[1] // 2)), (255, 255, 255))


class CutOutItemTest(unittest.TestCase):
    def test_top_item_extracts_only_top_even_if_pants_present(self):
        seg = FakeSegmenter()
        res = cs.cut_out_item(make_photo(), "top", FakeDetector([TOP, PANTS]), seg)
        self.assertEqual(res.method, "yolo_sam")
        self.assertEqual(res.detected_class, "top_long_sleeve")
        arr = np.asarray(res.image)
        opaque = arr[arr[..., 3] > 200][:, :3]
        # 바지(파랑)는 하나도 들어가면 안 됨
        self.assertFalse(((opaque[:, 2] > 180) & (opaque[:, 0] < 80)).any())
        # SAM은 상의 박스로만 호출됨 (바지/팔 박스 호출 없음)
        self.assertEqual(seg.calls, [TOP.box])

    def test_bottom_item_extracts_only_pants(self):
        res = cs.cut_out_item(make_photo(), "bottom", FakeDetector([TOP, PANTS]), FakeSegmenter())
        self.assertEqual(res.detected_class, "pants")
        arr = np.asarray(res.image)
        opaque = arr[arr[..., 3] > 200][:, :3]
        self.assertFalse(((opaque[:, 0] > 180) & (opaque[:, 2] < 80)).any())  # 빨강 없음

    def test_body_part_is_excluded_from_garment_mask(self):
        seg = FakeSegmenter()
        res = cs.cut_out_item(make_photo(), "top", FakeDetector([TOP, ARM]), seg)
        self.assertEqual(res.method, "yolo_sam")
        self.assertIn(ARM.box, seg.calls)           # 신체 박스도 SAM에 넣어 제외 영역을 구함
        # 잘라낸 이미지의 좌표 = 원본 좌표 - (x0, y0). 패딩은 각 변 2% (120px -> 2px) 이므로 (38, 18)이 원점.
        ox, oy = 38, 18
        self.assertLess(res.image.getpixel((150 - ox, 80 - oy))[3], 10)    # 팔 영역 한가운데는 투명
        self.assertGreater(res.image.getpixel((100 - ox, 80 - oy))[3], 250)  # 옷 영역은 불투명

    def test_no_matching_detection_returns_original(self):
        photo = make_photo()
        res = cs.cut_out_item(photo, "top", FakeDetector([PANTS]), FakeSegmenter())
        self.assertEqual(res.method, "original")
        self.assertEqual(res.image.size, photo.size)
        self.assertIn("검출 없음", res.note)

    def test_tiny_mask_falls_back_to_original(self):
        class TinySegmenter(FakeSegmenter):
            def mask_for_box(self, box):
                m = np.zeros(self.shape, dtype=bool)
                m[30:32, 50:52] = True
                return m

        res = cs.cut_out_item(make_photo(), "top", FakeDetector([TOP]), TinySegmenter())
        self.assertEqual(res.method, "original")


class BuildCompositeTest(unittest.TestCase):
    def test_full_flow_returns_jpeg_and_infos(self):
        photo_b64 = to_b64(make_photo())
        items = [
            {"category": "상의", "imageB64": photo_b64},
            {"category": "하의", "imageB64": photo_b64},
            {"category": "기타", "imageB64": photo_b64},
            {"category": "상의", "imageB64": photo_b64},   # 중복 슬롯
        ]
        jpeg, infos = cs.build_outfit_composite(items, FakeDetector([TOP, PANTS]), FakeSegmenter())
        img = Image.open(io.BytesIO(jpeg))
        self.assertEqual(img.format, "JPEG")
        self.assertEqual(img.size, cs.CANVAS_SIZE)
        self.assertEqual([i["method"] for i in infos], ["yolo_sam", "yolo_sam", "skipped", "skipped"])
        self.assertEqual([i["slot"] for i in infos], ["top", "bottom", None, "top"])

    def test_nothing_to_compose_raises(self):
        with self.assertRaises(ValueError):
            cs.build_outfit_composite(
                [{"category": "기타", "imageB64": to_b64(make_photo())}], FakeDetector([]), FakeSegmenter()
            )

    def test_missing_weights_file_raises_clear_error(self):
        with self.assertRaises(FileNotFoundError):
            cs.YoloDetector(weights_path="/nonexistent/path/best.pt")


if __name__ == "__main__":
    unittest.main()
