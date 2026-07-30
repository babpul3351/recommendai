# Training guide

Use these scripts only on the `feature/ai-vit-lightgbm` branch.

## ViT fashion classification

Expected image folder format:

```text
dataset/fashion/
  top/
    image001.jpg
  bottom/
    image002.jpg
  outer/
    image003.jpg
```

Run:

```bash
python training/train_vit_fashion.py --data-dir dataset/fashion --output-dir models/vit-fashion --epochs 3 --batch-size 8
```

Then start FastAPI with:

```bash
set VIT_MODEL_NAME=models/vit-fashion
```

## LightGBM idle wardrobe analysis

Expected CSV columns:

```csv
days_since_last_worn,wear_count,season_match,idle_score
60,1,1,0.82
14,8,1,0.22
120,0,0,0.95
```

Run:

```bash
python training/train_lightgbm_idle.py --input-csv dataset/idle_training_sample.csv --output-model models/lightgbm_idle.txt
```

Then start FastAPI with:

```bash
set LIGHTGBM_MODEL_PATH=models/lightgbm_idle.txt
```
