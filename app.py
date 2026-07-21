#!/usr/bin/env python3
import hashlib
import os
import sqlite3
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "users.db")
TEMPLATES_DIR = os.path.join(BASE_DIR, "templates")


def init_db() -> None:
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
        """
    )
    conn.commit()
    conn.close()


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def create_user(username: str, email: str, password: str) -> bool:
    conn = sqlite3.connect(DB_PATH)
    try:
        conn.execute(
            "INSERT INTO users (username, email, password, created_at) VALUES (?, ?, ?, datetime('now'))",
            (username, email, hash_password(password)),
        )
        conn.commit()
        return True
    except sqlite3.IntegrityError:
        return False
    finally:
        conn.close()


def verify_login(username_or_email: str, password: str):
    conn = sqlite3.connect(DB_PATH)
    try:
        return conn.execute(
            "SELECT id, username FROM users WHERE (username = ? OR email = ?) AND password = ?",
            (username_or_email, username_or_email, hash_password(password)),
        ).fetchone()
    finally:
        conn.close()


def read_template(name: str, **kwargs) -> str:
    path = os.path.join(TEMPLATES_DIR, name)
    with open(path, encoding="utf-8") as handle:
        content = handle.read()

    for key, value in kwargs.items():
        content = content.replace("{{" + key + "}}", str(value))

    return content


class AuthHandler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/":
            self.send_html(read_template("login.html", message="", message_class=""))
        elif path == "/signup":
            self.send_html(read_template("signup.html", message="", message_class=""))
        elif path == "/login":
            self.send_html(read_template("login.html", message="", message_class=""))
        elif path == "/dashboard":
            cookie = self.headers.get("Cookie", "")
            user_id = None
            username = None
            for part in cookie.split(";"):
                if "user_id=" in part:
                    user_id = part.split("=", 1)[1]
                if "username=" in part:
                    username = part.split("=", 1)[1]

            if user_id and username:
                self.send_html(read_template("dashboard.html", username=username))
            else:
                self.redirect("/login")
        elif path == "/logout":
            self.send_response(303)
            self.send_header("Location", "/login")
            self.send_header("Set-Cookie", "user_id=; Max-Age=0; Path=/")
            self.send_header("Set-Cookie", "username=; Max-Age=0; Path=/")
            self.end_headers()
        else:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b"Not found")

    def do_POST(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        path = parsed.path
        content_length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(content_length).decode("utf-8")
        data = {key: values[0] for key, values in parse_qs(body, keep_blank_values=True).items()}

        if path == "/signup":
            username = data.get("username", "").strip()
            email = data.get("email", "").strip()
            password = data.get("password", "").strip()

            if not username or not email or not password:
                self.send_html(read_template("signup.html", message="Please fill in all fields.", message_class="error"))
                return

            if create_user(username, email, password):
                self.send_html(read_template("login.html", message="Account created successfully. Please log in.", message_class="success"))
            else:
                self.send_html(read_template("signup.html", message="That username or email already exists.", message_class="error"))

        elif path == "/login":
            username_or_email = data.get("username_or_email", "").strip()
            password = data.get("password", "").strip()

            if not username_or_email or not password:
                self.send_html(read_template("login.html", message="Please enter both values.", message_class="error"))
                return

            user = verify_login(username_or_email, password)
            if user:
                self.send_response(303)
                self.send_header("Location", "/dashboard")
                self.send_header("Set-Cookie", f"user_id={user[0]}; Path=/; HttpOnly")
                self.send_header("Set-Cookie", f"username={user[1]}; Path=/; HttpOnly")
                self.end_headers()
            else:
                self.send_html(read_template("login.html", message="Invalid credentials. Try again.", message_class="error"))

        else:
            self.send_response(404)
            self.end_headers()

    def send_html(self, html: str) -> None:
        self.send_response(200)
        self.send_header("Content-type", "text/html; charset=utf-8")
        self.end_headers()
        self.wfile.write(html.encode("utf-8"))

    def redirect(self, location: str) -> None:
        self.send_response(303)
        self.send_header("Location", location)
        self.end_headers()


if __name__ == "__main__":
    init_db()
    server = ThreadingHTTPServer(("0.0.0.0", 8000), AuthHandler)
    print("Auth server running at http://127.0.0.1:8000")
    server.serve_forever()
