"""Screenshot the v2 redesigned game flow.

Captures: home (KU/AR/EN), setup, deal-pass, deal-reveal-crewmate,
deal-reveal-imposter, discuss, vote, reveal-win, reveal-lose.

Strategy:
  - We can't deterministically force a player to be the imposter via UI alone
    (the game randomizes assignments). To capture both reveal variants we
    inject AsyncStorage / direct state via page.evaluate where possible,
    OR we cycle reveals until we observe the imposter screen.
  - For win/lose at game end we vote different seats and check which screen
    we land on.
"""
from playwright.sync_api import sync_playwright
from pathlib import Path
import time

OUT_DIR = Path(r"C:\Users\alan0\Desktop\Projects\kurdish-imposter-app")
URL = "http://127.0.0.1:9123"


def wait(page, ms=600):
    page.wait_for_timeout(ms)


def shot(page, name):
    p = OUT_DIR / f"preview_v2_{name}.png"
    page.screenshot(path=str(p))
    print(f"  saved {p.name}")


def set_locale_via_storage(page, locale):
    """Bypass UI by setting AsyncStorage/localStorage directly. AsyncStorage
    on web maps to localStorage with a specific key prefix."""
    page.evaluate(
        f"""() => {{
            try {{ localStorage.setItem('app.locale.v1', '{locale}'); }} catch(e) {{}}
            try {{ localStorage.setItem('@AsyncStorage:app.locale.v1', '{locale}'); }} catch(e) {{}}
        }}"""
    )


def click_text(page, *texts, timeout=4000):
    """Try each candidate text until one is clickable."""
    for t in texts:
        try:
            loc = page.get_by_text(t, exact=False).first
            loc.click(timeout=timeout)
            return True
        except Exception:
            continue
    return False


def home_for_lang(page, lang):
    """Force a language by setting storage, then reload."""
    set_locale_via_storage(page, lang)
    page.goto(URL, wait_until="networkidle", timeout=60000)
    wait(page, 1500)
    shot(page, f"home_{lang}")


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(
            viewport={"width": 392, "height": 812},
            device_scale_factor=2,
        )
        page = ctx.new_page()

        page.goto(URL, wait_until="networkidle", timeout=60000)
        wait(page, 1500)

        # Home — KU
        print("home_ku")
        home_for_lang(page, "ku")

        # Home — AR
        print("home_ar")
        home_for_lang(page, "ar")

        # Home — EN
        print("home_en")
        home_for_lang(page, "en")

        # From EN home, go to setup
        print("setup")
        click_text(page, "New Game")
        wait(page, 1200)
        shot(page, "setup")

        # Start game
        print("deal-pass")
        click_text(page, "Start Game")
        wait(page, 1200)
        shot(page, "deal_pass")

        # Reveal first player — could be imposter or crewmate. Capture both
        # by walking forward.
        print("deal-reveal (first walk)")
        click_text(page, "Tap when ready")
        wait(page, 1000)
        shot(page, "deal_reveal_first")

        # Heuristic: if "You are the Imposter" text is visible, we have imposter
        body_text = page.evaluate("() => document.body.innerText")
        is_imposter = "You are the Imposter" in body_text or "Imposter" in body_text and "Bluff" in body_text

        # Save current as crewmate or imposter accordingly
        if is_imposter:
            print("  -> imposter visible; saving deal_reveal_imposter")
            shot(page, "deal_reveal_imposter")
        else:
            print("  -> crewmate visible; saving deal_reveal_crewmate")
            shot(page, "deal_reveal_crewmate")

        # Walk through remaining seats to find the other variant.
        # 5 players default + however many we set = up to 14 cycles.
        captured_other = False
        for cycle in range(14):
            # Click next-player or start-discussion
            ok = click_text(page, "Got it, next player", "Start Discussion")
            wait(page, 800)
            if not ok:
                break
            # Pass screen?
            ok = click_text(page, "Tap when ready")
            wait(page, 800)
            if not ok:
                # We hit discuss screen
                break
            body_text = page.evaluate("() => document.body.innerText")
            new_is_imposter = "You are the Imposter" in body_text
            if new_is_imposter and not is_imposter and not captured_other:
                print("  -> found imposter on cycle", cycle + 1)
                shot(page, "deal_reveal_imposter")
                captured_other = True
            elif (not new_is_imposter) and is_imposter and not captured_other:
                print("  -> found crewmate on cycle", cycle + 1)
                shot(page, "deal_reveal_crewmate")
                captured_other = True

        # Try to advance to discuss
        click_text(page, "Got it, next player", "Start Discussion")
        wait(page, 1000)
        click_text(page, "Tap when ready")
        wait(page, 800)
        click_text(page, "Got it, next player", "Start Discussion")
        wait(page, 1000)

        # Discuss
        print("discuss")
        # might still be on a reveal — try Start Discussion repeatedly
        for _ in range(8):
            body_text = page.evaluate("() => document.body.innerText")
            if "Time remaining" in body_text or "Vote now" in body_text:
                break
            click_text(page, "Start Discussion", "Got it, next player", "Tap when ready")
            wait(page, 600)
        shot(page, "discuss")

        # Vote
        print("vote")
        click_text(page, "Vote now")
        wait(page, 1000)
        shot(page, "vote")

        # Pick first player (Player 1) and confirm
        try:
            page.get_by_text("Player 1").first.click()
            wait(page, 400)
        except Exception:
            pass
        click_text(page, "Lock in vote")
        wait(page, 1200)

        # Reveal — capture, check which side won
        print("reveal")
        body_text = page.evaluate("() => document.body.innerText")
        if "Group caught" in body_text or "Group Wins" in body_text:
            shot(page, "reveal_win")
            won_first = "win"
        else:
            shot(page, "reveal_lose")
            won_first = "lose"
        print(f"  first reveal was: {won_first}")

        # Play again to try the OTHER variant
        click_text(page, "Play again")
        wait(page, 1500)
        # Walk through the deal phase quickly
        for _ in range(20):
            body_text = page.evaluate("() => document.body.innerText")
            if "Time remaining" in body_text:
                break
            ok = click_text(page, "Tap when ready", "Got it, next player", "Start Discussion")
            wait(page, 500)
            if not ok:
                break
        click_text(page, "Vote now")
        wait(page, 800)
        # Try a different seat this time — pick Player 2
        try:
            page.get_by_text("Player 2").first.click()
            wait(page, 400)
        except Exception:
            pass
        click_text(page, "Lock in vote")
        wait(page, 1200)
        body_text = page.evaluate("() => document.body.innerText")
        if "Group caught" in body_text or "Group Wins" in body_text:
            if won_first != "win":
                shot(page, "reveal_win")
                print("  captured reveal_win on retry")
        else:
            if won_first != "lose":
                shot(page, "reveal_lose")
                print("  captured reveal_lose on retry")

        browser.close()
    print("done")


if __name__ == "__main__":
    main()
