<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [tsrpc-base-client](./tsrpc-base-client.md) &gt; [ParsedServerOutput](./tsrpc-base-client.parsedserveroutput.md)

## ParsedServerOutput type

<b>Signature:</b>

```typescript
export type ParsedServerOutput = {
    type: 'api';
    service: ApiService;
    sn?: number;
    ret: ApiReturn<any>;
} | {
    type: 'msg';
    service: MsgService;
    msg: any;
};
```
<b>References:</b> [ApiService](./tsrpc-base-client.apiservice.md)<!-- -->, [MsgService](./tsrpc-base-client.msgservice.md)

