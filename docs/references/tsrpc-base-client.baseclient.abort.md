<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [tsrpc-base-client](./tsrpc-base-client.md) &gt; [BaseClient](./tsrpc-base-client.baseclient.md) &gt; [abort](./tsrpc-base-client.baseclient.abort.md)

## BaseClient.abort() method

Abort a pending API request, it would let the promise returned by `callApi` neither resolved nor rejected forever.

<b>Signature:</b>

```typescript
abort(sn: number): void;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  sn | number | Every api request has a unique <code>sn</code>, you can get this by <code>this.lastSN</code> |

<b>Returns:</b>

void

