import json
import os
from dataclasses import dataclass
from pathlib import Path

os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import tensorflow as tf
from sklearn.metrics import accuracy_score, f1_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.utils.class_weight import compute_class_weight
from tensorflow.keras.callbacks import EarlyStopping, ReduceLROnPlateau
from tensorflow.keras.layers import (
    LSTM,
    GRU,
    BatchNormalization,
    Conv1D,
    Dense,
    Dropout,
    GlobalAveragePooling1D,
    MaxPooling1D,
)
from tensorflow.keras.models import Sequential
from tensorflow.keras.optimizers import Adam
from tensorflow.keras.utils import to_categorical


RANDOM_STATE = 42
WINDOW_SIZE = 30
STEP_SIZE = 10
TEST_SIZE = 0.2

BASE_DIR = Path(__file__).resolve().parent
DATA_PATH = BASE_DIR / "water_dissegration_data.csv"
OUTPUT_DIR = BASE_DIR / "experiment_outputs"
MODEL_DIR = BASE_DIR / "saved_models"
BACKEND_MODEL_DIR = BASE_DIR.parent / "backend" / "saved_models"


@dataclass
class ExperimentConfig:
    name: str
    family: str
    epochs: int
    batch_size: int
    learning_rate: float
    dropout: float
    notes: str


def set_seeds():
    np.random.seed(RANDOM_STATE)
    tf.random.set_seed(RANDOM_STATE)


def mode_or_nan(series):
    values = series.mode(dropna=True)
    return values.iloc[0] if len(values) > 0 else np.nan


def simple_outlier_correction(signal, z_thresh=3.0, window=50):
    signal = signal.astype(float).interpolate().bfill().ffill()
    rolling_median = signal.rolling(window=window, center=True, min_periods=1).median()
    rolling_mad = (signal - rolling_median).abs().rolling(window=window, center=True, min_periods=1).median()
    rolling_mad = rolling_mad.replace(0, rolling_mad.mean())
    modified_z = 0.6745 * (signal - rolling_median) / rolling_mad
    outliers = np.abs(modified_z) > z_thresh
    corrected = signal.copy()
    corrected[outliers] = rolling_median[outliers]
    return corrected


def preprocess_per_file(df, resample_rule="10s", lowpass_window=3, outlier_window=50):
    processed = []

    for source_name, group in df.groupby("source_file"):
        frame = group.sort_values("Timestamp").copy().set_index("Timestamp")
        resampled = frame.resample(resample_rule).agg({"distance": "mean", "label": mode_or_nan})
        resampled["distance"] = resampled["distance"].interpolate().bfill().ffill()
        resampled["label"] = resampled["label"].ffill().bfill()
        resampled["distance_clean"] = simple_outlier_correction(resampled["distance"], window=outlier_window)
        resampled["distance_lp"] = resampled["distance_clean"].rolling(
            window=lowpass_window, center=True, min_periods=1
        ).mean()
        resampled["slope"] = resampled["distance_lp"].diff().fillna(0.0)
        resampled["source_file"] = source_name
        processed.append(resampled.reset_index())

    final_df = pd.concat(processed, ignore_index=True)
    return final_df.dropna(subset=["distance_lp", "slope", "label"]).reset_index(drop=True)


def build_window_features(df, window_size=WINDOW_SIZE, step=STEP_SIZE):
    features = []
    labels = []

    for _, group in df.groupby("source_file"):
        frame = group.sort_values("Timestamp").reset_index(drop=True)
        levels = frame["distance_lp"].to_numpy()
        slopes = frame["slope"].to_numpy()
        window_labels = frame["label"].to_numpy()

        if len(frame) < window_size:
            continue

        for start in range(0, len(frame) - window_size + 1, step):
            end = start + window_size
            majority = pd.Series(window_labels[start:end]).mode()
            if len(majority) == 0:
                continue
            feature_vector = np.column_stack((levels[start:end], slopes[start:end]))
            features.append(feature_vector)
            labels.append(majority.iloc[0])

    return np.array(features, dtype=np.float32), np.array(labels)


