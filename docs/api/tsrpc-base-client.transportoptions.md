<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [tsrpc-base-client](./tsrpc-base-client.md) &gt; [TransportOptions](./tsrpc-base-client.transportoptions.md)

## TransportOptions interface

<b>Signature:</b>

```typescript
export interface TransportOptions 
```

## Properties

|  Property | Type | Description |
|  --- | --- | --- |
|  [abortKey?](./tsrpc-base-client.transportoptions.abortkey.md) | string | <i>(Optional)</i> Which can be passed to <code>client.abortByKey(abortKey)</code>. Many requests can share the same <code>abortKey</code>, so that they can be aborted at once. |
|  [timeout?](./tsrpc-base-client.transportoptions.timeout.md) | number | <i>(Optional)</i> Timeout of this request（ms） <code>undefined</code> represents no timeout |
