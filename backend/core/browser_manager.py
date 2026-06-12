from playwright.async_api import async_playwright, Browser

class PlaywrightManager:
    def __init__(self):
        self.playwright = None
        self.browser = None

    async def start(self):
        if not self.playwright:
            self.playwright = await async_playwright().start()
            # Launch Chromium with args to disable CORS and allow mixed content
            self.browser = await self.playwright.chromium.launch(
                headless=True,
                args=[
                    "--disable-web-security",
                    "--allow-running-insecure-content",
                    "--disable-site-isolation-trials"
                ]
            )

    async def stop(self):
        if self.browser:
            await self.browser.close()
        if self.playwright:
            await self.playwright.stop()

pw_manager = PlaywrightManager()
