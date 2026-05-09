import asyncio
import json
import logging
from websockets.server import serve
from datetime import datetime

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("HIT-Relay")

class HITRelay:
    def __init__(self):
        self.sessions = {} 
        self.ui_sessions = set()
        self.session_seq = 0
        self.pending_guardrail = None

    def mk_id(self):
        self.session_seq += 1
        return f"c{self.session_seq}_{int(datetime.now().timestamp() * 1000)}"

    async def broadcast(self, msg, exclude_id=None):
        raw = json.dumps(msg)
        for sid, session in list(self.sessions.items()):
            if sid != exclude_id and not session['ws'].closed:
                try:
                    await session['ws'].send(raw)
                except: pass

    async def send_to_ui(self, msg):
        raw = json.dumps(msg)
        for sid in list(self.ui_sessions):
            if sid in self.sessions:
                session = self.sessions[sid]
                if not session['ws'].closed:
                    try:
                        await session['ws'].send(raw)
                    except: pass

    async def send_to_agents(self, msg, exclude_id=None):
        raw = json.dumps(msg)
        for sid, session in list(self.sessions.items()):
            if session['role'] == 'agent' and sid != exclude_id and not session['ws'].closed:
                try:
                    await session['ws'].send(raw)
                except: pass

    async def fan_out_patch(self, msg, sender_id):
        uid = msg.get('payload', {}).get('uid')
        raw = json.dumps(msg)
        for sid, session in list(self.sessions.items()):
            if sid == sender_id or session['role'] != 'agent' or session['ws'].closed:
                continue
            if '*' in session['subs'] or (uid and uid in session['subs']):
                try:
                    await session['ws'].send(raw)
                except: pass

    async def handle_msg(self, msg, sid):
        m_type = msg.get('type')
        payload = msg.get('payload', {})
        if sid not in self.sessions: return
        session = self.sessions[sid]

        if m_type == 'HIT_HELLO':
            session['role'] = 'ui'
            self.ui_sessions.add(sid)
            logger.info(f"UI registered [{sid}]")
            await session['ws'].send(json.dumps({'type': 'HIT_WELCOME', 'payload': {'role': 'ui', 'server_version': '1.0-PY-STABLE'}}))
            # Critical: Tell agents to wipe state because a NEW UI is online
            await self.send_to_agents({'type': 'UI_ONLINE', 'payload': {'ui_count': len(self.ui_sessions), 'fresh': True}})

        elif m_type == 'HIT_AGENT_HELLO':
            session['role'] = 'agent'
            subs = payload.get('subscribe', [])
            if isinstance(subs, list) and subs:
                for s in subs: session['subs'].add(s)
            else:
                session['subs'].add('*')
            logger.info(f"Agent registered [{sid}] subs={list(session['subs'])}")
            await session['ws'].send(json.dumps({
                'type': 'AGENT_WELCOME',
                'payload': {'role': 'agent', 'id': sid, 'server_version': '1.0-PY-STABLE'}
            }))

        elif m_type == 'PATCH_STATE':
            if session['role'] == 'ui':
                await self.fan_out_patch(msg, sid)
            else:
                await self.send_to_ui(msg)

        elif m_type in ('GET_TREE', 'LIST_NODES', 'FOCUS_NODE', 'CALL_ACTION'):
            await self.send_to_ui(msg)

        elif m_type in ('ACTION_RESULT', 'ACTION_ERROR', 'TREE_RESPONSE', 'NODES_RESPONSE'):
            await self.send_to_agents(msg)

    async def handler(self, ws):
        sid = self.mk_id()
        session = {'ws': ws, 'id': sid, 'role': 'unknown', 'subs': set(), 'at': datetime.now().isoformat()}
        self.sessions[sid] = session
        logger.info(f"Connected [{sid}]")
        try:
            async for message in ws:
                try:
                    msg = json.loads(message)
                    await self.handle_msg(msg, sid)
                except Exception as e:
                    logger.error(f"Error handling msg from {sid}: {e}")
        finally:
            if sid in self.ui_sessions:
                self.ui_sessions.remove(sid)
                # Tell agents UI is gone
                await self.send_to_agents({'type': 'UI_OFFLINE', 'payload': {'sid': sid}})
            if sid in self.sessions:
                del self.sessions[sid]
            logger.info(f"Disconnected [{sid}]")

async def main():
    relay = HITRelay()
    async with serve(relay.handler, "0.0.0.0", 8080):
        logger.info("HIT Python Relay (STABLE) running on ws://localhost:8080")
        await asyncio.Future()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass