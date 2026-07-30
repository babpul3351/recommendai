import argparse
from pathlib import Path

import numpy as np
from datasets import load_dataset
from transformers import (
    AutoImageProcessor,
    AutoModelForImageClassification,
    Trainer,
    TrainingArguments,
)


def build_transforms(processor):
    def transform(batch):
        images = [image.convert("RGB") for image in batch["image"]]
        batch["pixel_values"] = processor(images, return_tensors="pt")["pixel_values"]
        return batch

    return transform


def compute_metrics(eval_prediction):
    logits, labels = eval_prediction
    predictions = np.argmax(logits, axis=-1)
    return {"accuracy": float((predictions == labels).mean())}


def train(data_dir: Path, output_dir: Path, base_model: str, epochs: int, batch_size: int) -> None:
    dataset = load_dataset("imagefolder", data_dir=str(data_dir))
    labels = dataset["train"].features["label"].names
    label2id = {label: index for index, label in enumerate(labels)}
    id2label = {index: label for label, index in label2id.items()}

    if "validation" not in dataset:
        split = dataset["train"].train_test_split(test_size=0.2, seed=42)
        dataset["train"] = split["train"]
        dataset["validation"] = split["test"]

    processor = AutoImageProcessor.from_pretrained(base_model)
    model = AutoModelForImageClassification.from_pretrained(
        base_model,
        num_labels=len(labels),
        label2id=label2id,
        id2label=id2label,
        ignore_mismatched_sizes=True,
    )

    transform = build_transforms(processor)
    dataset = dataset.with_transform(transform)

    training_args = TrainingArguments(
        output_dir=str(output_dir),
        remove_unused_columns=False,
        eval_strategy="epoch",
        save_strategy="epoch",
        learning_rate=5e-5,
        per_device_train_batch_size=batch_size,
        per_device_eval_batch_size=batch_size,
        num_train_epochs=epochs,
        load_best_model_at_end=True,
        metric_for_best_model="accuracy",
        logging_steps=20,
    )

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=dataset["train"],
        eval_dataset=dataset["validation"],
        processing_class=processor,
        compute_metrics=compute_metrics,
    )
    trainer.train()
    trainer.save_model(output_dir)
    processor.save_pretrained(output_dir)
    print(f"Saved ViT model to {output_dir}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Fine-tune ViT for fashion classification.")
    parser.add_argument("--data-dir", required=True, type=Path)
    parser.add_argument("--output-dir", default=Path("models/vit-fashion"), type=Path)
    parser.add_argument("--base-model", default="google/vit-base-patch16-224")
    parser.add_argument("--epochs", default=3, type=int)
    parser.add_argument("--batch-size", default=8, type=int)
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    train(args.data_dir, args.output_dir, args.base_model, args.epochs, args.batch_size)
