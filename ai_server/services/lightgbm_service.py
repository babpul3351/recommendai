import os
from datetime import date, datetime
from typing import Any, Dict, List, Optional

import numpy as np

lightgbm_model = None


def _parse_date(value: Optional[str]) -> Optional[date]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).date()
    except ValueError:
        return None


def _days_since(last_worn_date: Optional[str], today: date) -> int:
    parsed = _parse_date(last_worn_date)
    if parsed is None:
        return 999
    return max(0, (today - parsed).days)


def _season_match(item_season: Optional[str], target_season: Optional[str]) -> int:
    if not item_season or not target_season:
        return 0
    return int(item_season.lower() == target_season.lower())


def _load_lightgbm_model():
    global lightgbm_model
    if lightgbm_model is not None:
        return lightgbm_model

    model_path = os.getenv("LIGHTGBM_MODEL_PATH")
    if not model_path:
        return None

    import lightgbm as lgb

    lightgbm_model = lgb.Booster(model_file=model_path)
    return lightgbm_model


def _build_features(item: Dict[str, Any], today: date, target_season: Optional[str]) -> List[float]:
    days_since_last_worn = _days_since(item.get("lastWornDate"), today)
    wear_count = float(item.get("wearCount") or 0)
    season_match = float(_season_match(item.get("season"), target_season))
    return [float(days_since_last_worn), wear_count, season_match]


def _fallback_idle_score(features: List[float]) -> float:
    days_since_last_worn, wear_count, season_match = features
    recency_score = min(days_since_last_worn / 90.0, 1.0)
    low_usage_score = 1.0 / (wear_count + 1.0)
    seasonal_penalty = 0.15 if season_match == 0 else 0.0
    return max(0.0, min(1.0, recency_score * 0.7 + low_usage_score * 0.2 + seasonal_penalty))


def _idle_reason(feature: List[float], target_season: Optional[str]) -> str:
    days_since_last_worn, wear_count, season_match = feature
    reasons = []
    if days_since_last_worn >= 90:
        reasons.append("not worn for over 90 days")
    elif days_since_last_worn >= 30:
        reasons.append("not worn recently")
    if wear_count <= 1:
        reasons.append("low wear count")
    if target_season and season_match == 0:
        reasons.append("not matched to target season")
    return ", ".join(reasons) if reasons else "recently used"


def analyze_idle_items(items: List[Dict[str, Any]], target_season: Optional[str] = None) -> dict:
    today = date.today()
    features = [_build_features(item, today, target_season) for item in items]
    model = _load_lightgbm_model()

    if model is not None and features:
        scores = model.predict(np.array(features, dtype="float32")).tolist()
        scoring_mode = "lightgbm"
    else:
        scores = [_fallback_idle_score(feature) for feature in features]
        scoring_mode = "heuristic-fallback"

    results = []
    for item, feature, score in zip(items, features, scores):
        results.append({
            "id": item.get("id"),
            "category": item.get("category", ""),
            "type": item.get("type", ""),
            "color": item.get("color", ""),
            "season": item.get("season", ""),
            "imageUrl": item.get("imageUrl", ""),
            "idleScore": round(float(score), 4),
            "idleLevel": "high" if score >= 0.7 else "medium" if score >= 0.4 else "low",
            "reason": _idle_reason(feature, target_season),
            "daysSinceLastWorn": int(feature[0]),
            "wearCount": int(feature[1]),
        })

    results.sort(key=lambda item: item["idleScore"], reverse=True)
    return {
        "model": os.getenv("LIGHTGBM_MODEL_PATH", ""),
        "scoringMode": scoring_mode,
        "targetSeason": target_season,
        "items": results,
    }
