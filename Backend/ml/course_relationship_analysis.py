import pandas as pd
import numpy as np
from pathlib import Path
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.model_selection import train_test_split, LeaveOneOut, cross_val_score
from sklearn.metrics import r2_score, mean_absolute_error, mean_squared_error


DATA_PATH = Path("data/processed/s5_master_dataset.csv")


def load_dataset(path=DATA_PATH):
    df = pd.read_csv(path)

    numeric_df = df.select_dtypes(include=[np.number])

    numeric_df = numeric_df.dropna(axis=1, how="all")
    numeric_df = numeric_df.dropna(axis=0, how="any")

    return numeric_df


def correlation_analysis(df):
    print("\n==============================")
    print("Correlation Matrix")
    print("==============================")

    corr = df.corr()
    print(corr.round(3))

    print("\n==============================")
    print("Top Course Relationships")
    print("==============================")

    pairs = []

    columns = corr.columns

    for i in range(len(columns)):
        for j in range(i + 1, len(columns)):
            course_a = columns[i]
            course_b = columns[j]
            value = corr.loc[course_a, course_b]

            pairs.append({
                "Course A": course_a,
                "Course B": course_b,
                "Correlation": value,
                "Abs Correlation": abs(value),
            })

    pair_df = pd.DataFrame(pairs)
    pair_df = pair_df.sort_values("Abs Correlation", ascending=False)

    print(pair_df[["Course A", "Course B", "Correlation"]].head(15).round(3))

    return corr, pair_df


def predict_target_course(df, target_column):
    feature_columns = [col for col in df.columns if col != target_column]

    X = df[feature_columns]
    y = df[target_column]

    if len(df) < 10:
        print(f"\nNot enough rows to train model for {target_column}")
        return None

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.25,
        random_state=42
    )

    model = RandomForestRegressor(
        n_estimators=300,
        random_state=42,
        max_depth=4
    )

    model.fit(X_train, y_train)

    predictions = model.predict(X_test)

    r2 = r2_score(y_test, predictions)
    mae = mean_absolute_error(y_test, predictions)
    rmse = np.sqrt(mean_squared_error(y_test, predictions))

    importance_df = pd.DataFrame({
        "Feature": feature_columns,
        "Importance": model.feature_importances_
    }).sort_values("Importance", ascending=False)

    result = {
        "Target": target_column,
        "R2": r2,
        "MAE": mae,
        "RMSE": rmse,
        "Top Features": importance_df.head(5)
    }

    return result


def course_to_course_prediction(df):
    print("\n==============================")
    print("Course-to-Course Prediction")
    print("==============================")

    results = []

    for target in df.columns:
        result = predict_target_course(df, target)

        if result is None:
            continue

        results.append({
            "Target": result["Target"],
            "R2": result["R2"],
            "MAE": result["MAE"],
            "RMSE": result["RMSE"],
        })

        print(f"\nTarget Course: {result['Target']}")
        print(f"R2: {result['R2']:.3f}")
        print(f"MAE: {result['MAE']:.3f}")
        print(f"RMSE: {result['RMSE']:.3f}")
        print("Top Features:")
        print(result["Top Features"].round(3).to_string(index=False))

    results_df = pd.DataFrame(results)
    results_df = results_df.sort_values("R2", ascending=False)

    print("\n==============================")
    print("Prediction Ranking")
    print("==============================")
    print(results_df.round(3).to_string(index=False))

    return results_df


def predict_comprehensive_only(df):
    if "Comprehensive" not in df.columns:
        print("\nNo Comprehensive column found.")
        return None

    print("\n==============================")
    print("Comprehensive Prediction")
    print("==============================")

    result = predict_target_course(df, "Comprehensive")

    if result is None:
        return None

    print(f"Target: Comprehensive")
    print(f"R2: {result['R2']:.3f}")
    print(f"MAE: {result['MAE']:.3f}")
    print(f"RMSE: {result['RMSE']:.3f}")
    print("Top Features:")
    print(result["Top Features"].round(3).to_string(index=False))

    return result


def save_outputs(corr, pair_df, results_df):
    output_dir = Path("analysis_outputs")
    output_dir.mkdir(exist_ok=True)

    corr.to_csv(output_dir / "correlation_matrix.csv")
    pair_df.to_csv(output_dir / "top_course_relationships.csv", index=False)
    results_df.to_csv(output_dir / "course_prediction_results.csv", index=False)

    print("\n==============================")
    print("Saved Outputs")
    print("==============================")
    print("analysis_outputs/correlation_matrix.csv")
    print("analysis_outputs/top_course_relationships.csv")
    print("analysis_outputs/course_prediction_results.csv")


def main():
    df = load_dataset()

    print("\nDataset Loaded")
    print(df.shape)
    print(df.columns.tolist())

    corr, pair_df = correlation_analysis(df)

    results_df = course_to_course_prediction(df)

    predict_comprehensive_only(df)

    save_outputs(corr, pair_df, results_df)


if __name__ == "__main__":
    main()