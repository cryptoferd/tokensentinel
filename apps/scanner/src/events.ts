import { EventEmitter } from 'node:events';
export const events = new EventEmitter();
events.setMaxListeners(100);
export function publish(type: string, data: unknown) { events.emit('message', { type, data, at: Date.now() }); }
