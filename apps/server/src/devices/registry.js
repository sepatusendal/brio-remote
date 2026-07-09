const devices = new Map();

export function updateDevice(data) {
  const device = {
    deviceId: data.deviceId,
    hostname: data.hostname,
    os: data.os,
    arch: data.arch,
    lastSeen: Date.now(),
    online: true,
  };

  devices.set(data.deviceId, device);

  return device;
}

export function getDevices() {
  return Array.from(devices.values());
}
