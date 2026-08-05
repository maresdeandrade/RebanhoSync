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
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);
const COMMAND_TIMEOUT_MS = 15_000;

if (!EMAIL || !PASSWORD) {
  throw new Error("Defina UI_SMOKE_EMAIL e UI_SMOKE_PASSWORD para executar o smoke.");
}
if (!Number.isInteger(CDP_PORT) || CDP_PORT < 1024 || CDP_PORT > 65535) {
  throw new Error("CDP_PORT deve ser uma porta inteira entre 1024 e 65535.");
}

const appUrl = new URL(APP_URL);
if (!["http:", "https:"].includes(appUrl.protocol) || !LOCAL_HOSTS.has(appUrl.hostname)) {
  throw new Error(`Smoke UI bloqueado fora do app local: ${appUrl.origin}`);
}
if (appUrl.username || appUrl.password) {
  throw new Error("APP_URL nao pode conter credenciais.");
}

function appPath(pathname) {
  return new URL(pathname, `${appUrl.origin}/`).toString();
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
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  const response = await fetch(url, { ...options, signal: controller.signal }).finally(() => {
    clearTimeout(timer);
  });
  if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
  return response.json();
}

async function assertPortAvailable(port) {
  await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once("error", (error) => reject(new Error(`CDP_PORT ${port} indisponivel: ${error.message}`)));
    server.listen({ host: "127.0.0.1", port }, () => server.close(resolve));
  });
}

async function waitForCdp(port, timeoutMs = 20_000) {
  const start = Date.now();
  let lastError;
  while (Date.now() - start < timeoutMs) {
    try {
      return await fetchJson(`http://127.0.0.1:${port}/json/version`);
    } catch (error) {
      lastError = error;
      await wait(250);
    }
  }
  throw new Error(`Chrome nao abriu CDP na porta ${port}: ${lastError?.message ?? "timeout"}`);
}

