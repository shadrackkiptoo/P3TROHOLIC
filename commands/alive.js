function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${days}d ${hours}h ${minutes}m ${secs}s`;
}

function formatMemory(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function monitorStatus(status) {
  return { 0: 'Paused', 1: 'Not checked', 2: 'Up', 8: 'Seems down', 9: 'Down' }[status] || `Unknown (${status})`;
}

async function getUptimeRobotStats() {
  const apiKey = process.env.UPTIMEROBOT_API_KEY;
  if (!apiKey || typeof fetch !== 'function') return null;

  const body = new URLSearchParams({
    api_key: apiKey,
    monitors: process.env.UPTIMEROBOT_MONITOR_ID || '803899145',
    format: 'json'
  });
  const response = await fetch('https://api.uptimerobot.com/v2/getMonitors', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  if (!response.ok) throw new Error(`UptimeRobot API returned HTTP ${response.status}`);

  const data = await response.json();
  if (data.stat !== 'ok' || !data.monitors || !data.monitors.length) {
    throw new Error(data.error && data.error.message ? data.error.message : 'Monitor not found');
  }
  return data.monitors[0];
}

module.exports = {
  name: 'alive',
  aliases: ['.alive', '.status', '.ping', '.uptime'],
  description: 'Show bot uptime and runtime statistics.',
  async execute({ sock, jid }) {
    const memory = process.memoryUsage();
    const lines = [
      '🤖 *P3TROHOLIC STATUS*',
      '',
      '✅ *Status:* Online',
      `⏱️ *Uptime:* ${formatUptime(process.uptime())}`,
      `🧠 *Memory:* ${formatMemory(memory.rss)} RSS`,
      `📦 *Heap:* ${formatMemory(memory.heapUsed)} / ${formatMemory(memory.heapTotal)}`,
      `⚙️ *Node.js:* ${process.version}`,
      `🖥️ *Platform:* ${process.platform} ${process.arch}`,
      `🆔 *Process ID:* ${process.pid}`,
      `🕒 *Checked:* ${new Date().toISOString()}`
    ];

    try {
      const monitor = await getUptimeRobotStats();
      if (monitor) {
        lines.push(
          '',
          '*UPTIMEROBOT*',
          `📈 *Status:* ${monitorStatus(monitor.status)}`,
          `📊 *Uptime ratio:* ${monitor.uptimeRatio || 'N/A'}%`,
          `⚡ *Average response:* ${monitor.average_response_time || 'N/A'} ms`
        );
      }
    } catch (error) {
      console.error('alive: UptimeRobot request failed:', error.message);
      lines.push('', '⚠️ *UptimeRobot:* temporarily unavailable');
    }

    return sock.sendMessage(jid, { text: lines.join('\n') });
  }
};
