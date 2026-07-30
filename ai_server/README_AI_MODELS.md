# AI model branch notes

This branch is for the WBS tasks related to ViT and LightGBM.

## WBS mapping

- ViT fine-tuning environment and initial experiment: August weeks 2-4.
- LightGBM idle wardrobe analysis: September weeks 2-3.
- ViT service integration: November week 1.

## FastAPI endpoints

- `POST /ai/vit/classify`
  - Input: `imageB64`, optional `topK`.
  - Uses `VIT_MODEL_NAME` when set. Defaults to `google/vit-base-patch16-224` until the fashion fine-tuned model is ready.

- `GET /ai/idle-analysis`
  - Lightweight status endpoint for the WBS API route.

- `POST /ai/idle-analysis`
  - Input: `items`, optional `targetSeason`.
  - Uses `LIGHTGBM_MODEL_PATH` when set. Falls back to a deterministic idle-score heuristic before the trained model file exists.

## Training scripts

- ViT fine-tuning: `training/train_vit_fashion.py`
- LightGBM idle analysis: `training/train_lightgbm_idle.py`
- Usage guide: `training/README.md`
- LightGBM sample data: `dataset/idle_training_sample.csv`

## Next implementation steps

1. Prepare a fashion dataset such as DeepFashion or a curated project dataset.
2. Run the ViT training script and save the exported model under `ai_server/models/`.
3. Export the fine-tuned ViT model and set `VIT_MODEL_NAME` to the local or HuggingFace model path.
4. Collect `lastWornDate`, `wearCount`, and season features from the Spring Boot wardrobe data.
5. Train a LightGBM model, save it as text, and set `LIGHTGBM_MODEL_PATH`.
