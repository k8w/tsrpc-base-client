import 'k8w-extend-native';

export * from './client/BaseClient';
export * from './client/BaseHttpClient';
export * from './client/BaseWsClient';
export * from './models/ClientFlowData';
export * from './models/Counter';
export * from './models/Flow';
export * from './models/MsgHandlerManager';
export * from './models/ServiceMapUtil';
export * from './models/TransportDataUtil';
export * from './models/TransportOptions';

let a = Math.random() > 0.5 ? 'yes' : undefined;
let b = Math.random() > 0.5 ? 'yes' : undefined;
console.log(a ?? b);