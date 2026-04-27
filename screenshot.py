"""Screenshot the running Expo web app at mobile viewport size."""
from playwright.sync_api import sync_playwright
from pathlib import Path

OUT = Path(r"C:\Users\alan0\Desktop\Projects\kurdish-imposter-app\preview.png")
URL = "http://localhost:8081"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(
        viewport={"width": 390, "height": 844},
        device_scale_factor=2,
    )
    page = ctx.new_page()
    page.goto(URL, wait_until="networkidle", timeout=60000)
    page.wait_for_timeout(3000)  # let fonts/assets paint
    page.screenshot(path=str(OUT), full_page=False)
    browser.close()
print(f"[ok] {OUT}")
