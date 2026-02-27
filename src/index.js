
const crypto = require('crypto');
const https = require('https');
const http = require('http');

const DEFAULT_SEED_NODES = [
  'https://node1.xeriscoin.io',
  'https://node2.xeriscoin.io',
];

const NETWORKS = {
  MAINNET: 'mainnet',
  TESTNET: 'testnet',
  LOCALHOST: 'localhost',
};

const MIN_STAKE = 100;

function request(url, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;

    const opts = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'XerisCoin-SDK/0.1.0',
        ...(options.headers || {}),
      },
    };

    const req = lib.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

class XerisIdentity {
  static generate() {
    try {
      const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519', {
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
        publicKeyEncoding: { type: 'spki', format: 'pem' },
      });

      const address = XerisIdentity._deriveAddress(publicKey);

      return new XerisIdentity({ privateKey, publicKey, address });
    } catch {
      const privRaw = crypto.randomBytes(32);
      const pubRaw = crypto.createHash('sha256').update(privRaw).digest();
      const address = 'XRS' + pubRaw.toString('hex').toUpperCase().slice(0, 40);
      return new XerisIdentity({
        privateKey: privRaw.toString('hex'),
        publicKey: pubRaw.toString('hex'),
        address,
      });
    }
  }

  static fromMinerJson(minerJson) {
    if (!minerJson.privateKey || !minerJson.publicKey || !minerJson.address) {
      throw new Error('Invalid miner.json: missing required fields');
    }
    return new XerisIdentity(minerJson);
  }

  static _deriveAddress(publicKeyPem) {
    const hash = crypto.createHash('sha256').update(publicKeyPem).digest('hex');
    return 'XRS' + hash.toUpperCase().slice(0, 40);
  }

  constructor({ privateKey, publicKey, address }) {
    this.privateKey = privateKey;
    this.publicKey = publicKey;
    this.address = address;
    this.createdAt = Date.now();
  }

  sign(data) {
    try {
      const sign = crypto.createSign('SHA256');
      sign.update(typeof data === 'string' ? data : data.toString());
      return sign.sign(this.privateKey, 'hex');
    } catch {
      return crypto.createHmac('sha256', this.privateKey)
        .update(typeof data === 'string' ? data : data.toString())
        .digest('hex');
    }
  }

  toMinerJson() {
    return {
      address: this.address,
      publicKey: this.publicKey,
      privateKey: this.privateKey,
      createdAt: this.createdAt,
      sdk: 'xeriscoin-sdk@0.1.0',
    };
  }

  toJSON() {
    return {
      address: this.address,
      publicKey: this.publicKey,
      createdAt: this.createdAt,
    };
  }
}

class XerisClient {
  constructor(options = {}) {
    this.network = options.network || NETWORKS.TESTNET;
    this.timeout = options.timeout || 10000;
    this.verbose = options.verbose || false;

    if (options.nodeUrl) {
      this.nodeUrl = options.nodeUrl;
    } else if (this.network === NETWORKS.LOCALHOST) {
      this.nodeUrl = 'http://localhost:8545';
    } else {
      this.nodeUrl = DEFAULT_SEED_NODES[0];
    }
  }

  _log(...args) {
    if (this.verbose) console.log('[XerisSDK]', ...args);
  }

  async _rpc(method, params = {}) {
    const endpoint = `${this.nodeUrl}/rpc`;
    const body = { jsonrpc: '2.0', method, params, id: Date.now() };
    this._log(`→ ${method}`, params);

    try {
      const res = await request(endpoint, { method: 'POST' }, body);
      this._log(`← ${method}`, res.data);
      if (res.data?.error) throw new Error(res.data.error.message || 'RPC error');
      return res.data?.result ?? res.data;
    } catch (err) {
      throw new Error(`RPC call '${method}' failed: ${err.message}`);
    }
  }

  async getLatestBlock() {
    return this._rpc('chain_getLatestBlock');
  }

  async getBlock(hashOrHeight) {
    return this._rpc('chain_getBlock', { id: hashOrHeight });
  }

  async getNetworkStats() {
    return this._rpc('network_getStats');
  }

  async getValidators() {
    return this._rpc('consensus_getValidators');
  }

  async getBalance(address) {
    XerisClient._validateAddress(address);
    return this._rpc('account_getBalance', { address });
  }

  async getStakeInfo(address) {
    XerisClient._validateAddress(address);
    return this._rpc('stake_getInfo', { address });
  }

  async getTransactions(address, options = {}) {
    XerisClient._validateAddress(address);
    return this._rpc('account_getTransactions', {
      address,
      limit: options.limit || 20,
      offset: options.offset || 0,
    });
  }

  buildTransfer(identity, to, amount, memo = '') {
    XerisClient._validateAddress(to);
    if (typeof amount !== 'number' || amount <= 0) {
      throw new Error('Amount must be a positive number');
    }

    const tx = {
      type: 'transfer',
      from: identity.address,
      to,
      amount,
      memo,
      timestamp: Date.now(),
      nonce: crypto.randomBytes(8).toString('hex'),
    };

    const payload = JSON.stringify({ from: tx.from, to: tx.to, amount: tx.amount, nonce: tx.nonce, timestamp: tx.timestamp });
    tx.signature = identity.sign(payload);
    tx.publicKey = identity.publicKey;

    return tx;
  }

