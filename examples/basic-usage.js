
const { XerisIdentity, XerisClient, XerisNode, NETWORKS } = require('../src/index');

async function main() {
  console.log('═══════════════════════════════════════');
  console.log('  XerisCoin SDK — Basic Usage Demo');
  console.log('═══════════════════════════════════════\n');

  // 1. Generate a new identity
  console.log('1. Generating new identity...');
  const identity = XerisIdentity.generate();
  console.log('   Address   :', identity.address);
  console.log('   Created   :', new Date(identity.createdAt).toISOString());

  // 2. Export miner.json
  console.log('\n2. Exporting miner.json...');
  const minerJson = identity.toMinerJson();
  console.log('   miner.json:', JSON.stringify(minerJson, null, 2));

  // 3. Restore from miner.json
  console.log('\n3. Restoring identity from miner.json...');
  const restored = XerisIdentity.fromMinerJson(minerJson);
  console.log('   Restored  :', restored.address);
  console.log('   Match     :', restored.address === identity.address);

  // 4. Sign a message
  console.log('\n4. Signing a message...');
  const message = 'Hello from XerisCoin SDK!';
  const sig = identity.sign(message);
  console.log('   Message   :', message);
  console.log('   Signature :', sig.slice(0, 32) + '...');

  // 5. Create client (testnet)
  console.log('\n5. Creating testnet client...');
  const client = new XerisClient({ network: NETWORKS.TESTNET, verbose: false });
  console.log('   Node URL  :', client.nodeUrl);
  console.log('   Network   :', client.network);

  // 6. Build a transfer (without broadcasting)
  const recipient = 'XRS' + 'A1B2C3D4E5F6789012345678901234567890';
  console.log('\n6. Building transfer transaction...');
  try {
    const tx = client.buildTransfer(identity, recipient, 50, 'SDK test transfer');
    console.log('   From      :', tx.from);
    console.log('   To        :', tx.to);
    console.log('   Amount    :', tx.amount, 'XRS');
    console.log('   Memo      :', tx.memo);
    console.log('   Signature :', tx.signature.slice(0, 32) + '...');
  } catch (e) {
    console.log('   Error     :', e.message);
  }

  // 7. Build a stake transaction
  console.log('\n7. Building stake transaction (100 XRS)...');
  try {
    const stakeTx = client.buildStake(identity, 100);
    console.log('   Type      :', stakeTx.type);
    console.log('   Amount    :', stakeTx.amount, 'XRS');
    console.log('   Signed    :', !!stakeTx.signature);
  } catch (e) {
    console.log('   Error     :', e.message);
  }

  // 8. VP and reward calculations
  console.log('\n8. Validation Power & Reward Estimates...');
  const stakedBalance = 500;
  const uptimeSeconds = 43200; // 12 hours
  const vp = XerisClient.calculateVP(stakedBalance, uptimeSeconds);
  const prob = XerisClient.estimateRewardProbability(vp, 10000);
  console.log(`   Staked    : ${stakedBalance} XRS`);
  console.log(`   Uptime    : ${uptimeSeconds / 3600}h`);
  console.log(`   VP Score  : ${vp}`);
  console.log(`   Reward %  : ${(prob * 100).toFixed(4)}%`);

  console.log('\n═══════════════════════════════════════');
  console.log('  Demo complete! (No live network calls)');
  console.log('═══════════════════════════════════════');
}

main().catch(console.error);
