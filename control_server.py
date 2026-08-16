#!/usr/bin/env python3
import http.server
import json
import subprocess
import os
import sys
import threading

PORT = 8490
ROOT = os.path.dirname(os.path.abspath(__file__))
START_SCRIPT = os.path.join(ROOT, "start.sh")

class ControlHandler(http.server.BaseHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        if self.path == "/api/control/status":
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            
            # Vérifie si le projet est considéré comme lancé (on regarde si des conteneurs tournent)
            try:
                res = subprocess.run(["docker", "compose", "-f", os.path.join(ROOT, "docker-compose.yml"), "ps", "--format", "json"], capture_output=True, text=True)
                containers = json.loads(res.stdout or "[]")
                is_running = len(containers) > 0
            except Exception:
                is_running = False
                
            self.wfile.write(json.dumps({"running": is_running}).encode())
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        if self.path in ["/api/control/start", "/api/control/stop", "/api/control/restart"]:
            action = self.path.split("/")[-1]
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"status": "accepted", "action": action}).encode())
            
            # Exécuter l'action en tâche de fond pour ne pas bloquer la requête HTTP
            threading.Thread(target=self.run_action, args=(action,)).start()
        else:
            self.send_response(404)
            self.end_headers()

    def run_action(self, action):
        print(f"[CONTROL] Exécution de l'action : {action}...", flush=True)
        try:
            if action == "start":
                subprocess.Popen(["bash", START_SCRIPT], cwd=ROOT)
            elif action == "stop":
                subprocess.Popen(["bash", START_SCRIPT, "stop"], cwd=ROOT)
            elif action == "restart":
                subprocess.Popen(["bash", START_SCRIPT, "restart"], cwd=ROOT)
        except Exception as e:
            print(f"[CONTROL] Erreur lors de l'exécution de {action} : {e}", flush=True)

def run():
    server_address = ('0.0.0.0', PORT)
    httpd = http.server.HTTPServer(server_address, ControlHandler)
    print(f"[CONTROL] Serveur de contrôle actif sur le port {PORT}", flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    print("[CONTROL] Serveur de contrôle arrêté.", flush=True)

if __name__ == '__main__':
    run()
