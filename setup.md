# Setup and usage

[Back to Briefly](README.md)

A separate, local Perplexity-style research app: ask a question, search the web, read a few pages, and synthesize a short answer with numbered citations using your own model.

## Start

Requires Python 3.10+ and the DDGS search library. After cloning, open a terminal in the folder containing `server.py` and `requirements.txt`. Create an isolated environment once:

```powershell
# Windows
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt
.venv/Scripts/python server.py
```

```bash
# macOS
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python server.py
```

Open `http://localhost:8766`. These commands listen only on your machine. For LAN access, add `--host 0.0.0.0` to the server command, use `http://HOST_LAN_IP:8766` from another device, and allow that port through the private-network firewall if needed.

On first launch, Briefly generates a random access key and prints it in the terminal. Paste **your own generated key** into the app. It is saved in `data/access.key` and reused on later launches. You do not need a key from the repository author. The entire `data/` folder is excluded from Git, so a fresh clone gets its own key and empty history. The browser keeps the entered key only for that browser session. `BRIEFLY_TOKEN` can override the key (minimum 16 characters).

The access key is a shared workspace password, not a provider API key. Anyone with the key can view chats, change settings and use the connected model. It does not encrypt HTTP traffic or create separate user accounts.

Use the top-left chats toggle to show or hide the sidebar. Each chat has a **…** menu with **Delete chat**; an **Undo** action appears for 15 seconds. Deletion hides the chat from history and normal retrieval, retaining its database record for recovery rather than permanently erasing it. A chat cannot be deleted while its answer is still generating.

## Connect a model

On Windows, run `geniex serve` in the terminal where GenieX is installed. The default app settings are:

- Runtime: **GenieX**
- URL: `http://127.0.0.1:18181/v1`
- Model: `ai-hub-models/Qwen3-4B-Instruct-2507`

For your Mac model, choose **Ollama**, enter `http://MAC_LAN_IP:11434`, and use the exact model name shown by `ollama list`. When Briefly runs on the Mac itself, the Ollama URL can be `http://127.0.0.1:11434`.

If the Ollama macOS app must be reached from Windows, run `launchctl setenv OLLAMA_HOST "0.0.0.0:11434"` on the Mac and restart Ollama. Allow connections on port 11434 on your private network if needed. For the CLI server instead, use `OLLAMA_HOST=0.0.0.0:11434 ollama serve`.

**Check model** fetches available model names without inference. The generic OpenAI-compatible option supports servers that do not require an API key. All model requests originate from the Briefly server, not the device displaying the app.

## What happens per question

1. Check the model API is reachable, then search using DDGS with Google, Brave and Bing backends (up to three providers, sequentially). No paid search key is required. Reject results that only match one fragment of a multi-term question.
2. Fetch up to three result pages (configurable from two to five), in sequence, without running page JavaScript or opening browser windows.
3. Remove navigation, scripts and other irrelevant HTML, then select relevant paragraphs within an approximately 4,200-character total page-excerpt budget. No embedding model or extra LLM calls.
4. Send those excerpts and the question to the selected local model once. Default output budget is 320 tokens and at most 160 words.
5. Show the answer, numbered source links, fetched excerpts and any retrieval problems. Save the question and answer locally.

Only one research request runs at a time in this app. There are no background jobs, scheduled requests, recursive searches or automatic model retries. Search can try another configured provider when one fails. The browser polls the job status during research; polling does not perform searches or inference. Use Ctrl+Enter / Cmd+Enter to submit a question.

Ollama is asked to disable thinking and unload after the reply; GenieX is sent `enable_think: false`. Individual model versions may vary in support. The model's total compute usage depends on its runtime and hardware.

## Evidence and limitations

- A **Page read** badge means HTML/text was fetched and an excerpt supplied to the model. A **Search snippet** badge means the page was blocked, unreadable, or unsupported; only the search result description was supplied. Sources remain visible even if the model is offline.
- Search ranking and the selected excerpt can miss important context. The app does not independently fact-check the model's answer. Citations point to supplied evidence; they do not guarantee a claim is supported. Invalid citation numbers are removed and flagged; missing citations are flagged.
- The app uses ordinary HTTP page retrieval, not a full browser. It does not bypass CAPTCHAs, paywalls or sign-in, and does not parse PDFs or run JavaScript-heavy pages. These sources may fall back to snippets.
- Public search endpoints may throttle requests or change format. A failed search displays an error rather than fabricating an answer. Search functionality is isolated in `search_web()` to make a future search-provider replacement straightforward.
- Queries go to the configured external search providers; source websites receive page requests. Only synthesis runs on your configured local model. No cloud AI service is used by this app.
- Page downloads are capped at 1 MB, five redirects and a 15-second network-read budget (system DNS resolution can take longer). Public source addresses are DNS-checked and pinned, including on redirects, to reject private/local targets. Configured model URLs can reach your LAN intentionally.
- Internet content is treated as evidence, not executable instructions. The app does not execute generated code, shell commands, model tools, or page scripts. Plain text rendering avoids injecting model HTML into the interface.
- Briefly and The Common Room have separate request locks. If both use the same model server simultaneously, that server may receive a request from each. Pause The Common Room while researching if you want only one generation across both apps.
- A model timeout does not prove the remote model has stopped. Check its server before retrying.

## Storage and portability

Settings, questions, sources and answers live in `data/research.sqlite3`. The sidebar shows the 40 most recent questions; older records stay in the database. The data and virtual environment directories are ignored by Git. Stop the app before copying the repository and its data folder to the Mac; recreate the virtual environment there rather than copying the Windows one, and update model URLs for the new host. Interrupted jobs are marked as interrupted at restart and never resumed automatically.

This is a trusted-LAN app using HTTP. The access key protects application routes; HTTP is not encrypted. Do not expose it or your unauthenticated model server through public port forwarding.

## Tests

```bash
python -m unittest discover -v
node --check web/app.js
```

Automated tests use temporary databases and simulated model servers. They cover HTML extraction, context limits, unsafe source addresses and redirects, search parsing, model adapter payloads, citation handling, persistence, single-request execution, error recovery and authentication.

References: [GenieX server API](https://github.com/qualcomm/GenieX/blob/main/docs/en/run/cli/local-server.mdx), [Ollama chat API](https://docs.ollama.com/api/chat), [Ollama server configuration](https://docs.ollama.com/faq).

