"""Capture reveal_win specifically by playing through and trying every seat
until we vote the actual imposter."""
from playwright.sync_api import sync_playwright
from pathlib import Path

OUT_DIR = Path(r"C:\Users\alan0\Desktop\Projects\kurdish-imposter-app")
URL = "http://127.0.0.1:9123"


def wait(page, ms=600):
    page.wait_for_timeout(ms)


def click_text(page, *texts, timeout=3000):
    for t in texts:
        try:
            page.get_by_text(t, exact=False).first.click(timeout=timeout)
            return True
        except Exception:
            continue
    return False


def play_round_capture_imposter_seat(page):
    """Click through deal phase, return seat-index (1..N) of the imposter."""
    imposter_seat = None
    seat = 1
    # First seat: page is on pass screen
    while True:
        # Pass screen → click "Tap when ready"
        ok = click_text(page, "Tap when ready")
        wait(page, 500)
        if not ok:
            break
        # Now on reveal — check if imposter
        body = page.evaluate("() => document.body.innerText")
        if "You are the Imposter" in body:
            imposter_seat = seat
        # Advance
        ok = click_text(page, "Got it, next player", "Start Discussion")
        wait(page, 500)
        if not ok:
            break
        # If we just clicked Start Discussion, we'll soon be on discuss
        if "Time remaining" in page.evaluate("() => document.body.innerText"):
            break
        seat += 1
    return imposter_seat


def vote_seat(page, n):
    try:
        page.get_by_text(f"Player {n}").first.click()
        wait(page, 300)
    except Exception:
        return False
    return click_text(page, "Lock in vote")


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(viewport={"width": 392, "height": 812}, device_scale_factor=2)
        page = ctx.new_page()

        # set EN
        page.goto(URL, wait_until="networkidle", timeout=60000)
        page.evaluate("() => localStorage.setItem('app.locale.v1', 'en')")
        page.goto(URL, wait_until="networkidle", timeout=60000)
        wait(page, 1000)

        # try multiple games until we win
        for attempt in range(8):
            print(f"attempt {attempt + 1}")
            # Reset to home if not there
            body = page.evaluate("() => document.body.innerText")
            if "Imposter" in body and "New Game" in body and "Find the bluffer" in body:
                pass
            else:
                # navigate home
                page.goto(URL, wait_until="networkidle", timeout=60000)
                wait(page, 800)
            click_text(page, "New Game")
            wait(page, 800)
            click_text(page, "Start Game")
            wait(page, 800)
            imposter_seat = play_round_capture_imposter_seat(page)
            print(f"  imposter is seat {imposter_seat}")
            if imposter_seat is None:
                continue

            # Wait until we're on Discuss
            wait(page, 800)
            click_text(page, "Vote now")
            wait(page, 800)
            ok = vote_seat(page, imposter_seat)
            wait(page, 1200)
            body = page.evaluate("() => document.body.innerText")
            if "Group caught" in body or "Group Wins" in body:
                page.screenshot(path=str(OUT_DIR / "preview_v2_reveal_win.png"))
                print("  saved preview_v2_reveal_win.png")
                browser.close()
                return
            else:
                # Wrong outcome — replay
                click_text(page, "Play again")
                wait(page, 1000)

        print("FAILED to capture reveal_win after 8 attempts")
        browser.close()


if __name__ == "__main__":
    main()
