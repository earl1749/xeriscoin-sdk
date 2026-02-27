# XerisCoin SDK (Temporary) `v0.1.0-alpha`

A lightweight JavaScript/Node.js SDK for interacting with the **XerisCoin Triple Consensus Blockchain** — compatible with the [Xeris Command Center](https://github.com/ZZachWWins/XerisCoin_Blockchain_Ui).

> ⚠️ **Temporary SDK** — Built to bridge the gap until an official SDK is released. APIs may change as the XerisCoin mainnet evolves.

---

## Installation

No npm publish yet — copy the `src/` folder into your project, or clone the repo:

```bash
git clone https://github.com/ZZachWWins/XerisCoin_Blockchain_Ui
# then copy xeriscoin-sdk/ into your project
```

**Requirements:** Node.js ≥ 15.0.0 (for native Ed25519 support). No external dependencies.

---

## Quick Start

```js
const { XerisIdentity, XerisClient, NETWORKS } = require('./xeriscoin-sdk/src');

// 1. Generate a new wallet identity
const identity = XerisIdentity.generate();
console.log(identity.address); // XRS...

// 2. Connect to testnet
const client = new XerisClient({ network: NETWORKS.TESTNET });

// 3. Check balance
const { balance } = await client.getBalance(identity.address);

// 4. Transfer XRS
await client.transfer(identity, 'XRS...recipientAddress', 10, 'Hello XRS!');

// 5. Stake tokens (min 100 XRS)
await client.stake(identity, 100);
```

---

## API Reference

### `XerisIdentity`

Manages Ed25519 keypairs and wallet addresses.

| Method | Description |
|--------|-------------|
| `XerisIdentity.generate()` | Generate a new keypair + address |
| `XerisIdentity.fromMinerJson(json)` | Restore identity from `miner.json` |
| `identity.sign(data)` | Sign data, returns hex signature |
| `identity.toMinerJson()` | Export credentials as `miner.json` |

### `XerisClient`

RPC client for the XerisCoin network.

#### Constructor options
```js
new XerisClient({
  network: 'testnet',   // 'mainnet' | 'testnet' | 'localhost'
  nodeUrl: 'https://...',  // override with custom node
  timeout: 10000,
  verbose: false,
})
```

#### Chain Methods
| Method | Description |
|--------|-------------|
| `getLatestBlock()` | Get current chain tip |
| `getBlock(hashOrHeight)` | Get block by hash or height |
| `getNetworkStats()` | TPS, block time, validator count |
| `getValidators()` | Current validator set |

#### Account Methods
| Method | Description |
|--------|-------------|
| `getBalance(address)` | XRS balance |
| `getStakeInfo(address)` | Staked amount + VP metrics |
| `getTransactions(address, opts)` | Transaction history |

#### Transaction Methods
| Method | Description |
|--------|-------------|
| `buildTransfer(identity, to, amount, memo?)` | Build signed transfer (no broadcast) |
| `broadcastTransaction(signedTx)` | Broadcast to network |
| `transfer(identity, to, amount, memo?)` | Build + broadcast transfer |
| `getTransaction(txHash)` | Fetch transaction by hash |

#### Staking Methods
| Method | Description |
|--------|-------------|
| `buildStake(identity, amount)` | Build stake tx (≥ 100 XRS) |
| `stake(identity, amount)` | Stake XRS |
| `unstake(identity, amount)` | Unstake XRS |

#### Mining / VP Methods
| Method | Description |
|--------|-------------|
| `submitHeartbeat(identity, blockHash)` | SPoE attestation |
| `XerisClient.calculateVP(stake, uptimeSeconds)` | Local VP estimate |
| `XerisClient.estimateRewardProbability(vp, networkVP)` | Reward probability |

---

### `XerisNode`

Automated heartbeat loop — keeps your node active and accumulates Validation Power.

```js
const { XerisNode } = require('./xeriscoin-sdk/src');

const node = new XerisNode(identity, client, {
  heartbeatInterval: 60_000,  // ms between heartbeats (default: 60s)
  onHeartbeat: (event) => {
    console.log(`Heartbeat #${event.heartbeat}, VP: ${event.uptimeSeconds}`);
  },
  onError: (err) => console.error(err),
});

await node.start();

// Later...
node.stop();
console.log(node.stats);
```

---

## Network Architecture

XerisCoin uses a **Triple Consensus Protocol**:

| Layer | Mechanism | SDK Interaction |
|-------|-----------|-----------------|
| Proof of Work | Light-PoW via uptime + bandwidth | `XerisNode` heartbeat loop |
| Proof of Stake | Stake-weighted rewards | `client.stake()` / `client.unstake()` |
| Proof of History | Block hash sequencing | `client.getLatestBlock()` |

---

## miner.json Format

The SDK produces `miner.json` compatible with the Xeris Command Center:

```json
{
  "address": "XRS...",
  "publicKey": "-----BEGIN PUBLIC KEY-----\n...",
  "privateKey": "-----BEGIN PRIVATE KEY-----\n...",
  "createdAt": 1735000000000,
  "sdk": "xeriscoin-sdk@0.1.0"
}
```

> 🔒 **Keep your `miner.json` private.** No entity under the Xeris Network Foundation can recover lost private keys.

---

## Examples

```bash
# Run basic usage demo (no live network)
node examples/basic-usage.js

# Run node runner demo (shows heartbeat loop for 20s)
node examples/node-runner.js
```

---

## Roadmap

- [ ] WebSocket subscriptions for live block/tx events
- [ ] Multi-node failover / load balancing
- [ ] Browser/ESM bundle
- [ ] Reward history tracking
- [ ] CLI wrapper

---

## License

MIT — Community SDK, not officially affiliated with Xeris Technologies.  
Designed for the [XerisCoin Blockchain UI](https://github.com/ZZachWWins/XerisCoin_Blockchain_Ui).
