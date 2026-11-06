const bufferModule = require("buffer");
const dns = require("dns");

if (!bufferModule.SlowBuffer || !bufferModule.SlowBuffer.prototype) {
  bufferModule.SlowBuffer = bufferModule.Buffer;
}

// Fix for Windows Node.js c-ares DNS resolution bug (e.g. ECONNREFUSED with MongoDB SRV)
const servers = dns.getServers();
if (servers.length === 1 && servers[0] === "127.0.0.1") {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
}