def load_dataset():
    df = pd.read_csv(DATA_PATH)
    if "source_file" not in df.columns:
        df["source_file"] = DATA_PATH.name

    label_map = {
        "no activity": "no_activity",
        "no-activity": "no_activity",
        "washing machine": "washing_machine",
        "washing-machine": "washing_machine",
    }

    df["label"] = df["label"].astype(str).str.strip().str.lower().replace(label_map)
    df["Timestamp"] = pd.to_datetime(df["Timestamp"], errors="coerce")
    df = df.dropna(subset=["Timestamp", "distance", "label", "source_file"]).copy()
    df = df.sort_values(["source_file", "Timestamp"]).reset_index(drop=True)
    return df


def split_and_scale(X_seq, y):
    X_train, X_test, y_train, y_test = train_test_split(
        X_seq,
        y,
        test_size=TEST_SIZE,
        random_state=RANDOM_STATE,
        stratify=y,
    )

    scaler = StandardScaler()
    X_train_flat = X_train.reshape(len(X_train), -1)
    X_test_flat = X_test.reshape(len(X_test), -1)
    X_train_scaled = scaler.fit_transform(X_train_flat).reshape(-1, WINDOW_SIZE, 2)
    X_test_scaled = scaler.transform(X_test_flat).reshape(-1, WINDOW_SIZE, 2)

    label_encoder = LabelEncoder()
    y_train_enc = label_encoder.fit_transform(y_train)
    y_test_enc = label_encoder.transform(y_test)

    class_weight_values = compute_class_weight(
        class_weight="balanced",
        classes=np.unique(y_train_enc),
        y=y_train_enc,
    )
    class_weights = {index: weight for index, weight in enumerate(class_weight_values)}

    return {
        "X_train": X_train_scaled,
        "X_test": X_test_scaled,
        "y_train": y_train,
        "y_test": y_test,
        "y_train_enc": y_train_enc,
        "y_test_enc": y_test_enc,
        "y_train_cat": to_categorical(y_train_enc),
        "y_test_cat": to_categorical(y_test_enc),
        "label_encoder": label_encoder,
        "class_weights": class_weights,
    }


def create_baseline_lstm(input_shape, num_classes, dropout):
    return Sequential([
        LSTM(48, return_sequences=True, input_shape=input_shape),
        Dropout(dropout),
        LSTM(24),
        Dropout(dropout),
        Dense(24, activation="relu"),
        Dense(num_classes, activation="softmax"),
    ])


def create_tuned_lstm(input_shape, num_classes, dropout):
    return Sequential([
        LSTM(128, return_sequences=True, input_shape=input_shape),
        BatchNormalization(),
        Dropout(dropout),
        LSTM(64, return_sequences=True),
        Dropout(0.2),
        LSTM(32),
        Dense(64, activation="relu"),
        Dropout(0.2),
        Dense(num_classes, activation="softmax"),
    ])


def create_tuned_gru(input_shape, num_classes, dropout):
    return Sequential([
        GRU(128, return_sequences=True, input_shape=input_shape),
        BatchNormalization(),
        Dropout(dropout),
        GRU(64),
        Dropout(0.2),
        Dense(64, activation="relu"),
        Dense(num_classes, activation="softmax"),
    ])


def create_tuned_cnn(input_shape, num_classes, dropout):
    return Sequential([
        Conv1D(64, kernel_size=5, activation="relu", padding="same", input_shape=input_shape),
        BatchNormalization(),
        MaxPooling1D(pool_size=2),
        Conv1D(128, kernel_size=3, activation="relu", padding="same"),
        BatchNormalization(),
        MaxPooling1D(pool_size=2),
        Conv1D(128, kernel_size=3, activation="relu", padding="same"),
        GlobalAveragePooling1D(),
        Dense(64, activation="relu"),
        Dropout(dropout),
        Dense(num_classes, activation="softmax"),
    ])


