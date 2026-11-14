// Variabel global
let dataRingkasan = null;
let chartHistoris = null;
let chartEvaluasi = null;
let chartLoss = null;
let chartRamalan = null;

let varAktif = 'daily_consumption';
let rentangAktif = 'all';
let rentangEvaluasi = 'all';
let hariAktif = 1;

const WARNA = {
    indigo: '#4f46e5',
    violet: '#7c3aed',
    cyan: '#06b6d4',
    emerald: '#10b981',
    amber: '#f59e0b',
    rose: '#f43f5e'
};

const INFO_VAR = {
    daily_consumption: { label: 'Konsumsi Listrik Harian', warna: WARNA.indigo },
    TMAX: { label: 'Suhu Maksimum (TMAX)', warna: WARNA.rose },
    TMIN: { label: 'Suhu Minimum (TMIN)', warna: WARNA.cyan },
    AWND: { label: 'Kecepatan Angin (AWND)', warna: WARNA.emerald },
    PRCP: { label: 'Curah Hujan (PRCP)', warna: WARNA.amber }
};

// Fungsi bantu
function el(id) {
    return document.getElementById(id);
}

function setTeks(id, teks) {
    el(id).textContent = teks;
}

function fmt(angka, desimal = 2) {
    return Number(angka).toLocaleString('id-ID', {
        minimumFractionDigits: desimal,
        maximumFractionDigits: desimal
    });
}

function fmtTanggal(teks) {
    const d = new Date(teks + 'T00:00:00');
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

function warnaTransparan(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + alpha + ')';
}

function irisan(array, n) {
    return n === 'all' ? array : array.slice(-Number(n));
}

function aktifkanTombol(grup, tombol) {
    grup.querySelectorAll('.chip').forEach(function (t) {
        t.classList.remove('active');
        t.setAttribute('aria-pressed', 'false');
    });
    tombol.classList.add('active');
    tombol.setAttribute('aria-pressed', 'true');
}

// Opsi grafik
function opsiGaris() {
    return {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
            legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } },
            tooltip: {
                callbacks: {
                    title: function (items) { return fmtTanggal(items[0].label); }
                }
            }
        },
        scales: {
            x: {
                grid: { display: false },
                ticks: {
                    maxTicksLimit: 7,
                    maxRotation: 0,
                    callback: function (value) { return fmtTanggal(this.getLabelForValue(value)); }
                }
            },
            y: { grid: { color: 'rgba(148, 163, 184, 0.2)' } }
        }
    };
}

function opsiLoss() {
    return {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } } },
        scales: {
            x: { grid: { display: false }, title: { display: true, text: 'Epoch' } },
            y: { grid: { color: 'rgba(148, 163, 184, 0.2)' }, title: { display: true, text: 'Loss (MSE)' } }
        }
    };
}

// Navigasi: menu mobile, navigasi aktif, dan bayangan saat scroll
function setupNavigasi() {
    const navbar = el('navbar');
    const toggle = el('navToggle');
    const menu = el('navLinks');
    const links = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('main section[id]');

    function setAktifNav(id) {
        links.forEach(function (l) {
            const aktif = l.dataset.section === id;
            l.classList.toggle('active', aktif);
            if (aktif) { l.setAttribute('aria-current', 'page'); } else { l.removeAttribute('aria-current'); }
        });
    }

    function tutupMenu() {
        menu.classList.remove('open');
        toggle.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
    }

    toggle.addEventListener('click', function () {
        const buka = menu.classList.toggle('open');
        toggle.classList.toggle('open', buka);
        toggle.setAttribute('aria-expanded', buka ? 'true' : 'false');
    });

    links.forEach(function (l) {
        l.addEventListener('click', function () {
            setAktifNav(l.dataset.section);
            tutupMenu();
        });
    });

    const observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
            if (e.isIntersecting) { setAktifNav(e.target.id); }
        });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach(function (s) { observer.observe(s); });

    window.addEventListener('scroll', function () {
        navbar.classList.toggle('scrolled', window.scrollY > 10);
    });
}

// Statistik di beranda
function isiStatistik() {
    const info = dataRingkasan.info;
    const m = dataRingkasan.metrik;
    setTeks('statJumlah', fmt(info.jumlah_data, 0));
    setTeks('statRentang', fmtTanggal(info.tanggal_awal) + ' - ' + fmtTanggal(info.tanggal_akhir));
    setTeks('statRmse', fmt(m.rmse));
    setTeks('statMae', fmt(m.mae));
}

