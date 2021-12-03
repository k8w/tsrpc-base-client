<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [tsrpc-base-client](./tsrpc-base-client.md) &gt; [TransportDataUtil](./tsrpc-base-client.transportdatautil.md) &gt; [encodeServerMsg](./tsrpc-base-client.transportdatautil.encodeservermsg_2.md)

## TransportDataUtil.encodeServerMsg() method

<b>Signature:</b>

```typescript
static encodeServerMsg(tsbuffer: TSBuffer, service: MsgService, msg: any, type: 'json', connType: BaseClient<any>['type']): EncodeOutput<object>;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  tsbuffer | TSBuffer |  |
|  service | [MsgService](./tsrpc-base-client.msgservice.md) |  |
|  msg | any |  |
|  type | 'json' |  |
|  connType | [BaseClient](./tsrpc-base-client.baseclient.md)<!-- -->&lt;any&gt;\['type'\] |  |

<b>Returns:</b>

[EncodeOutput](./tsrpc-base-client.encodeoutput.md)<!-- -->&lt;object&gt;
