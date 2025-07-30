from flask import Flask, render_template, request, redirect, url_for, session, jsonify
from itsdangerous import URLSafeTimedSerializer
from datetime import datetime, timedelta
import json
import os

# --- UYGULAMA KURULUMU (DEĞİŞİKLİK BURADA) ---
# Flask'a şablon ve statik dosyaların mevcut klasörde olduğunu belirtiyoruz.
app = Flask(__name__, template_folder='.', static_folder='.')

# Session (oturum) yönetimi için gizli bir anahtar.
app.secret_key = 'your-very-secret-key-for-flask-session' 
# Lisans anahtarlarını imzalamak için kullanılacak gizli anahtar.
LICENSE_SECRET_KEY = 'my-super-secret-and-long-key-for-signing'
s = URLSafeTimedSerializer(LICENSE_SECRET_KEY)

# --- VERİTABANI DOSYALARI ---
REQUESTS_DB_PATH = "requests_db.json"
LICENSES_DB_PATH = "licenses_db.json"

# --- YARDIMCI FONKSİYONLAR ---
def read_db(path):
    if not os.path.exists(path): return {}
    with open(path, 'r', encoding='utf-8') as f:
        try: return json.load(f)
        except json.JSONDecodeError: return {}

def write_db(path, data):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4)

# --- PANEL GİRİŞ VE ANA SAYFA ---
@app.route("/")
def index():
    if 'logged_in' in session: return redirect(url_for('dashboard'))
    return render_template("login.html")

@app.route("/login", methods=["POST"])
def login():
    if request.form.get("password") == "lunar1234team":
        session['logged_in'] = True
        return redirect(url_for('dashboard'))
    return render_template("login.html", error="Hatalı şifre!")

@app.route("/logout")
def logout():
    session.pop('logged_in', None)
    return redirect(url_for('index'))

@app.route("/dashboard")
def dashboard():
    if 'logged_in' not in session: return redirect(url_for('index'))
    return render_template("dashboard.html")

# --- PANEL API'LARI (JavaScript tarafından kullanılacak) ---
@app.route("/api/data", methods=["GET"])
def get_data():
    if 'logged_in' not in session: return jsonify({"error": "Unauthorized"}), 401
    requests_data = read_db(REQUESTS_DB_PATH)
    licenses_data = read_db(LICENSES_DB_PATH)
    return jsonify({"requests": requests_data, "licenses": licenses_data})

@app.route("/api/approve/<hwid>", methods=["POST"])
def approve_request(hwid):
    if 'logged_in' not in session: return jsonify({"error": "Unauthorized"}), 401
    days = int(request.json.get('days', 0))
    if days <= 0: return jsonify({"success": False, "message": "Geçerli gün sayısı girin."}), 400
    requests_data = read_db(REQUESTS_DB_PATH)
    if hwid in requests_data:
        licenses_data = read_db(LICENSES_DB_PATH)
        expiry_date = datetime.now() + timedelta(days=days)
        licenses_data[hwid] = {
            "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "expires_at": expiry_date.strftime("%Y-%m-%d %H:%M:%S")
        }
        del requests_data[hwid]
        write_db(REQUESTS_DB_PATH, requests_data)
        write_db(LICENSES_DB_PATH, licenses_data)
        return jsonify({"success": True, "message": f"{hwid} için {days} günlük lisans oluşturuldu."})
    return jsonify({"success": False, "message": "İstek bulunamadı."}), 404

@app.route("/api/deny/<hwid>", methods=["POST"])
def deny_request(hwid):
    if 'logged_in' not in session: return jsonify({"error": "Unauthorized"}), 401
    requests_data = read_db(REQUESTS_DB_PATH)
    if hwid in requests_data:
        del requests_data[hwid]
        write_db(REQUESTS_DB_PATH, requests_data)
        return jsonify({"success": True, "message": f"{hwid} isteği reddedildi."})
    return jsonify({"success": False, "message": "İstek bulunamadı."}), 404

@app.route("/api/delete_license/<hwid>", methods=["POST"])
def delete_license(hwid):
    if 'logged_in' not in session: return jsonify({"error": "Unauthorized"}), 401
    licenses_data = read_db(LICENSES_DB_PATH)
    if hwid in licenses_data:
        del licenses_data[hwid]
        write_db(LICENSES_DB_PATH, licenses_data)
        return jsonify({"success": True, "message": f"{hwid} lisansı silindi."})
    return jsonify({"success": False, "message": "Lisans bulunamadı."}), 404

# --- CLIENT UYGULAMASI İÇİN API ---
@app.route("/api/lisans", methods=["GET"])
def get_license_key():
    hwid = request.args.get('hwid')
    if not hwid: return jsonify({"status": "error", "message": "HWID belirtilmedi."}), 400
    licenses = read_db(LICENSES_DB_PATH)
    if hwid in licenses:
        license_info = licenses[hwid]
        expiry_date = datetime.strptime(license_info["expires_at"], "%Y-%m-%d %H:%M:%S")
        if expiry_date > datetime.now():
            data_to_sign = {'hwid': hwid, 'bitis': expiry_date.strftime("%Y-%m-%d")}
            signed_key = s.dumps(data_to_sign)
            return jsonify({"status": "ok", "key": signed_key})
        else:
            return jsonify({"status": "error", "message": "Lisansınızın süresi dolmuş."})
    else:
        requests_data = read_db(REQUESTS_DB_PATH)
        if hwid not in requests_data:
            requests_data[hwid] = {"requested_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
            write_db(REQUESTS_DB_PATH, requests_data)
        return jsonify({"status": "error", "message": "Lisans bulunamadı. Erişim isteğiniz panele gönderildi."})

if __name__ == "__main__":
    app.run(debug=True, host='0.0.0.0', port=5000)