// Grafik data historis
function dataHistoris() {
    const h = dataRingkasan.historis;
    return {
        label: irisan(h.tanggal, rentangAktif),
        nilai: irisan(h[varAktif], rentangAktif)
    };
}

function updateStatHistoris() {
    const n = dataHistoris().nilai;
    const rata = n.reduce(function (a, b) { return a + b; }, 0) / n.length;
    setTeks('statJudulVar', INFO_VAR[varAktif].label);
    setTeks('statRata', fmt(rata));
    setTeks('statMaks', fmt(Math.max.apply(null, n)));
    setTeks('statMin', fmt(Math.min.apply(null, n)));
}

function buatChartHistoris() {
    const d = dataHistoris();
    const w = INFO_VAR[varAktif].warna;
    chartHistoris = new Chart(el('chartHistoris').getContext('2d'), {
        type: 'line',
        data: {
            labels: d.label,
            datasets: [{
                label: INFO_VAR[varAktif].label,
                data: d.nilai,
                borderColor: w,
                backgroundColor: warnaTransparan(w, 0.12),
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 4,
                tension: 0.25,
                fill: true
            }]
        },
        options: opsiGaris()
    });
    updateStatHistoris();
}

function updateChartHistoris() {
    const d = dataHistoris();
    const w = INFO_VAR[varAktif].warna;
    const ds = chartHistoris.data.datasets[0];
    chartHistoris.data.labels = d.label;
    ds.data = d.nilai;
    ds.label = INFO_VAR[varAktif].label;
    ds.borderColor = w;
    ds.backgroundColor = warnaTransparan(w, 0.12);
    chartHistoris.update();
    updateStatHistoris();
}

// Evaluasi model
function isiMetrik() {
    const m = dataRingkasan.metrik;
    setTeks('metricRmse', fmt(m.rmse));
    setTeks('metricMae', fmt(m.mae));
    setTeks('metricMape', fmt(m.mape) + '%');
    setTeks('metricBase', fmt(m.rmse_baseline));

    if (m.rmse < m.rmse_baseline) {
        setTeks('teksBanding', 'RMSE model (' + fmt(m.rmse) + ') lebih kecil daripada baseline (' + fmt(m.rmse_baseline) + '), artinya model LSTM lebih baik daripada sekadar menebak konsumsi sama seperti kemarin.');
    } else {
        setTeks('teksBanding', 'RMSE model (' + fmt(m.rmse) + ') belum lebih kecil daripada baseline (' + fmt(m.rmse_baseline) + '), artinya model belum mengungguli tebakan sederhana konsumsi sama seperti kemarin.');
    }
}

function dataEvaluasi() {
    const e = dataRingkasan.evaluasi;
    return {
        tanggal: irisan(e.tanggal, rentangEvaluasi),
        aktual: irisan(e.aktual, rentangEvaluasi),
        prediksi: irisan(e.prediksi, rentangEvaluasi)
    };
}

function buatChartEvaluasi() {
    const d = dataEvaluasi();
    chartEvaluasi = new Chart(el('chartEvaluasi').getContext('2d'), {
        type: 'line',
        data: {
            labels: d.tanggal,
            datasets: [
                { label: 'Aktual', data: d.aktual, borderColor: WARNA.indigo, borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0.2 },
                { label: 'Prediksi', data: d.prediksi, borderColor: WARNA.amber, borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0.2 }
            ]
        },
        options: opsiGaris()
    });
}

function updateChartEvaluasi() {
    const d = dataEvaluasi();
    chartEvaluasi.data.labels = d.tanggal;
    chartEvaluasi.data.datasets[0].data = d.aktual;
    chartEvaluasi.data.datasets[1].data = d.prediksi;
    chartEvaluasi.update();
}

function buatChartLoss() {
    const l = dataRingkasan.loss;
    const label = l.train.map(function (_, i) { return i + 1; });
    chartLoss = new Chart(el('chartLoss').getContext('2d'), {
        type: 'line',
        data: {
            labels: label,
            datasets: [
                { label: 'Loss latih', data: l.train, borderColor: WARNA.indigo, borderWidth: 2, pointRadius: 0, tension: 0.2 },
                { label: 'Loss validasi', data: l.val, borderColor: WARNA.rose, borderWidth: 2, pointRadius: 0, tension: 0.2 }
            ]
        },
        options: opsiLoss()
    });
}