def plot_history(history, output_path, title):
    history_df = pd.DataFrame(history.history)
    fig, axes = plt.subplots(1, 2, figsize=(12, 4))

    history_df[["loss", "val_loss"]].plot(ax=axes[0], title="Loss")
    history_df[["accuracy", "val_accuracy"]].plot(ax=axes[1], title="Accuracy")

    axes[0].set_xlabel("Epoch")
    axes[1].set_xlabel("Epoch")
    fig.suptitle(title)
    fig.tight_layout()
    fig.savefig(output_path, dpi=180, bbox_inches="tight")
    plt.close(fig)


def train_experiment(config, builder, split_data):
    num_classes = len(split_data["label_encoder"].classes_)
    model = builder((WINDOW_SIZE, 2), num_classes, config.dropout)
    model.compile(
        optimizer=Adam(learning_rate=config.learning_rate),
        loss="categorical_crossentropy",
        metrics=["accuracy"],
    )

    callbacks = [
        EarlyStopping(monitor="val_loss", patience=4, restore_best_weights=True),
        ReduceLROnPlateau(monitor="val_loss", patience=2, factor=0.5, min_lr=1e-5),
    ]

    history = model.fit(
        split_data["X_train"],
        split_data["y_train_cat"],
        validation_split=0.2,
        epochs=config.epochs,
        batch_size=config.batch_size,
        verbose=0,
        class_weight=split_data["class_weights"],
        callbacks=callbacks,
    )

    y_pred_prob = model.predict(split_data["X_test"], verbose=0)
    y_pred = np.argmax(y_pred_prob, axis=1)
    accuracy = accuracy_score(split_data["y_test_enc"], y_pred)
    macro_f1 = f1_score(split_data["y_test_enc"], y_pred, average="macro")

    return model, history, accuracy, macro_f1


def write_experiment_log(results_df, best_result):
    markdown_lines = [
        "# Training Log",
        "",
        "| Experiment | Model | Layers | Units | Dropout | Learning Rate | Epochs | Accuracy | Macro F1 | Notes |",
        "|------------|-------|--------|-------|---------|---------------|--------|----------|----------|-------|",
    ]

    for _, row in results_df.iterrows():
        markdown_lines.append(
            f"| {row['Experiment']} | {row['Model']} | {row['Layers']} | {row['Units']} | {row['Dropout']} | {row['Learning Rate']} | {row['Epochs']} | {row['Accuracy']}% | {row['Macro F1']} | {row['Notes']} |"
        )

    markdown_lines.extend([
        "",
        f"Best model: {best_result['Model']} with {best_result['Accuracy']}% accuracy and macro-F1 {best_result['Macro F1']}.",
    ])

    (OUTPUT_DIR / "training_log.md").write_text("\n".join(markdown_lines), encoding="utf-8")


