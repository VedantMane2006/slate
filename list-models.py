import urllib.request
import json
import re

with open('.env', 'r') as f:
    env_content = f.read()

match = re.search(r'VITE_GEMINI_API_KEY=(.*)', env_content)
if not match:
    print("No key found")
    exit(1)

key = match.group(1).strip()
url = f"https://generativelanguage.googleapis.com/v1beta/models?key={key}"

try:
    req = urllib.request.urlopen(url)
    data = json.loads(req.read().decode())
    print(json.dumps([m['name'] for m in data.get('models', [])], indent=2))
except Exception as e:
    print(e)
