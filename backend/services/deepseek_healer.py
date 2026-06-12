import httpx
import re
from typing import Optional

DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions"

SYSTEM_PROMPT = "You are a CSS/XPath selector repair expert. Given a broken selector, the action type, and page HTML context, suggest a corrected selector. Respond with ONLY the corrected selector — no explanation, no markdown."

async def heal_selector(
    api_key: str,
    broken_selector: str,
    action_type: str,
    page,
) -> Optional[str]:
    page_context = await page.evaluate("""
    () => {
        try {
            let el = document.body;
            if (!el) return '';
            let clone = el.cloneNode(true);
            clone.querySelectorAll('script, style, link, meta, noscript, svg, path, iframe').forEach(n => n.remove());
            let html = clone.innerHTML.substring(0, 6000);
            return html;
        } catch(e) { return ''; }
    }
    """)

    prompt = (
        f"A web scraper failed. The broken selector is: \"{broken_selector}\"\n"
        f"The action being performed: {action_type}\n\n"
        f"Page HTML context (simplified):\n{page_context[:6000]}\n\n"
        "Suggest a corrected CSS selector. Rules:\n"
        "1. Prefer CSS selectors over XPath\n"
        "2. If the element likely changed classes/IDs, use attribute selectors or nth-child\n"
        "3. Use parent/sibling relationships for robustness\n"
        "4. For text-based elements, consider :contains() or attribute-contains selectors\n"
        "5. Respond with ONLY the corrected selector"
    )

    async with httpx.AsyncClient(timeout=30) as client:
        try:
            response = await client.post(
                DEEPSEEK_API_URL,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "deepseek-chat",
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": prompt},
                    ],
                    "temperature": 0.1,
                    "max_tokens": 150,
                },
            )
            response.raise_for_status()
            data = response.json()
            healed = data["choices"][0]["message"]["content"].strip()
            healed = re.sub(r'^```(?:css|xpath)?\s*', '', healed)
            healed = re.sub(r'\s*```$', '', healed)
            healed = healed.strip().strip("'").strip('"')
            if healed and healed != broken_selector:
                return healed
        except Exception as e:
            print(f"[DeepSeek] Healing failed: {e}")
    return None
