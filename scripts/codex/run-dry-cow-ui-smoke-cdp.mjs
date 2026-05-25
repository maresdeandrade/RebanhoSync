import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";

const APP_URL = process.env.APP_URL ?? "http://127.0.0.1:8080";
const EMAIL = process.env.UI_SMOKE_EMAIL;
const PASSWORD = process.env.UI_SMOKE_PASSWORD;
const FARM_NAME = process.env.UI_SMOKE_FARM_NAME ?? "Fazenda Smoke Vaca Seca";
const FARM_ID = process.env.UI_SMOKE_FARM_ID;
const CDP_PORT = Number(process.env.CDP_PORT ?? "9223");

if (!EMAIL || !PASSWORD) {
  throw new Error("Defina UI_SMOKE_EMAIL e UI_SMOKE_PASSWORD para executar o smoke.");
}

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  ].filter(Boolean);

  const chrome = candidates.find((candidate) => fs.existsSync(candidate));
  if (!chrome) throw new Error("Chrome/Edge nao encontrado para smoke CDP.");
  return chrome;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
  return response.json();
}

class CdpSocket {
  constructor(wsUrl) {
    this.url = new URL(wsUrl);
    this.socket = null;
    this.buffer = Buffer.alloc(0);
    this.nextId = 1;
    this.pending = new Map();
    this.consoleMessages = [];
  }

  async connect() {
    this.socket = net.createConnection({
      host: this.url.hostname,
      port: Number(this.url.port),
    });
    await new Promise((resolve, reject) => {
      this.socket.once("connect", resolve);
      this.socket.once("error", reject);
    });

    const key = crypto.randomBytes(16).toString("base64");
    const request = [
      `GET ${this.url.pathname}${this.url.search} HTTP/1.1`,
      `Host: ${this.url.host}`,
      "Upgrade: websocket",
      "Connection: Upgrade",
      `Sec-WebSocket-Key: ${key}`,
      "Sec-WebSocket-Version: 13",
      "",
      "",
    ].join("\r\n");
    this.socket.write(request);

    await new Promise((resolve, reject) => {
      let handshake = Buffer.alloc(0);
      const onData = (chunk) => {
        handshake = Buffer.concat([handshake, chunk]);
        const marker = handshake.indexOf("\r\n\r\n");
        if (marker < 0) return;

        this.socket.off("data", onData);
        const head = handshake.slice(0, marker).toString("utf8");
        if (!head.includes(" 101 ")) {
          reject(new Error(`websocket handshake failed: ${head}`));
          return;
        }

        const rest = handshake.slice(marker + 4);
        if (rest.length) this.handleData(rest);
        this.socket.on("data", (data) => this.handleData(data));
        resolve();
      };
      this.socket.on("data", onData);
      this.socket.once("error", reject);
    });
  }

  handleData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (this.buffer.length >= 2) {
      const b1 = this.buffer[0];
      const b2 = this.buffer[1];
      const opcode = b1 & 0x0f;
      const masked = (b2 & 0x80) !== 0;
      let length = b2 & 0x7f;
      let offset = 2;

      if (length === 126) {
        if (this.buffer.length < offset + 2) return;
        length = this.buffer.readUInt16BE(offset);
        offset += 2;
      } else if (length === 127) {
        if (this.buffer.length < offset + 8) return;
        length =
          this.buffer.readUInt32BE(offset) * 2 ** 32 +
          this.buffer.readUInt32BE(offset + 4);
        offset += 8;
      }

      let mask = null;
      if (masked) {
        if (this.buffer.length < offset + 4) return;
        mask = this.buffer.slice(offset, offset + 4);
        offset += 4;
      }
      if (this.buffer.length < offset + length) return;

      const payload = this.buffer.slice(offset, offset + length);
      this.buffer = this.buffer.slice(offset + length);
      if (masked && mask) {
        for (let i = 0; i < payload.length; i += 1) payload[i] ^= mask[i % 4];
      }
      if (opcode === 1) this.handleMessage(payload.toString("utf8"));
    }
  }

  handleMessage(text) {
    const message = JSON.parse(text);
    if (message.method === "Runtime.consoleAPICalled") {
      this.consoleMessages.push(
        (message.params?.args ?? [])
          .map((arg) => arg.value ?? arg.description ?? "")
          .join(" "),
      );
      this.consoleMessages = this.consoleMessages.slice(-20);
    }
    if (!message.id || !this.pending.has(message.id)) return;
    const waiter = this.pending.get(message.id);
    this.pending.delete(message.id);
    if (message.error) waiter.reject(new Error(JSON.stringify(message.error)));
    else waiter.resolve(message.result ?? {});
  }

  send(method, params = {}) {
    const id = this.nextId;
    this.nextId += 1;
    const payload = Buffer.from(JSON.stringify({ id, method, params }), "utf8");
    const header =
      payload.length < 126
        ? Buffer.from([0x81, 0x80 | payload.length])
        : Buffer.from([0x81, 0x80 | 126, payload.length >> 8, payload.length & 0xff]);
    const mask = crypto.randomBytes(4);
    const maskedPayload = Buffer.from(payload);
    for (let i = 0; i < maskedPayload.length; i += 1) {
      maskedPayload[i] ^= mask[i % 4];
    }
    this.socket.write(Buffer.concat([header, mask, maskedPayload]));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }

  close() {
    this.socket?.end();
  }
}

async function evaluate(cdp, expression) {
  const result = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(JSON.stringify(result.exceptionDetails));
  }
  return result.result?.value;
}

