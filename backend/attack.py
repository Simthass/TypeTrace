import pyautogui
import time
import random

# The AI-generated essay the hacker wants to submit
fake_essay = """The rapid advancement of artificial intelligence has fundamentally altered the landscape of cybersecurity. Traditional heuristic models are increasingly vulnerable to sophisticated evasion techniques. In response, modern biometric systems must leverage ensemble machine learning to analyze behavioral entropy rather than relying solely on deterministic rules."""

print("🚨 ATTACK SCRIPT ARMED.")
print("You have 5 seconds to click inside your React Editor text box...")
time.sleep(5)

print("💻 Executing Mechanical Auto-Type Attack...")

for char in fake_essay:
    pyautogui.write(char)
    # The hacker tries to mimic human speed by typing at ~80 WPM
    # But notice: the delay is perfectly uniform. No variance.
    time.sleep(0.12) 

print("✅ Attack complete. Click 'End & Analyse'.")