class CdpSocket {
  constructor(wsUrl) {
    this.url = new URL(wsUrl);
    this.socket = null;
    this.buffer = Buffer.alloc(0);
    this.nextId = 1;
    this.pending = new Map();
    this.consoleMessages = [];
    this.pageErrors = [];
    this.fragmentOpcode = null;
    this.fragmentBuffers = [];
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
        this.socket.on("error", (error) => this.rejectPending(error));
        this.socket.on("close", () => this.rejectPending(new Error("Conexao CDP encerrada")));
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
      const finalFrame = (b1 & 0x80) !== 0;
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
      if (opcode === 1 || opcode === 2) {
        if (finalFrame) {
          if (opcode === 1) this.handleMessage(payload.toString("utf8"));
        } else {
          this.fragmentOpcode = opcode;
          this.fragmentBuffers = [payload];
        }
      } else if (opcode === 0) {
        if (this.fragmentOpcode === null) {
          this.rejectPending(new Error("Frame WebSocket de continuacao sem inicio"));
        } else {
          this.fragmentBuffers.push(payload);
          if (finalFrame) {
            const complete = Buffer.concat(this.fragmentBuffers);
            if (this.fragmentOpcode === 1) this.handleMessage(complete.toString("utf8"));
            this.fragmentOpcode = null;
            this.fragmentBuffers = [];
          }
        }
      }
      if (opcode === 8) this.rejectPending(new Error("Chrome encerrou o WebSocket CDP"));
      if (opcode === 9) this.writeControlFrame(0x8a, payload);
    }
  }

  handleMessage(text) {
    let message;
    try {
      message = JSON.parse(text);
    } catch (error) {
      this.rejectPending(new Error(`Mensagem CDP invalida: ${error.message}`));
      return;
    }
    if (message.method === "Runtime.consoleAPICalled") {
      this.consoleMessages.push(
        {
          type: message.params?.type ?? "unknown",
          argumentTypes: (message.params?.args ?? []).map((arg) => arg.type ?? "unknown"),
        },
      );
      this.consoleMessages = this.consoleMessages.slice(-20);
    }
    if (message.method === "Runtime.exceptionThrown") {
      this.pageErrors.push(message.params?.exceptionDetails?.text ?? "Runtime exception");
      this.pageErrors = this.pageErrors.slice(-20);
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
    let header;
    if (payload.length < 126) {
      header = Buffer.from([0x81, 0x80 | payload.length]);
    } else if (payload.length <= 65_535) {
      header = Buffer.from([0x81, 0x80 | 126, payload.length >> 8, payload.length & 0xff]);
    } else {
      header = Buffer.alloc(10);
      header[0] = 0x81;
      header[1] = 0x80 | 127;
      header.writeBigUInt64BE(BigInt(payload.length), 2);
    }
    const mask = crypto.randomBytes(4);
    const maskedPayload = Buffer.from(payload);
    for (let i = 0; i < maskedPayload.length; i += 1) {
      maskedPayload[i] ^= mask[i % 4];
    }
    this.socket.write(Buffer.concat([header, mask, maskedPayload]));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Timeout CDP em ${method}`));
      }, COMMAND_TIMEOUT_MS);
      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });
    });
  }

  writeControlFrame(firstByte, payload) {
    if (!this.socket || payload.length > 125) return;
    const mask = crypto.randomBytes(4);
    const body = Buffer.from(payload);
    for (let index = 0; index < body.length; index += 1) body[index] ^= mask[index % 4];
    this.socket.write(Buffer.concat([Buffer.from([firstByte, 0x80 | body.length]), mask, body]));
  }

  rejectPending(error) {
    for (const waiter of this.pending.values()) waiter.reject(error);
    this.pending.clear();
  }

  close() {
    this.rejectPending(new Error("Conexao CDP fechada pelo teste"));
    this.socket?.end();
    this.socket?.destroy();
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
    `timeout aguardando: ${body}\n${JSON.stringify(debug)}\nconsole=${JSON.stringify(cdp.consoleMessages)}\npageErrors=${JSON.stringify(cdp.pageErrors)}\n${text}`,
  );
}

async function main() {
  await assertPortAvailable(CDP_PORT);
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

  let cdp = null;
  let activationMayBeActive = false;
  try {
    await waitForCdp(CDP_PORT);
    const target = await fetchJson(
      `http://127.0.0.1:${CDP_PORT}/json/new?${encodeURIComponent(appPath("/login"))}`,
      { method: "PUT" },
    );
    cdp = new CdpSocket(target.webSocketDebuggerUrl);
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
      const selectedFarm = await evaluate(
        cdp,
        "localStorage.getItem('gestao_agro_active_fazenda_id')",
      );
      if (selectedFarm !== FARM_ID) {
        throw new Error(`fazenda ativa diverge de UI_SMOKE_FARM_ID: ${selectedFarm ?? "ausente"}`);
      }
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
    const activeFarm = await evaluate(
      cdp,
      "localStorage.getItem('gestao_agro_active_fazenda_id')",
    );
    if (!activeFarm) throw new Error("Nenhuma fazenda ativa apos login");

    await cdp.send("Page.navigate", { url: appPath("/protocolos-sanitarios") });
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
    activationMayBeActive = true;
    await waitFor(
      cdp,
      "return document.body.innerText.includes('Agenda de Vaca Seca ativada no protocolo da fazenda.');",
      10_000,
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
    after.toastObserved = true;
    const screenshot = await cdp.send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: true,
    });
    if (!screenshot.data) throw new Error("CDP nao retornou dados da captura de tela");
    const screenshotPath = path.join(
      process.cwd(),
      "tmp",
      "dry-cow-ui-smoke.png",
    );
    fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
    fs.writeFileSync(screenshotPath, Buffer.from(screenshot.data, "base64"));

    if (
      !after.hasBadge ||
      after.hasActivate ||
      !after.hasDeactivate ||
      !after.hasGeneratesAgenda ||
      !after.toastObserved
    ) {
      throw new Error(`estado apos ativacao inesperado: ${JSON.stringify(after)}`);
    }

    await evaluate(
      cdp,
      `(() => {
        const button = [...document.querySelectorAll('button')]
          .find((item) => item.innerText.includes('Desativar agenda de Vaca Seca'));
        if (!button) throw new Error('botao de desativacao nao encontrado');
        button.click();
      })()`,
    );
    await waitFor(
      cdp,
      "return document.body.innerText.includes('Ativar agenda de Vaca Seca') && document.body.innerText.includes('Sem agenda');",
      30_000,
    );
    const restored = await evaluate(
      cdp,
      `(() => {
        const text = document.body.innerText;
        return {
          hasActivate: text.includes('Ativar agenda de Vaca Seca'),
          hasDeactivate: text.includes('Desativar agenda de Vaca Seca'),
          hasNoAgenda: text.includes('Sem agenda')
        };
      })()`,
    );
    if (!restored.hasActivate || restored.hasDeactivate || !restored.hasNoAgenda) {
      throw new Error(`estado inicial nao foi restaurado: ${JSON.stringify(restored)}`);
    }
    activationMayBeActive = false;

    if (cdp.pageErrors.length > 0) {
      throw new Error(`Erros JavaScript durante o smoke: ${JSON.stringify(cdp.pageErrors)}`);
    }
    console.log(JSON.stringify({ result: "PASS", activeFarm, before, after, restored, screenshotPath }, null, 2));
  } finally {
    if (cdp && activationMayBeActive) {
      try {
        await evaluate(
          cdp,
          `(() => {
            const button = [...document.querySelectorAll('button')]
              .find((item) => item.innerText.includes('Desativar agenda de Vaca Seca'));
            if (button) button.click();
          })()`,
        );
        await waitFor(
          cdp,
          "return document.body.innerText.includes('Ativar agenda de Vaca Seca');",
          10_000,
        );
      } catch (error) {
        console.error(`WARNING falha ao restaurar configuracao de Vaca Seca: ${error.message}`);
      }
    }
    cdp?.close();
    chrome.kill();
    await new Promise((resolve) => {
      if (chrome.exitCode !== null) return resolve();
      const timer = setTimeout(resolve, 3000);
      chrome.once("exit", () => {
        clearTimeout(timer);
        resolve();
      });
    });
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
