import re
import pandas as pd
from pathlib import Path

RAW_DIR = Path("data/raw")
PROCESSED_DIR = Path("data/processed")

COHORTS = [
    "S5",
    "S6",
    "S7",
    "S8",
    "S9",
    "S10",
]

STUDENT_ID_CANDIDATES = [
    "id",
    "student id",
    "studentid",
    "student_id",
    "randomized id",
    "randomized_id",
    "assessment id",
    "assessmentid",
]


def normalize_column_name(name):
    return str(name).strip().lower()


def clean_student_id(value):
    if pd.isna(value):
        return None

    text = str(value).strip()

    if text.endswith(".0"):
        text = text[:-2]

    return text


def find_student_id_column(df):
    normalized_columns = {
        normalize_column_name(column): column
        for column in df.columns
    }

    for candidate in STUDENT_ID_CANDIDATES:
        if candidate in normalized_columns:
            return normalized_columns[candidate]

    return df.columns[0]


def infer_course_name(file_path):
    name = file_path.stem

    name = re.sub(r"^\d+", "", name)
    name = re.sub(r"^S\d+", "", name)

    return name


def load_dataframe(file_path):
    suffix = file_path.suffix.lower()

    if suffix == ".csv":
        return pd.read_csv(file_path)

    if suffix == ".xls":
        return pd.read_excel(file_path, engine="xlrd")

    if suffix == ".xlsx":
        return pd.read_excel(file_path, engine="openpyxl")

    return None


def select_score_columns(df, student_id_col):

    for column in df.columns:

        if column == student_id_col:
            continue

        if normalize_column_name(column) == "score":
            return [column]

    score_columns = []

    for column in df.columns:

        if column == student_id_col:
            continue

        column_lower = normalize_column_name(column)

        converted = pd.to_numeric(df[column], errors="coerce")

        if converted.notna().sum() == 0:
            continue

        if "final" in column_lower:
            score_columns.insert(0, column)

        elif "exam" in column_lower:
            score_columns.append(column)

    if score_columns:
        return score_columns

    numeric_columns = []

    for column in df.columns:

        if column == student_id_col:
            continue

        converted = pd.to_numeric(df[column], errors="coerce")

        if converted.notna().sum() > 0:
            numeric_columns.append(column)

    return numeric_columns


def load_course_file(file_path):

    df = load_dataframe(file_path)

    if df is None or df.empty:
        return None

    df = df.dropna(axis=1, how="all")

    if df.empty:
        return None

    student_id_col = find_student_id_column(df)

    course_name = infer_course_name(file_path)

    selected_columns = select_score_columns(df, student_id_col)

    if not selected_columns:
        return None

    course_df = pd.DataFrame()

    course_df["Student_ID"] = (
        df[student_id_col]
        .apply(clean_student_id)
    )

    numeric_scores = df[selected_columns].apply(
        pd.to_numeric,
        errors="coerce"
    )

    course_df[course_name] = numeric_scores.mean(axis=1)

    course_df = course_df.dropna(subset=["Student_ID"])
    course_df = course_df.dropna(subset=[course_name])

    course_df = (
        course_df
        .groupby("Student_ID", as_index=False)[course_name]
        .mean()
    )

    return course_df


def build_master_dataset_for_cohort(cohort_name):

    cohort_dir = RAW_DIR / cohort_name

    if not cohort_dir.exists():
        print(f"Missing folder: {cohort_dir}")
        return

    files = []

    files.extend(cohort_dir.glob("*.csv"))
    files.extend(cohort_dir.glob("*.xls"))
    files.extend(cohort_dir.glob("*.xlsx"))

    files = sorted(files)

    if not files:
        print(f"No files found in {cohort_dir}")
        return

    print(f"\nBuilding {cohort_name}")

    master_df = None

    for file_path in files:

        course_df = load_course_file(file_path)

        if course_df is None:
            print(f"Skipped: {file_path.name}")
            continue

        print(
            f"Loaded: {file_path.name} -> {course_df.columns[1]}"
        )

        if master_df is None:
            master_df = course_df

        else:
            master_df = pd.merge(
                master_df,
                course_df,
                on="Student_ID",
                how="outer"
            )

    master_df = master_df.sort_values("Student_ID")

    PROCESSED_DIR.mkdir(
        parents=True,
        exist_ok=True
    )

    output_path = (
        PROCESSED_DIR /
        f"{cohort_name.lower()}_master_dataset.csv"
    )

    master_df.to_csv(
        output_path,
        index=False
    )

    print(f"Saved: {output_path}")
    print(f"Shape: {master_df.shape}")
    print(master_df.columns.tolist())


def main():

    for cohort in COHORTS:
        build_master_dataset_for_cohort(cohort)


if __name__ == "__main__":
    main()