def main():
    set_seeds()
    OUTPUT_DIR.mkdir(exist_ok=True)
    MODEL_DIR.mkdir(exist_ok=True)
    BACKEND_MODEL_DIR.mkdir(exist_ok=True)

    raw_df = load_dataset()
    proc_df = preprocess_per_file(raw_df)
    X_seq, y = build_window_features(proc_df)
    split_data = split_and_scale(X_seq, y)

    experiments = [
        (
            ExperimentConfig(
                name="LSTM Baseline",
                family="LSTM",
                epochs=8,
                batch_size=128,
                learning_rate=0.001,
                dropout=0.2,
                notes="Original notebook-style stacked LSTM baseline",
            ),
            create_baseline_lstm,
            {"Layers": 2, "Units": "48,24"},
        ),
        (
            ExperimentConfig(
                name="LSTM Tuned",
                family="LSTM",
                epochs=18,
                batch_size=96,
                learning_rate=0.001,
                dropout=0.3,
                notes="Higher-capacity LSTM with class weights and scaled windows",
            ),
            create_tuned_lstm,
            {"Layers": 3, "Units": "128,64,32"},
        ),
        (
            ExperimentConfig(
                name="CNN Tuned",
                family="CNN",
                epochs=18,
                batch_size=96,
                learning_rate=0.0008,
                dropout=0.3,
                notes="Deeper 1D CNN with batch normalization and global pooling",
            ),
            create_tuned_cnn,
            {"Layers": 3, "Units": "64,128,128"},
        ),
        (
            ExperimentConfig(
                name="GRU Tuned",
                family="GRU",
                epochs=18,
                batch_size=96,
                learning_rate=0.001,
                dropout=0.3,
                notes="GRU with class weights and wider recurrent layers",
            ),
            create_tuned_gru,
            {"Layers": 2, "Units": "128,64"},
        ),
    ]

    results = []
    best_payload = None

    for index, (config, builder, architecture) in enumerate(experiments, start=1):
        print(f"Running experiment {index}: {config.name}")
        model, history, accuracy, macro_f1 = train_experiment(config, builder, split_data)

        history_path = OUTPUT_DIR / f"{config.name.lower().replace(' ', '_')}_history.png"
        plot_history(history, history_path, config.name)

        result = {
            "Experiment": index,
            "Model": config.name,
            "Layers": architecture["Layers"],
            "Units": architecture["Units"],
            "Dropout": config.dropout,
            "Learning Rate": config.learning_rate,
            "Epochs": len(history.history["loss"]),
            "Accuracy": round(accuracy * 100, 2),
            "Macro F1": round(macro_f1, 4),
            "Notes": config.notes,
        }
        results.append(result)

        print(
            f"  accuracy={result['Accuracy']}% macro_f1={result['Macro F1']} epochs_ran={result['Epochs']}"
        )

        if best_payload is None or (accuracy, macro_f1) > (best_payload["accuracy"], best_payload["macro_f1"]):
            best_payload = {
                "model": model,
                "history": history,
                "result": result,
                "accuracy": accuracy,
                "macro_f1": macro_f1,
            }

    results_df = pd.DataFrame(results).sort_values(["Accuracy", "Macro F1"], ascending=False).reset_index(drop=True)
    results_df.to_csv(OUTPUT_DIR / "experiment_results.csv", index=False)

    best_model_path = MODEL_DIR / "best_model.h5"
    best_payload["model"].save(best_model_path)

    metadata = {
        "model_name": best_payload["result"]["Model"],
        "model_type": best_payload["result"]["Model"].split()[0],
        "version": "2.0",
        "accuracy": round(best_payload["accuracy"], 4),
        "macro_f1": round(best_payload["macro_f1"], 4),
        "last_trained": pd.Timestamp.utcnow().strftime("%Y-%m-%d"),
        "classes": split_data["label_encoder"].classes_.tolist(),
        "window_size": WINDOW_SIZE,
        "features": ["distance_lp", "slope"],
    }
    metadata_path = MODEL_DIR / "best_model_metadata.json"
    metadata_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")

    backend_best_model_path = BACKEND_MODEL_DIR / "best_model.h5"
    backend_metadata_path = BACKEND_MODEL_DIR / "best_model_metadata.json"
    backend_best_model_path.write_bytes(best_model_path.read_bytes())
    backend_metadata_path.write_text(metadata_path.read_text(encoding="utf-8"), encoding="utf-8")

    best_curve_path = OUTPUT_DIR / "best_model_training_curves.png"
    plot_history(best_payload["history"], best_curve_path, f"Best Model: {best_payload['result']['Model']}")
    write_experiment_log(results_df, results_df.iloc[0])

    print("\nExperiment summary:")
    print(results_df.to_string(index=False))
    print(f"\nSaved best model to {best_model_path}")
    print(f"Saved metadata to {metadata_path}")
    print(f"Saved training log to {OUTPUT_DIR / 'training_log.md'}")


if __name__ == "__main__":
    main()