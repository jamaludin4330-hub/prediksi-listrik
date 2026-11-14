# Import library yang dibutuhkan
import os
import json
import numpy as np
import pandas as pd
import joblib
import matplotlib.pyplot as plt
import tensorflow as tf
from sklearn.preprocessing import MinMaxScaler
from sklearn.metrics import mean_squared_error, mean_absolute_error
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Input, LSTM, Dense, Dropout
from tensorflow.keras.callbacks import EarlyStopping

# Atur seed supaya hasil lebih konsisten
np.random.seed(42)
tf.random.set_seed(42)
os.makedirs('model', exist_ok=True)

# Langkah 1: Muat data dan jadikan kolom waktu sebagai index
df = pd.read_csv('data/electricity_consumption_based_weather_dataset.csv')
df['date'] = pd.to_datetime(df['date'])
df.set_index('date', inplace=True)

print(df.head())
print(df.info())
print('Jumlah data kosong per kolom:')
print(df.isna().sum())

# Langkah 2: Visualisasi awal (tren dan seasonality)
plt.figure(figsize=(14, 6))
plt.plot(df['daily_consumption'], color='#4f46e5', alpha=0.5, label='Konsumsi harian')
plt.plot(df['daily_consumption'].rolling(30).mean(), color='#f43f5e', linewidth=2, label='Rata-rata 30 hari')
plt.title('Konsumsi Listrik Harian')
plt.xlabel('Tanggal')
plt.ylabel('Konsumsi')
plt.legend()
plt.grid(True)
plt.savefig('model/eda_konsumsi.png', dpi=120, bbox_inches='tight')
plt.show()  # Hapus baris ini jika dijalankan lewat terminal

# Langkah 3: Pembersihan data
# Samakan frekuensi jadi harian supaya tanggal yang bolong ikut terlihat
df = df.asfreq('D')
print('Tanggal bolong yang ditambahkan:', df['daily_consumption'].isna().sum())

# Isi nilai kosong dengan interpolasi berdasarkan waktu
df = df.interpolate(method='time')
df = df.bfill().ffill()
print('Sisa data kosong:', df.isna().sum().sum())
df.to_csv('model/data_bersih.csv', index_label='date')

# Langkah 4: Normalisasi data
# Scaler hanya dilatih pada data latih supaya tidak ada kebocoran data
KOLOM_FITUR = ['AWND', 'PRCP', 'TMAX', 'TMIN', 'daily_consumption']
TIMESTEPS = 30
n_total = len(df)
n_train = int(n_total * 0.8)

scaler_fitur = MinMaxScaler(feature_range=(0, 1))
scaler_fitur.fit(df[KOLOM_FITUR].iloc[:n_train])
scaled_data = scaler_fitur.transform(df[KOLOM_FITUR])

# Scaler khusus target supaya mudah di-inverse transform
scaler_target = MinMaxScaler(feature_range=(0, 1))
scaler_target.fit(df[['daily_consumption']].iloc[:n_train])

# Langkah 5: Membuat data sekuensial (windowing)
# Pakai 30 hari terakhir untuk memprediksi hari ke-31
X = []
y = []

for i in range(TIMESTEPS, len(scaled_data)):
    X.append(scaled_data[i - TIMESTEPS:i, :])
    y.append(scaled_data[i, -1])

# Bentuk X sudah 3D: (samples, timesteps, features)
X, y = np.array(X), np.array(y)
print('Bentuk X:', X.shape)
print('Bentuk y:', y.shape)

# Pisahkan data latih dan data uji berdasarkan urutan waktu
batas = n_train - TIMESTEPS
X_train, X_test = X[:batas], X[batas:]
y_train, y_test = y[:batas], y[batas:]
tanggal_test = df.index[n_train:]

# Langkah 6: Membangun arsitektur model LSTM
model = Sequential([
    Input(shape=(TIMESTEPS, len(KOLOM_FITUR))),
    LSTM(units=64, return_sequences=True),
    Dropout(0.2),
    LSTM(units=32, return_sequences=False),
    Dropout(0.2),
    Dense(units=16, activation='relu'),
    Dense(units=1)
])

model.compile(optimizer='adam', loss='mean_squared_error')
model.summary()

# Langkah 7: Melatih model
early_stop = EarlyStopping(monitor='val_loss', patience=15, restore_best_weights=True)

history = model.fit(
    X_train, y_train,
    epochs=100,
    batch_size=32,
    validation_split=0.1,
    callbacks=[early_stop],
    verbose=1
)

