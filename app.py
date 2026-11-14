# Import library yang dibutuhkan
import json
import numpy as np
import pandas as pd
import joblib
from flask import Flask, render_template, request, jsonify
from tensorflow.keras.models import load_model

app = Flask(__name__)

# Muat model, scaler, dan data saat aplikasi dijalankan
model = load_model('model/model_lstm.h5', compile=False)
scaler_fitur = joblib.load('model/scaler_fitur.pkl')
scaler_target = joblib.load('model/scaler_target.pkl')
df = pd.read_csv('model/data_bersih.csv', parse_dates=['date'], index_col='date')

with open('model/ringkasan.json', encoding='utf-8') as f:
    ringkasan = json.load(f)

KOLOM_FITUR = ringkasan['info']['fitur']
TIMESTEPS = ringkasan['info']['timesteps']


# Halaman utama
@app.route('/')
def index():
    return render_template('index.html')


# Data untuk dashboard
@app.route('/api/ringkasan')
def api_ringkasan():
    return jsonify(ringkasan)


# Peramalan beberapa hari ke depan
@app.route('/api/ramalan', methods=['POST'])
def api_ramalan():
    # Validasi input
    try:
        data = request.get_json()
        hari = int(data.get('hari', 1))
        awnd = float(data['awnd'])
        prcp = float(data['prcp'])
        tmax = float(data['tmax'])
        tmin = float(data['tmin'])
    except (KeyError, TypeError, ValueError):
        return jsonify({'error': 'Input tidak valid. Pastikan semua kolom diisi dengan angka.'}), 400

    if hari < 1 or hari > 14:
        return jsonify({'error': 'Jumlah hari harus antara 1 sampai 14.'}), 400
    if awnd < 0 or prcp < 0:
        return jsonify({'error': 'Kecepatan angin dan curah hujan tidak boleh negatif.'}), 400
    if tmin > tmax:
        return jsonify({'error': 'Suhu minimum tidak boleh lebih besar dari suhu maksimum.'}), 400

    # Ambil 30 hari terakhir dari data sebagai input awal
    window = scaler_fitur.transform(df[KOLOM_FITUR].iloc[-TIMESTEPS:])
    tanggal_terakhir = df.index[-1]
    hasil = []

    for k in range(1, hari + 1):
        x = window[-TIMESTEPS:].reshape(1, TIMESTEPS, len(KOLOM_FITUR))
        pred_scaled = model.predict(x, verbose=0)
        pred = float(scaler_target.inverse_transform(pred_scaled)[0, 0])

        tanggal = tanggal_terakhir + pd.Timedelta(days=k)
        hasil.append({
            'tanggal': tanggal.strftime('%Y-%m-%d'),
            'prediksi': round(pred, 2)
        })

        # Tambahkan hasil prediksi sebagai baris baru untuk langkah berikutnya
        baris = pd.DataFrame([[awnd, prcp, tmax, tmin, pred]], columns=KOLOM_FITUR)
        window = np.vstack([window, scaler_fitur.transform(baris)])

    riwayat = df['daily_consumption'].iloc[-30:]
    return jsonify({
        'hasil': hasil,
        'riwayat': {
            'tanggal': riwayat.index.strftime('%Y-%m-%d').tolist(),
            'konsumsi': riwayat.round(2).tolist()
        }
    })


if __name__ == '__main__':
    app.run(debug=True, use_reloader=False)
