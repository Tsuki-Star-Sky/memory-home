import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PrivateMemory } from '../src/private-memory/store.mjs';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'memory-home-demo-'));
try {
  const store = new PrivateMemory({ file: path.join(dir, 'memory.json') });
  const key = 'private:123'; // Synthetic fixture identity, never a real account.
  store.observe(key, { text: '我不喜欢香菜', plain: '我不喜欢香菜', messageId: 'demo-1', userId: '123', time: Date.now(), isSelf: false });
  console.log(JSON.stringify(store.query(key), null, 2));
  console.log('Temporary demo data is removed on exit.');
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
