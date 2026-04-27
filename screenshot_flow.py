"""Screenshot the full game flow."""
from playwright.sync_api import sync_playwright
from pathlib import Path
import time

OUT_DIR = Path(r"C:\Users\alan0\Desktop\Projects\kurdish-imposter-app")
URL = "http://localhost:8081"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(
        viewport={"width": 390, "height": 844},
        device_scale_factor=2,
    )
    page = ctx.new_page()
    page.goto(URL, wait_until="networkidle", timeout=60000)
    page.wait_for_timeout(2500)

    page.screenshot(path=str(OUT_DIR / "preview_1_home.png"))
    print("1/5 home")

    # Click NEW GAME button (by visible Kurdish text)
    page.get_by_text("یاری نوێ").first.click()
    page.wait_for_timeout(1000)
    page.screenshot(path=str(OUT_DIR / "preview_2_setup.png"))
    print("2/5 setup")

    # Click START
    page.get_by_text("دەستپێکردن").first.click()
    page.wait_for_timeout(1000)
    page.screenshot(path=str(OUT_DIR / "preview_3_deal_pass.png"))
    print("3/5 deal-pass")

    # Click "I'M READY — SHOW MY WORD"
    page.get_by_text("ئامادەم").first.click()
    page.wait_for_timeout(1000)
    page.screenshot(path=str(OUT_DIR / "preview_4_deal_reveal.png"))
    print("4/5 deal-reveal (Player 1's word)")

    # Advance through all players to reach discussion
    for _ in range(10):
        try:
            # "تەواو" (done) or "دەستپێکردنی گفتوگۆ" (start discussion)
            btn = page.get_by_text("تەواو").first
            if btn.count() == 0:
                page.get_by_text("دەستپێکردنی گفتوگۆ").first.click()
                break
            btn.click()
            page.wait_for_timeout(400)
            # pass screen
            if page.get_by_text("ئامادەم").count() > 0:
                page.get_by_text("ئامادەم").first.click()
                page.wait_for_timeout(400)
        except Exception as e:
            print(f"advance err: {e}")
            break

    page.wait_for_timeout(1000)
    page.screenshot(path=str(OUT_DIR / "preview_5_discuss.png"))
    print("5/5 discuss")

    browser.close()