async function waitFor(cdp, body, timeoutMs = 30_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      if (await evaluate(cdp, `Boolean((() => { ${body} })())`)) return;
    } catch {
      // Continue polling while the app is loading.
    }
    await wait(500);
  }

  const text = await evaluate(
    cdp,
    "document.body ? document.body.innerText.slice(0, 3000) : ''",
  );
  const debug = await evaluate(
    cdp,
    `(() => ({
      href: location.href,
      activeFarm: localStorage.getItem('gestao_agro_active_fazenda_id'),
      authKeys: Object.keys(localStorage).filter((key) => key.includes('auth-token') || key.includes('supabase')).slice(0, 10)
    }))()`,
  );
  throw new Error(
    `timeout aguardando: ${body}\n${JSON.stringify(debug)}\nconsole=${JSON.stringify(cdp.consoleMessages)}\n${text}`,
  );
}

async function main() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "dry-cow-ui-smoke-"));
  const chrome = spawn(
    findChrome(),
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=${profile}`,
      "about:blank",
    ],
    { detached: false, stdio: "ignore" },
  );

  try {
    await wait(2500);
    const target = await fetchJson(
      `http://127.0.0.1:${CDP_PORT}/json/new?${encodeURIComponent(`${APP_URL}/login`)}`,
      { method: "PUT" },
    );
    const cdp = new CdpSocket(target.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");

    await waitFor(
      cdp,
      "return document.querySelector('#email') && document.querySelector('#password');",
      20_000,
    );
    await evaluate(
      cdp,
      `(() => {
        function setValue(selector, value) {
          const el = document.querySelector(selector);
          const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set;
          setter.call(el, value);
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
        setValue('#email', ${JSON.stringify(EMAIL)});
        setValue('#password', ${JSON.stringify(PASSWORD)});
        document.querySelector('form button[type="submit"]').click();
      })()`,
    );
    await waitFor(
      cdp,
      "return location.pathname === '/home' || location.pathname === '/select-fazenda';",
      45_000,
    );
    if (FARM_ID) {
      await evaluate(
        cdp,
        `localStorage.setItem('gestao_agro_active_fazenda_id', ${JSON.stringify(FARM_ID)})`,
      );
      await cdp.send("Page.reload", { ignoreCache: true });
      await waitFor(
        cdp,
        "return location.pathname === '/home' || location.pathname === '/select-fazenda';",
        45_000,
      );
    } else if (
      (await evaluate(cdp, "location.pathname === '/select-fazenda'")) === true
    ) {
      await waitFor(
        cdp,
        `return [...document.querySelectorAll('button')].some((item) => item.innerText.includes(${JSON.stringify(FARM_NAME)}));`,
        20_000,
      );
      await evaluate(
        cdp,
        `(() => {
          const button = [...document.querySelectorAll('button')]
            .find((item) => item.innerText.includes(${JSON.stringify(FARM_NAME)}));
          if (!button) throw new Error('fazenda de smoke nao encontrada');
          button.click();
        })()`,
      );
      await waitFor(cdp, "return location.pathname === '/home';", 30_000);
      await waitFor(
        cdp,
        "return localStorage.getItem('gestao_agro_active_fazenda_id');",
        10_000,
      );
    }
    await cdp.send("Page.navigate", { url: `${APP_URL}/protocolos-sanitarios` });
    await waitFor(
      cdp,
      "return document.body && document.body.innerText.includes('Antibiotico Intramamario (Vaca Seca)') && !document.body.innerText.includes('Atualizando');",
      45_000,
    );

    const before = await evaluate(
      cdp,
      `(() => {
        const text = document.body.innerText;
        return {
          hasBadge: text.includes('Exposicao controlada'),
          hasActivate: text.includes('Ativar agenda de Vaca Seca'),
          hasDeactivate: text.includes('Desativar agenda de Vaca Seca'),
          hasNoAgenda: text.includes('Sem agenda')
        };
      })()`,
    );
    if (!before.hasBadge || !before.hasActivate || before.hasDeactivate || !before.hasNoAgenda) {
      const text = await evaluate(
        cdp,
        "document.body ? document.body.innerText.slice(0, 3000) : ''",
      );
      throw new Error(`estado inicial inesperado: ${JSON.stringify(before)}\n${text}`);
    }

    await evaluate(
      cdp,
      `(() => {
        const button = [...document.querySelectorAll('button')]
          .find((item) => item.innerText.includes('Ativar agenda de Vaca Seca'));
        if (!button) throw new Error('botao de ativacao nao encontrado');
        button.click();
      })()`,
    );
    await waitFor(
      cdp,
      "return document.body.innerText.includes('Desativar agenda de Vaca Seca') && document.body.innerText.includes('Gera agenda');",
      30_000,
    );
    const after = await evaluate(
      cdp,
      `(() => {
        const text = document.body.innerText;
        return {
          hasBadge: text.includes('Exposicao controlada'),
          hasActivate: text.includes('Ativar agenda de Vaca Seca'),
          hasDeactivate: text.includes('Desativar agenda de Vaca Seca'),
          hasGeneratesAgenda: text.includes('Gera agenda'),
          toastSuccess: text.includes('Agenda de Vaca Seca ativada no protocolo da fazenda.')
        };
      })()`,
    );
    const screenshot = await cdp.send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: true,
    });
    const screenshotPath = path.join(
      process.cwd(),
      "tmp",
      "dry-cow-ui-smoke.png",
    );
    fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
    fs.writeFileSync(screenshotPath, Buffer.from(screenshot.data, "base64"));
    cdp.close();

    console.log(JSON.stringify({ before, after, screenshotPath }, null, 2));
  } finally {
    chrome.kill();
    try {
      fs.rmSync(profile, { recursive: true, force: true });
    } catch {
      // Chrome can keep Crashpad files locked briefly after process shutdown.
    }
  }
}

main().catch((error) => {
  console.error(`Falha no smoke UI Vaca Seca: ${error.message}`);
  process.exit(1);
});