  async broadcastTransaction(signedTx) {
    return this._rpc('tx_broadcast', { transaction: signedTx });
  }

  async transfer(identity, to, amount, memo = '') {
    const tx = this.buildTransfer(identity, to, amount, memo);
    return this.broadcastTransaction(tx);
  }

  async getTransaction(txHash) {
    return this._rpc('tx_get', { hash: txHash });
  }

  buildStake(identity, amount) {
    if (amount < MIN_STAKE) {
      throw new Error(`Minimum stake is ${MIN_STAKE} XRS`);
    }

    const tx = {
      type: 'stake',
      from: identity.address,
      amount,
      timestamp: Date.now(),
      nonce: crypto.randomBytes(8).toString('hex'),
    };

    const payload = JSON.stringify({ from: tx.from, amount: tx.amount, nonce: tx.nonce, timestamp: tx.timestamp });
    tx.signature = identity.sign(payload);
    tx.publicKey = identity.publicKey;

    return tx;
  }

  async stake(identity, amount) {
    const tx = this.buildStake(identity, amount);
    return this.broadcastTransaction(tx);
  }

  async unstake(identity, amount) {
    const tx = {
      type: 'unstake',
      from: identity.address,
      amount,
      timestamp: Date.now(),
      nonce: crypto.randomBytes(8).toString('hex'),
    };
    const payload = JSON.stringify({ from: tx.from, amount: tx.amount, nonce: tx.nonce, timestamp: tx.timestamp });
    tx.signature = identity.sign(payload);
    tx.publicKey = identity.publicKey;
    return this.broadcastTransaction(tx);
  }

  async submitHeartbeat(identity, latestBlockHash) {
    const heartbeat = {
      type: 'heartbeat',
      address: identity.address,
      blockHash: latestBlockHash,
      timestamp: Date.now(),
      nonce: crypto.randomBytes(8).toString('hex'),
    };

    const payload = JSON.stringify(heartbeat);
    heartbeat.signature = identity.sign(payload);
    heartbeat.publicKey = identity.publicKey;

    return this._rpc('mining_submitHeartbeat', { heartbeat });
  }

  static calculateVP(stakedBalance, uptimeSeconds) {
    const uptimeFactor = Math.min(1, uptimeSeconds / 86400);
    return parseFloat((stakedBalance * uptimeFactor).toFixed(4));
  }

  static estimateRewardProbability(userVP, networkTotalVP) {
    if (networkTotalVP <= 0) return 0;
    return parseFloat((userVP / networkTotalVP).toFixed(6));
  }

  static _validateAddress(address) {
    if (typeof address !== 'string' || !address.startsWith('XRS') || address.length < 10) {
      throw new Error(`Invalid XRS address: ${address}`);
    }
  }
}

class XerisNode {
  constructor(identity, client, options = {}) {
    this.identity = identity;
    this.client = client;
    this.heartbeatInterval = options.heartbeatInterval || 60_000;
    this.onHeartbeat = options.onHeartbeat || null;
    this.onError = options.onError || null;

    this._timer = null;
    this._uptimeStart = null;
    this._heartbeats = 0;
    this.running = false;
  }

  async start() {
    if (this.running) throw new Error('Node is already running');
    this.running = true;
    this._uptimeStart = Date.now();
    this._timer = setInterval(() => this._tick(), this.heartbeatInterval);
    await this._tick();
    console.log(`[XerisNode] Started. Address: ${this.identity.address}`);
  }

  stop() {
    clearInterval(this._timer);
    this._timer = null;
    this.running = false;
    console.log(`[XerisNode] Stopped after ${this._heartbeats} heartbeats.`);
  }

  async _tick() {
    try {
      const block = await this.client.getLatestBlock();
      const blockHash = block?.hash || block?.blockhash || 'unknown';
      const result = await this.client.submitHeartbeat(this.identity, blockHash);
      this._heartbeats++;

      const uptimeSeconds = (Date.now() - this._uptimeStart) / 1000;
      const event = {
        heartbeat: this._heartbeats,
        blockHash,
        uptimeSeconds,
        timestamp: Date.now(),
        result,
      };

      if (this.onHeartbeat) this.onHeartbeat(event);
    } catch (err) {
      if (this.onError) this.onError(err);
      else console.error('[XerisNode] Heartbeat error:', err.message);
    }
  }

  get uptimeSeconds() {
    return this._uptimeStart ? (Date.now() - this._uptimeStart) / 1000 : 0;
  }

  get stats() {
    return {
      address: this.identity.address,
      running: this.running,
      heartbeats: this._heartbeats,
      uptimeSeconds: this.uptimeSeconds,
    };
  }
}

module.exports = {
  XerisIdentity,
  XerisClient,
  XerisNode,
  NETWORKS,
  MIN_STAKE,
  DEFAULT_SEED_NODES,
};
