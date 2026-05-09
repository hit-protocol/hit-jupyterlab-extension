/**
 * HIT-1.0 Intent Socket Server - v1.0-BETA ("The Bridge")
 * --------------------------------------------------------
 * Responsibilities:
 *   1. Route HIT protocol messages between the storefront UI and connected Agents
 *   2. Fan-out PATCH_STATE events to all subscribers of a given node UID
 *   3. Maintain pending Guardrail state; enforce confirmation protocol
 *   4. Provide HTTP /status health endpoint for monitoring
 *   5. Structured, colour-coded console logging
 */

const http        = require('http');
const { WebSocketServer } = require('ws');

// Config
const WS_PORT   = 8080;
const HTTP_PORT = 8081;
const PING_MS   = 25000;

// ANSI colour helpers
const C = {
  reset:  '\x1b[0m',
  cyan:   '\x1b[36m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  red:    '\x1b[31m',
  gray:   '\x1b[90m',
  bold:   '\x1b[1m',
};

function log(level, msg, meta) {
  const ts    = new Date().toISOString();
  const color = { INFO: C.cyan, OK: C.green, WARN: C.yellow, ERROR: C.red }[level] || C.reset;
  const base  = `${C.gray}${ts}${C.reset} ${color}${C.bold}[${level}]${C.reset} [HIT-Server] ${msg}`;
  if (meta !== undefined) console.log(base, C.gray + JSON.stringify(meta) + C.reset);
  else console.log(base);
}

// Session Registry
// Each client: { ws, role, id, subscriptions: Set<uid>, connectedAt }
// Roles: 'ui' | 'agent' | 'dumb' | 'unknown'
const registry = new Map();
const uiSessions = new Set();
let sessionSeq = 0;

function mkId() { return `c${++sessionSeq}_${Date.now()}`; }

function broadcast(msg, excludeId) {
  const raw = JSON.stringify(msg);
  registry.forEach((session, id) => {
    if (id !== excludeId && session.ws.readyState === 1) {
      session.ws.send(raw);
    }
  });
}

function sendToUI(msg) {
  const raw = JSON.stringify(msg);
  uiSessions.forEach(s => {
    if (s.ws.readyState === 1) s.ws.send(raw);
  });
}

function sendToAgents(msg, excludeId) {
  const raw = JSON.stringify(msg);
  registry.forEach((session, id) => {
    if (session.role === 'agent' && id !== excludeId && session.ws.readyState === 1) {
      session.ws.send(raw);
    }
  });
}

// PATCH_STATE fan-out: only to agents subscribed to that uid or '*'
function fanOutPatchState(msg, senderSessionId) {
  const uid = msg.payload && msg.payload.uid;
  const raw = JSON.stringify(msg);
  registry.forEach((session, id) => {
    if (id === senderSessionId) return;
    if (session.role !== 'agent') return;
    if (session.ws.readyState !== 1) return;
    if (session.subscriptions.has('*') || (uid && session.subscriptions.has(uid))) {
      session.ws.send(raw);
    }
  });
}

// Guardrail State Machine
// Only one pending guardrail at a time
let pendingGuardrail = null;

function setGuardrail(payload, requesterId) {
  pendingGuardrail = {
    uid:         payload.uid,
    action:      payload.action,
    label:       payload.label || payload.uid,
    requestedBy: requesterId,
    timestamp:   new Date().toISOString()
  };
  log('WARN', `Guardrail PENDING => ${pendingGuardrail.uid}::${pendingGuardrail.action}`);
}

function clearGuardrail() { pendingGuardrail = null; }

// Message Router
function route(msg, session) {
  const { type, payload } = msg;
  const sid = session.id;

  switch (type) {

    case 'HIT_HELLO': {
      session.role = 'ui';
      uiSessions.add(session);
      log('OK', `UI registered [${sid}] total_ui=${uiSessions.size}`);
      session.ws.send(JSON.stringify({ type: 'HIT_WELCOME', payload: { role: 'ui', server_version: '1.0-BETA' } }));
      sendToAgents({ type: 'UI_ONLINE', payload: { ui_count: uiSessions.size } });
      break;
    }

    case 'HIT_AGENT_HELLO': {
      session.role = 'agent';
      if (payload && Array.isArray(payload.subscribe)) {
        payload.subscribe.forEach(u => session.subscriptions.add(u));
      } else {
        session.subscriptions.add('*');
      }
      log('OK', `Agent registered [${sid}] subs=${[...session.subscriptions].join(',')}`);
      session.ws.send(JSON.stringify({
        type: 'AGENT_WELCOME',
        payload: { role: 'agent', id: sid, server_version: '1.0-BETA', guardrail_pending: pendingGuardrail }
      }));
      break;
    }

    case 'DUMB_TERMINAL': {
      session.role = 'dumb';
      log('INFO', `Dumb terminal registered [${sid}]`);
      break;
    }

    case 'PATCH_STATE': {
      const uid = payload && payload.uid;
      log('INFO', `PATCH_STATE [${uid}]`);
      if (session.role === 'ui' || session.role === 'dumb') {
        fanOutPatchState(msg, sid);
      } else {
        sendToUI(msg);
      }
      break;
    }

    case 'GET_TREE': {
      log('INFO', `GET_TREE from [${sid}]`);
      sendToUI({ type: 'GET_TREE', payload: payload || {} });
      break;
    }

    case 'LIST_NODES': {
      log('INFO', `LIST_NODES from [${sid}]`, payload);
      sendToUI({ type: 'LIST_NODES', payload: payload || {} });
      break;
    }

    case 'FOCUS_NODE': {
      if (!payload || !payload.uid) { log('WARN', 'FOCUS_NODE missing uid'); break; }
      log('INFO', `FOCUS_NODE [${payload.uid}] by [${sid}]`);
      sendToUI({ type: 'FOCUS_NODE', payload });
      break;
    }

    case 'CALL_ACTION': {
      if (!payload || !payload.uid || !payload.action) { log('WARN', 'CALL_ACTION missing uid/action'); break; }
      if (pendingGuardrail) {
        log('WARN', `CALL_ACTION blocked - guardrail pending for [${pendingGuardrail.uid}]`);
        session.ws.send(JSON.stringify({
          type: 'ACTION_ERROR',
          payload: { uid: payload.uid, error: `Guardrail pending for ${pendingGuardrail.uid}::${pendingGuardrail.action}. Await human confirmation.` }
        }));
        break;
      }
      log('INFO', `CALL_ACTION [${payload.uid}::${payload.action}]`, payload.params);
      sendToUI({ type: 'CALL_ACTION', payload });
      break;
    }

    case 'ACTION_RESULT': {
      log('OK', `ACTION_RESULT [${payload && payload.uid}]`);
      sendToAgents({ type: 'ACTION_RESULT', payload });
      break;
    }

    case 'ACTION_ERROR': {
      log('ERROR', `ACTION_ERROR [${payload && payload.uid}] - ${payload && payload.error}`);
      sendToAgents({ type: 'ACTION_ERROR', payload });
      break;
    }

    case 'TREE_RESPONSE': {
      log('INFO', `TREE_RESPONSE => agents`);
      sendToAgents({ type: 'TREE_RESPONSE', payload });
      break;
    }

    case 'NODES_RESPONSE': {
      const n = payload && payload.nodes && payload.nodes.length;
      log('INFO', `NODES_RESPONSE => agents (${n} nodes)`);
      sendToAgents({ type: 'NODES_RESPONSE', payload });
      break;
    }

    case 'GUARDRAIL_PENDING': {
      setGuardrail(payload, sid);
      broadcast({ type: 'GUARDRAIL_PENDING', payload: { ...payload, ...pendingGuardrail } }, sid);
      break;
    }

    case 'GUARDRAIL_CONFIRMED': {
      if (!pendingGuardrail) { log('WARN', 'GUARDRAIL_CONFIRMED with no pending guardrail'); break; }
      const resolved = { ...pendingGuardrail };
      clearGuardrail();
      log('OK', `Guardrail CONFIRMED => ${resolved.uid}::${resolved.action}`);
      broadcast({ type: 'GUARDRAIL_CONFIRMED', payload: resolved }, sid);
      break;
    }

    case 'GUARDRAIL_REJECTED': {
      if (!pendingGuardrail) { log('WARN', 'GUARDRAIL_REJECTED with no pending guardrail'); break; }
      const resolved = { ...pendingGuardrail };
      clearGuardrail();
      log('WARN', `Guardrail REJECTED => ${resolved.uid}::${resolved.action}`);
      broadcast({ type: 'GUARDRAIL_REJECTED', payload: resolved }, sid);
      break;
    }

    case 'USER_PROMPT':
    case 'AGENT_CHAT': {
      log('INFO', `${type} passthrough`);
      broadcast(msg, sid);
      break;
    }

    case 'SUBSCRIBE': {
      if (!payload || !Array.isArray(payload.uids)) break;
      payload.uids.forEach(u => session.subscriptions.add(u));
      log('INFO', `[${sid}] subscribed: ${payload.uids.join(', ')}`);
      session.ws.send(JSON.stringify({ type: 'SUBSCRIBED', payload: { uids: [...session.subscriptions] } }));
      break;
    }

    case 'UNSUBSCRIBE': {
      if (!payload || !Array.isArray(payload.uids)) break;
      payload.uids.forEach(u => session.subscriptions.delete(u));
      log('INFO', `[${sid}] unsubscribed: ${payload.uids.join(', ')}`);
      break;
    }

    case 'SERVER_STATUS': {
      session.ws.send(JSON.stringify({ type: 'SERVER_STATUS_RESPONSE', payload: buildStatus() }));
      break;
    }

    default:
      log('WARN', `Unknown message type [${type}] from [${sid}]`);
  }
}

// Status snapshot
function buildStatus() {
  const sessions = [];
  registry.forEach((s, id) => {
    sessions.push({ id, role: s.role, connectedAt: s.connectedAt, subscriptions: [...s.subscriptions] });
  });
  return {
    server_version:  '1.0-BETA',
    uptime_s:        Math.floor(process.uptime()),
    ui_online:       uiSessions.size > 0,
    session_count:   registry.size,
    guardrail_pending: pendingGuardrail,
    sessions
  };
}

// WebSocket Server
const wss = new WebSocketServer({ port: WS_PORT });
log('INFO', `WebSocket router running on ws://localhost:${WS_PORT}`);

wss.on('connection', function (ws) {
  const id = mkId();
  const session = { ws, id, role: 'unknown', subscriptions: new Set(), connectedAt: new Date().toISOString() };
  registry.set(id, session);
  log('INFO', `Client connected [${id}] - total: ${registry.size}`);

  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', function (data) {
    try {
      const msg = JSON.parse(data.toString());
      route(msg, session);
    } catch (e) {
      log('ERROR', `Parse error from [${id}]: ${e.message}`);
    }
  });

  ws.on('close', () => {
    registry.delete(id);
    if (session.role === 'ui') {
      uiSessions.delete(session);
      log('WARN', `UI disconnected [${id}] remaining_ui=${uiSessions.size}`);
      if (uiSessions.size === 0) {
        sendToAgents({ type: 'UI_OFFLINE', payload: {} });
      }
    }
    log('INFO', `Client disconnected [${id}] - total: ${registry.size}`);
  });

  ws.on('error', (err) => {
    log('ERROR', `WebSocket error on [${id}]: ${err.message}`);
  });
});

// Heartbeat
const pingInterval = setInterval(() => {
  wss.clients.forEach(ws => {
    if (!ws.isAlive) { ws.terminate(); return; }
    ws.isAlive = false;
    ws.ping();
  });
}, PING_MS);

wss.on('close', () => clearInterval(pingInterval));

// HTTP Health Endpoint
const httpServer = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/status') {
    const body = JSON.stringify(buildStatus(), null, 2);
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(body);
    return;
  }
  res.writeHead(404);
  res.end('Not found');
});

httpServer.listen(HTTP_PORT, () => {
  log('INFO', `HTTP status endpoint on http://localhost:${HTTP_PORT}/status`);
});

log('OK', 'HIT-1.0 BETA server ready. Waiting for connections...');