# Langkah 8: Evaluasi model
pred_scaled = model.predict(X_test)
prediksi = scaler_target.inverse_transform(pred_scaled).flatten()
aktual = scaler_target.inverse_transform(y_test.reshape(-1, 1)).flatten()

mse = mean_squared_error(aktual, prediksi)
rmse = np.sqrt(mse)
mae = mean_absolute_error(aktual, prediksi)
mape = np.mean(np.abs((aktual - prediksi) / aktual)) * 100

# Baseline sederhana: konsumsi hari ini dianggap sama dengan kemarin
naive = df['daily_consumption'].shift(1).iloc[n_train:].values
rmse_base = np.sqrt(mean_squared_error(aktual, naive))
mae_base = mean_absolute_error(aktual, naive)

print(f'RMSE : {rmse:.2f}')
print(f'MAE  : {mae:.2f}')
print(f'MAPE : {mape:.2f}%')
print(f'RMSE baseline : {rmse_base:.2f}')
print(f'MAE baseline  : {mae_base:.2f}')

# Visualisasi aktual vs prediksi
plt.figure(figsize=(14, 6))
plt.plot(tanggal_test, aktual, color='#4f46e5', label='Konsumsi Aktual')
plt.plot(tanggal_test, prediksi, color='#f59e0b', label='Konsumsi Prediksi')
plt.title('Peramalan Konsumsi Listrik Harian dengan LSTM')
plt.xlabel('Tanggal')
plt.ylabel('Konsumsi')
plt.legend()
plt.grid(True)
plt.savefig('model/hasil_prediksi.png', dpi=120, bbox_inches='tight')
plt.show()  # Hapus baris ini jika dijalankan lewat terminal

# Visualisasi loss
plt.figure(figsize=(10, 5))
plt.plot(history.history['loss'], color='#4f46e5', label='Loss latih')
plt.plot(history.history['val_loss'], color='#f43f5e', label='Loss validasi')
plt.title('Grafik Loss Selama Pelatihan')
plt.xlabel('Epoch')
plt.ylabel('Loss (MSE)')
plt.legend()
plt.grid(True)
plt.savefig('model/grafik_loss.png', dpi=120, bbox_inches='tight')
plt.show()  # Hapus baris ini jika dijalankan lewat terminal

# Langkah 9: Simpan model dan scaler
model.save('model/model_lstm.h5')
joblib.dump(scaler_fitur, 'model/scaler_fitur.pkl')
joblib.dump(scaler_target, 'model/scaler_target.pkl')

# Simpan ringkasan untuk ditampilkan di aplikasi web
ringkasan = {
    'info': {
        'jumlah_data': int(n_total),
        'tanggal_awal': str(df.index.min().date()),
        'tanggal_akhir': str(df.index.max().date()),
        'timesteps': TIMESTEPS,
        'fitur': KOLOM_FITUR,
        'jumlah_train': int(n_train),
        'jumlah_test': int(n_total - n_train),
        'epoch_berjalan': len(history.history['loss'])
    },
    'metrik': {
        'rmse': round(float(rmse), 2),
        'mae': round(float(mae), 2),
        'mape': round(float(mape), 2),
        'rmse_baseline': round(float(rmse_base), 2),
        'mae_baseline': round(float(mae_base), 2)
    },
    'historis': {
        'tanggal': df.index.strftime('%Y-%m-%d').tolist(),
        'daily_consumption': df['daily_consumption'].round(2).tolist(),
        'TMAX': df['TMAX'].round(2).tolist(),
        'TMIN': df['TMIN'].round(2).tolist(),
        'AWND': df['AWND'].round(2).tolist(),
        'PRCP': df['PRCP'].round(2).tolist()
    },
    'evaluasi': {
        'tanggal': tanggal_test.strftime('%Y-%m-%d').tolist(),
        'aktual': np.round(aktual, 2).tolist(),
        'prediksi': np.round(prediksi, 2).tolist()
    },
    'loss': {
        'train': [round(float(v), 6) for v in history.history['loss']],
        'val': [round(float(v), 6) for v in history.history['val_loss']]
    },
    'terakhir': {
        'AWND': round(float(df['AWND'].iloc[-1]), 2),
        'PRCP': round(float(df['PRCP'].iloc[-1]), 2),
        'TMAX': round(float(df['TMAX'].iloc[-1]), 2),
        'TMIN': round(float(df['TMIN'].iloc[-1]), 2)
    }
}

with open('model/ringkasan.json', 'w', encoding='utf-8') as f:
    json.dump(ringkasan, f, ensure_ascii=False)

print('Model, scaler, dan ringkasan berhasil disimpan di folder model.')
