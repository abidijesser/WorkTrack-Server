from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import joblib

app = Flask(__name__)

CORS(app)

# Charger le modèle et les encodeurs
model = joblib.load("random_forest_duration.pkl")
label_encoders = joblib.load("duration_label_encoders.pkl")

# Colonnes attendues dans l'ordre
expected_columns = [
    'Budget', 'Actual Cost', 'Progress', 'Delay',
    'Budget Deviation', 'Project Type', 'Priority',
    'Task Status', 'Resource Usage Ratio'
]

@app.route('/predict-duration', methods=['POST'])
def predict_duration():
    try:
        data = request.get_json()

        # Créer DataFrame à partir de la requête
        df = pd.DataFrame([data])

        # Encoder les colonnes catégorielles
        for col, le in label_encoders.items():
            if col in df.columns:
                if df[col][0] in le.classes_:
                    df[col] = le.transform(df[col])
                else:
                    df[col] = -1  # Classe inconnue

        # Ajouter colonnes manquantes si nécessaire
        for col in expected_columns:
            if col not in df.columns:
                df[col] = 0  # valeur par défaut

        # Réorganiser les colonnes
        df = df[expected_columns]

        # Prédiction
        pred = model.predict(df)[0]

        return jsonify({
            'estimated_duration': round(pred, 2)
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)