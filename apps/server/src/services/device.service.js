export function registerDevice(device){
  return {
    id: Date.now(),
    ...device,
    status:'online'
  };
}
