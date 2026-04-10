
import os

file_path = r"c:\Users\ASUS\.gemini\antigravity\playground\golden-cluster\frontend\src\app\features\client-management\fiches\monture-form\monture-form.component.html"

try:
    with open(file_path, 'rb') as f:
        f.seek(-500, 2)
        tail = f.read()
        print(tail)
except Exception as e:
    print(e)