function isiTabelEvaluasi() {
    const e = dataRingkasan.evaluasi;
    const mulai = Math.max(0, e.tanggal.length - 10);
    let html = '';
    for (let i = e.tanggal.length - 1; i >= mulai; i--) {
        const selisih = e.prediksi[i] - e.aktual[i];
        const kelas = selisih > 0 ? 'naik' : 'turun';
        const tanda = selisih > 0 ? '+' : '';
        html += '<tr><td>' + fmtTanggal(e.tanggal[i]) + '</td><td>' + fmt(e.aktual[i]) + '</td><td>' + fmt(e.prediksi[i]) + '</td><td class="' + kelas + '">' + tanda + fmt(selisih) + '</td></tr>';
    }
    el('tabelEvaluasi').innerHTML = html;
}

function isiInfoModel() {
    const info = dataRingkasan.info;
    setTeks('infoTimesteps', info.timesteps + ' hari');
    setTeks('infoFitur', info.fitur.join(', '));
    setTeks('infoTrain', fmt(info.jumlah_train, 0) + ' baris');
    setTeks('infoTest', fmt(info.jumlah_test, 0) + ' baris');
    setTeks('infoEpoch', info.epoch_berjalan);
}

// Peramalan
function isiFormAwal() {
    const t = dataRingkasan.terakhir;
    el('inAwnd').value = t.AWND;
    el('inPrcp').value = t.PRCP;
    el('inTmax').value = t.TMAX;
    el('inTmin').value = t.TMIN;
    aturStatusSkenario();
}

function aturStatusSkenario() {
    const nonaktif = hariAktif === 1;
    ['inAwnd', 'inPrcp', 'inTmax', 'inTmin'].forEach(function (id) {
        el(id).disabled = nonaktif;
    });
    if (nonaktif) {
        setTeks('catatanSkenario', 'Peramalan 1 hari memakai 30 hari terakhir data asli, jadi skenario cuaca belum dipakai. Pilih 3, 7, atau 14 hari untuk mengaktifkannya.');
    } else {
        setTeks('catatanSkenario', 'Cuaca ini diasumsikan sama untuk setiap hari mendatang. Semakin jauh harinya, semakin besar ketidakpastian hasil peramalan.');
    }
}

function tampilPesan(teks) {
    const p = el('pesanRamalan');
    p.textContent = teks;
    p.classList.remove('hidden');
}

function tampilHasil(data) {
    const hs = data.hasil;
    const rv = data.riwayat;

    el('hasilKosong').classList.add('hidden');
    el('hasilRamalan').classList.remove('hidden');

    setTeks('ramalPertamaNilai', fmt(hs[0].prediksi));
    setTeks('ramalPertamaTgl', fmtTanggal(hs[0].tanggal));

    const akhir = hs[hs.length - 1];
    el('cardAkhir').classList.toggle('hidden', hs.length === 1);
    setTeks('ramalAkhirNilai', fmt(akhir.prediksi));
    setTeks('ramalAkhirTgl', fmtTanggal(akhir.tanggal));

    let html = '';
    hs.forEach(function (h) {
        html += '<tr><td>' + fmtTanggal(h.tanggal) + '</td><td>' + fmt(h.prediksi) + '</td></tr>';
    });
    el('tabelRamalan').innerHTML = html;

    // Susun data grafik: 30 hari terakhir lalu hasil peramalan
    const label = rv.tanggal.concat(hs.map(function (h) { return h.tanggal; }));
    const dataRiwayat = rv.konsumsi.concat(hs.map(function () { return null; }));
    const dataRamal = rv.konsumsi.map(function () { return null; });
    dataRamal[dataRamal.length - 1] = rv.konsumsi[rv.konsumsi.length - 1];
    hs.forEach(function (h) { dataRamal.push(h.prediksi); });

    if (chartRamalan) { chartRamalan.destroy(); }
    chartRamalan = new Chart(el('chartRamalan').getContext('2d'), {
        type: 'line',
        data: {
            labels: label,
            datasets: [
                { label: 'Data 30 hari terakhir', data: dataRiwayat, borderColor: WARNA.indigo, backgroundColor: warnaTransparan(WARNA.indigo, 0.1), borderWidth: 2, pointRadius: 0, tension: 0.2, fill: true },
                { label: 'Hasil peramalan', data: dataRamal, borderColor: WARNA.emerald, borderWidth: 3, pointRadius: 4, pointBackgroundColor: WARNA.emerald, tension: 0.2 }
            ]
        },
        options: opsiGaris()
    });
}

