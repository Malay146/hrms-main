# Demo: AI Analytics

Login: `admin@odoo.com` / `admin@odoo@1234`

1. Open **AI Analytics** in the sidebar.
2. Read workforce health, attendance rate, leave load, and pending leave. These numbers come from People data, not a language model.
3. If `OPENAI_API_KEY` is set, click **Refresh insights** and confirm 3–6 cards cite real departments or counts.
4. Ask the copilot: `Who is on leave today?` Compare names with **People → Leave**.
5. Open **Leave**, find a pending Engineering row, click **Summarize**. The brief is advisory only.
6. Log out. Sign in as `priya.shah@odoo.com` / `Employee@1234` (payroll user). **AI Analytics** should be missing from the sidebar and `/admin/analytics` should redirect.
7. Sign in as `john.cena@odoo.com` / `Employee@1234`. They stay on `/employee` and cannot open Analytics.

Without an API key, steps 1–2, 4 (deterministic counts), 6, and 7 still work.
