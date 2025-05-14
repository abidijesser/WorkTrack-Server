from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import joblib

app = Flask(__name__)

# Configure CORS to allow requests from http://localhost:3000 with credentials
CORS(app, resources={
    r"/predict-budget": {
        "origins": "http://localhost:3000",
        "supports_credentials": True
    }
})
# Charger le modèle et les encodeurs pour le budget
model = joblib.load("linear_regression_model.pkl")
scaler = joblib.load("scaler.pkl")
label_encoders = joblib.load("label_encoders.pkl")

# Colonnes attendues dans l'ordre pour le budget
expected_columns = [
    'Actual Cost', 'Progress', 'Budget Deviation', 
    'Project Type', 'Priority', 'Task Status', 
    'Resource Usage Ratio'
]

@app.route('/predict-budget', methods=['POST'])
def predict_budget():
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

        # Appliquer le scaler sur les données d'entrée
        df_scaled = scaler.transform(df)

        # Prédiction
        predicted_budget = model.predict(df_scaled)[0]

        return jsonify({
            'predicted_budget': round(predicted_budget, 2)
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)
