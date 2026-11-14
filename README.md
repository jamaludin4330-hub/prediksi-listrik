# Peramalan Konsumsi Listrik Harian Berdasarkan Data Cuaca Menggunakan LSTM

Proyek TA-04 Pembelajaran Mesin (Modul 04 LSTM). Aplikasi web Flask yang menampilkan data historis, evaluasi model, dan peramalan konsumsi listrik harian.

## Struktur folder

    app.py                  aplikasi Flask
    train_model.py          kode training (versi script dari notebook)
    requirements.txt        daftar library untuk deploy
    Procfile                perintah start untuk Render/Railway
    data/                   dataset CSV
    model/                  hasil training (WAJIB diisi, lihat di bawah)
    templates/index.html    halaman web
    static/css/style.css    tampilan
    static/js/main.js       logika halaman

## Isi folder model

Folder model/ harus berisi 5 file hasil training dari Google Colab:

- model_lstm.h5
- scaler_fitur.pkl
- scaler_target.pkl
- data_bersih.csv
- ringkasan.json

Ambil dari model.zip hasil notebook, ekstrak, lalu taruh isinya di folder model/ ini. Tanpa folder ini aplikasi tidak bisa jalan.

## Menjalankan

    python -m venv venv
    venv\Scripts\activate
    python -m pip install -r requirements.txt
    python app.py

Buka http://127.0.0.1:5000

## Menjalankan ulang training

Di Google Colab: upload CSV, jalankan sel per sel dari notebook. Di lokal: python train_model.py (butuh TensorFlow yang bisa jalan).

## Deploy (Render)

- Build Command: pip install -r requirements.txt
- Start Command: gunicorn app:app --workers 1 --timeout 120
- Environment Variable: PYTHON_VERSION = 3.11.8
