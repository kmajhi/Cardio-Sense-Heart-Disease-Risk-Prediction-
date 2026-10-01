"""The Prediction page's three sample patients (frontend fields.js → PRESETS), in API
payload units. The admin console's model check and the tests run them to confirm
each still lands in its own band after a retrain."""

SAMPLES = {
    "low": dict(age=34, sex="F", height_cm=156, weight_kg=54, family_history=0, hypertension=0, diabetes=0,
                chest_pain_history=0, bp_mmhg=110, rbs_mmol_l=5.4, total_cholesterol=170, hdl=55, ldl=95,
                triglycerides=110, hemoglobin=12.8, creatinine=0.8, platelets=260000, sodium=139, potassium=4.1,
                chloride=102, troponin_i=0.01, troponin_assay="quantitative"),
    "moderate": dict(age=48, sex="M", height_cm=165, weight_kg=74, family_history=1, hypertension=1, diabetes=0,
                     chest_pain_history=0, bp_mmhg=132, rbs_mmol_l=6.4, total_cholesterol=205, hdl=40, ldl=135,
                     triglycerides=150, hemoglobin=13.6, creatinine=1.0, platelets=250000, sodium=139, potassium=4.2,
                     chloride=101, troponin_i=0.02, troponin_assay="quantitative"),
    "high": dict(age=66, sex="M", height_cm=162, weight_kg=78, family_history=1, hypertension=1, diabetes=1,
                 chest_pain_history=1, bp_mmhg=185, rbs_mmol_l=14.5, total_cholesterol=270, hdl=32, ldl=185,
                 triglycerides=280, hemoglobin=11.2, creatinine=1.9, platelets=230000, sodium=134, potassium=4.6,
                 chloride=99, troponin_i=850, troponin_assay="high-sensitivity"),
}
