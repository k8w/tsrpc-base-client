<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [tsrpc-base-client](./tsrpc-base-client.md) &gt; [BaseClient](./tsrpc-base-client.baseclient.md) &gt; [abortByKey](./tsrpc-base-client.baseclient.abortbykey.md)

## BaseClient.abortByKey() method

Abort all API requests that has the `abortKey`<!-- -->. It makes the promise returned by `callApi` neither resolved nor rejected forever.

<b>Signature:</b>

```typescript
abortByKey(abortKey: string): void;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  abortKey | string | The <code>abortKey</code> of options when <code>callApi()</code>, see [TransportOptions.abortKey](./tsrpc-base-client.transportoptions.abortkey.md)<!-- -->. |

<b>Returns:</b>

void

## Example


```ts
// Send API request many times
client.callApi('SendData', { data: 'AAA' }, { abortKey: 'Session#123' });
client.callApi('SendData', { data: 'BBB' }, { abortKey: 'Session#123' });
client.callApi('SendData', { data: 'CCC' }, { abortKey: 'Session#123' });

// And abort the at once
client.abortByKey('Session#123');
```

