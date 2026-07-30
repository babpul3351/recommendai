import argparse
from pathlib import Path

import lightgbm as lgb
import numpy as np
import pandas as pd


FEATURE_COLUMNS = [
    "days_since_last_worn",
    "wear_count",
    "season_match",
]
TARGET_COLUMN = "idle_score"


def split_train_valid(data: pd.DataFrame, test_size: float = 0.2, seed: int = 42):
    shuffled = data.sample(frac=1.0, random_state=seed).reset_index(drop=True)
    valid_count = max(1, int(len(shuffled) * test_size))
    valid_data = shuffled.iloc[:valid_count]
    train_data = shuffled.iloc[valid_count:]
    return train_data, valid_data


def train(input_csv: Path, output_model: Path) -> None:
    data = pd.read_csv(input_csv)
    missing = [column for column in FEATURE_COLUMNS + [TARGET_COLUMN] if column not in data.columns]
    if missing:
        raise ValueError(f"Missing columns: {missing}")

    train_data, valid_data = split_train_valid(data)
    x_train = train_data[FEATURE_COLUMNS]
    y_train = train_data[TARGET_COLUMN]
    x_valid = valid_data[FEATURE_COLUMNS]
    y_valid = valid_data[TARGET_COLUMN]

    train_set = lgb.Dataset(x_train, label=y_train)
    valid_set = lgb.Dataset(x_valid, label=y_valid, reference=train_set)

    params = {
        "objective": "regression",
        "metric": "mae",
        "learning_rate": 0.05,
        "num_leaves": 15,
        "feature_fraction": 0.9,
        "bagging_fraction": 0.9,
        "bagging_freq": 1,
        "verbose": -1,
    }

    model = lgb.train(
        params,
        train_set,
        valid_sets=[valid_set],
        num_boost_round=300,
        callbacks=[lgb.early_stopping(30), lgb.log_evaluation(25)],
    )

    predictions = model.predict(x_valid)
    mae = float(np.mean(np.abs(y_valid.to_numpy() - predictions)))
    output_model.parent.mkdir(parents=True, exist_ok=True)
    model.save_model(output_model)
    print(f"Saved LightGBM model to {output_model}")
    print(f"Validation MAE: {mae:.4f}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train LightGBM idle wardrobe model.")
    parser.add_argument("--input-csv", required=True, type=Path)
    parser.add_argument("--output-model", default=Path("models/lightgbm_idle.txt"), type=Path)
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    train(args.input_csv, args.output_model)
