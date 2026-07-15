import pandas as pd


EARLY_COURSES = [
    "CT1",
    "OB",
    "Peds",
    "Comm",
    "Men",
]

LATE_COURSES = [
    "MS",
    "CT2",
    "Leadership",
]


def add_engineered_features(df: pd.DataFrame, pass_mark: float = 75) -> pd.DataFrame:
    df = df.copy()

    numeric_cols = [
        col for col in df.columns
        if col not in ["StudentID", "Cohort", "Comprehensive", "Pass"]
    ]

    for col in numeric_cols:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    available_early = [
        col for col in EARLY_COURSES
        if col in df.columns
    ]

    available_late = [
        col for col in LATE_COURSES
        if col in df.columns
    ]

    available_courses = list(
        dict.fromkeys(available_early + available_late)
    )

    if "CT1" in df.columns and "CT2" in df.columns:
        df["CT_Growth"] = df["CT2"] - df["CT1"]

    if available_early:
        df["Early_Average"] = df[available_early].mean(axis=1)

    if available_late:
        df["Late_Average"] = df[available_late].mean(axis=1)

    if available_early and available_late:
        df["Growth_Trend"] = df["Late_Average"] - df["Early_Average"]

    if available_courses:
        df["Overall_Average"] = df[available_courses].mean(axis=1)
        df["Lowest_Score"] = df[available_courses].min(axis=1)
        df["Highest_Score"] = df[available_courses].max(axis=1)
        df["Score_Range"] = df["Highest_Score"] - df["Lowest_Score"]
        df["Score_Std"] = df[available_courses].std(axis=1)
        df["Weak_Course_Count"] = (
            df[available_courses] < pass_mark
        ).sum(axis=1)

    return df