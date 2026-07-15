import pandas as pd
import numpy as np
from pathlib import Path
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import r2_score, mean_absolute_error, mean_squared_error


PROCESSED_DIR = Path("data/processed")
OUTPUT_DIR = Path("analysis_outputs")
OUTPUT_DIR.mkdir(exist_ok=True)


COHORT_FILES = {
    "S6": PROCESSED_DIR / "s6_master_dataset.csv",
    "S7": PROCESSED_DIR / "s7_master_dataset.csv",
    "S8": PROCESSED_DIR / "s8_master_dataset.csv",
    "S9": PROCESSED_DIR / "s9_master_dataset.csv",
    "S10": PROCESSED_DIR / "s10_master_dataset.csv",
}


def load_dataset(path):
    df = pd.read_csv(path)

    if "Student_ID" in df.columns:
        df = df.drop(columns=["Student_ID"])

    for column in df.columns:
        df[column] = pd.to_numeric(df[column], errors="coerce")

    df = df.dropna(axis=1, how="all")

    return df


def get_top_relationships(df, cohort_name):

    corr = df.corr(min_periods=5)

    pairs = []

    columns = corr.columns.tolist()

    for i in range(len(columns)):
        for j in range(i + 1, len(columns)):

            value = corr.iloc[i, j]

            if pd.isna(value):
                continue

            pairs.append({
                "Cohort": cohort_name,
                "Course A": columns[i],
                "Course B": columns[j],
                "Correlation": value,
                "Abs Correlation": abs(value),
            })

    pair_df = pd.DataFrame(pairs)

    if not pair_df.empty:
        pair_df = pair_df.sort_values(
            "Abs Correlation",
            ascending=False
        )

    return corr, pair_df


def train_course_prediction(df, cohort_name, target_column):

    feature_columns = [
        c for c in df.columns
        if c != target_column
    ]

    if len(feature_columns) == 0:
        return None

    model_df = df[
        feature_columns + [target_column]
    ].dropna()

    if len(model_df) < 15:
        return None

    X = model_df[feature_columns]
    y = model_df[target_column]

    if y.nunique() < 2:
        return None

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.25,
        random_state=42
    )

    model = RandomForestRegressor(
        n_estimators=300,
        max_depth=4,
        random_state=42
    )

    model.fit(X_train, y_train)

    predictions = model.predict(X_test)

    r2 = r2_score(y_test, predictions)
    mae = mean_absolute_error(y_test, predictions)
    rmse = np.sqrt(mean_squared_error(y_test, predictions))

    importance_df = pd.DataFrame({
        "Feature": feature_columns,
        "Importance": model.feature_importances_
    }).sort_values(
        "Importance",
        ascending=False
    )

    return {
        "Cohort": cohort_name,
        "Target Course": target_column,
        "Rows Used": len(model_df),
        "R2": r2,
        "MAE": mae,
        "RMSE": rmse,
        "Top Features": ", ".join(
            importance_df.head(5)["Feature"].tolist()
        ),
    }


def analyze_cohort(cohort_name, file_path):

    print("\n==============================")
    print(f"Analyzing {cohort_name}")
    print("==============================")

    if not file_path.exists():
        print(f"Missing file: {file_path}")
        return None, None, None

    df = load_dataset(file_path)

    print(f"Shape: {df.shape}")
    print(df.columns.tolist())

    corr, pair_df = get_top_relationships(
        df,
        cohort_name
    )

    prediction_results = []

    for target in df.columns:

        result = train_course_prediction(
            df,
            cohort_name,
            target
        )

        if result:
            prediction_results.append(result)

    prediction_df = pd.DataFrame(prediction_results)

    corr.to_csv(
        OUTPUT_DIR /
        f"{cohort_name.lower()}_correlation_matrix.csv"
    )

    if not pair_df.empty:
        pair_df.to_csv(
            OUTPUT_DIR /
            f"{cohort_name.lower()}_top_course_relationships.csv",
            index=False
        )

    if not prediction_df.empty:

        prediction_df = prediction_df.sort_values(
            "R2",
            ascending=False
        )

        prediction_df.to_csv(
            OUTPUT_DIR /
            f"{cohort_name.lower()}_course_prediction_results.csv",
            index=False
        )

    print("\nTop Relationships")

    if pair_df.empty:
        print("None")
    else:
        print(
            pair_df[
                ["Course A", "Course B", "Correlation"]
            ].head(10)
        )

    print("\nPrediction Results")

    if prediction_df.empty:
        print("No valid prediction model.")
    else:
        print(
            prediction_df.round(3).to_string(index=False)
        )

    return corr, pair_df, prediction_df


def main():

    all_relationships = []
    all_predictions = []

    for cohort_name, file_path in COHORT_FILES.items():

        corr, pair_df, prediction_df = analyze_cohort(
            cohort_name,
            file_path
        )

        if pair_df is not None and not pair_df.empty:
            all_relationships.append(pair_df)

        if prediction_df is not None and not prediction_df.empty:
            all_predictions.append(prediction_df)

    if all_relationships:

        relationship_df = pd.concat(
            all_relationships,
            ignore_index=True
        )

        relationship_df = relationship_df.sort_values(
            "Abs Correlation",
            ascending=False
        )

        relationship_df.to_csv(
            OUTPUT_DIR /
            "all_cohorts_top_relationships.csv",
            index=False
        )

    if all_predictions:

        prediction_df = pd.concat(
            all_predictions,
            ignore_index=True
        )

        prediction_df = prediction_df.sort_values(
            "R2",
            ascending=False
        )

        prediction_df.to_csv(
            OUTPUT_DIR /
            "all_cohorts_prediction_results.csv",
            index=False
        )

    print("\n==============================")
    print("Analysis Complete")
    print("==============================")
    print("Saved to analysis_outputs/")


if __name__ == "__main__":
    main()