async function jalankanRamalan() {
    const tombol = el('btnRamal');
    el('pesanRamalan').classList.add('hidden');

    const payload = {
        hari: hariAktif,
        awnd: parseFloat(el('inAwnd').value),
        prcp: parseFloat(el('inPrcp').value),
        tmax: parseFloat(el('inTmax').value),
        tmin: parseFloat(el('inTmin').value)
    };

    // Validasi di sisi pengguna
    if ([payload.awnd, payload.prcp, payload.tmax, payload.tmin].some(Number.isNaN)) {
        tampilPesan('Semua kolom cuaca harus diisi dengan angka.');
        return;
    }
    if (payload.awnd < 0 || payload.prcp < 0) {
        tampilPesan('Kecepatan angin dan curah hujan tidak boleh negatif.');
        return;
    }
    if (payload.tmin > payload.tmax) {
        tampilPesan('Suhu minimum tidak boleh lebih besar dari suhu maksimum.');
        return;
    }

    tombol.classList.add('loading');
    tombol.disabled = true;

    try {
        const res = await fetch('/api/ramalan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) { throw new Error(data.error || 'Terjadi kesalahan pada server.'); }
        tampilHasil(data);
    } catch (err) {
        tampilPesan(err.message);
    } finally {
        tombol.classList.remove('loading');
        tombol.disabled = false;
    }
}

// Pasang event pada semua tombol
function setupKontrol() {
    const grupVariabel = el('grupVariabel');
    grupVariabel.querySelectorAll('.chip').forEach(function (btn) {
        btn.addEventListener('click', function () {
            varAktif = btn.dataset.var;
            aktifkanTombol(grupVariabel, btn);
            if (chartHistoris) { updateChartHistoris(); }
        });
    });

    const grupRentang = el('grupRentang');
    grupRentang.querySelectorAll('.chip').forEach(function (btn) {
        btn.addEventListener('click', function () {
            rentangAktif = btn.dataset.rentang;
            aktifkanTombol(grupRentang, btn);
            if (chartHistoris) { updateChartHistoris(); }
        });
    });

    const grupEvaluasi = el('grupEvaluasi');
    grupEvaluasi.querySelectorAll('.chip').forEach(function (btn) {
        btn.addEventListener('click', function () {
            rentangEvaluasi = btn.dataset.erange;
            aktifkanTombol(grupEvaluasi, btn);
            if (chartEvaluasi) { updateChartEvaluasi(); }
        });
    });

    const grupHari = el('grupHari');
    grupHari.querySelectorAll('.chip').forEach(function (btn) {
        btn.addEventListener('click', function () {
            hariAktif = parseInt(btn.dataset.hari, 10);
            aktifkanTombol(grupHari, btn);
            aturStatusSkenario();
        });
    });

    el('btnRamal').addEventListener('click', jalankanRamalan);
    el('btnReset').addEventListener('click', function () {
        if (dataRingkasan) { isiFormAwal(); }
        el('pesanRamalan').classList.add('hidden');
    });
}

// Muat data dari server lalu tampilkan
async function muatData() {
    try {
        const res = await fetch('/api/ringkasan');
        if (!res.ok) { throw new Error('Gagal memuat data'); }
        dataRingkasan = await res.json();

        isiStatistik();
        buatChartHistoris();
        isiMetrik();
        buatChartEvaluasi();
        buatChartLoss();
        isiTabelEvaluasi();
        isiInfoModel();
        isiFormAwal();
    } catch (err) {
        el('errorGlobal').classList.remove('hidden');
    }
}

// Jalankan saat halaman siap
document.addEventListener('DOMContentLoaded', function () {
    Chart.defaults.font.family = "'Plus Jakarta Sans', sans-serif";
    Chart.defaults.color = '#64748b';
    setTeks('tahun', new Date().getFullYear());
    setupNavigasi();
    setupKontrol();
    muatData();
});
