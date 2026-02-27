
const { XerisIdentity, XerisClient, XerisNode, NETWORKS } = require('../src/index');

async function main() {
  console.log('═══════════════════════════════════════');
  console.log('  XerisCoin SDK — Node Runner Demo');
  console.log('═══════════════════════════════════════\n');

  const identity = XerisIdentity.generate();
  console.log(`Identity: ${identity.address}\n`);

  const client = new XerisClient({
    network: NETWORKS.TESTNET,
    verbose: false,
  });

  const node = new XerisNode(identity, client, {
    heartbeatInterval: 5000,
    onHeartbeat: (event) => {
      const vp = XerisClient.calculateVP(100, event.uptimeSeconds);
      console.log(
        `[Heartbeat #${event.heartbeat}] ` +
        `Uptime: ${event.uptimeSeconds.toFixed(0)}s | ` +
        `VP: ${vp} | ` +
        `Block: ${event.blockHash.slice(0, 16)}...`
      );
    },
    onError: (err) => {
      console.log(`[Error] ${err.message} (expected in offline demo)`);
    },
  });

  console.log('Starting node... (will run for 20 seconds)\n');
  await node.start();

  setTimeout(() => {
    node.stop();
    console.log('\nFinal stats:', node.stats);
    process.exit(0);
  }, 20000);
}

main().catch(console.error);

