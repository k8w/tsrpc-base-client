<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [tsrpc-base-client](./tsrpc-base-client.md) &gt; [MsgHandlerManager](./tsrpc-base-client.msghandlermanager.md) &gt; [forEachHandler](./tsrpc-base-client.msghandlermanager.foreachhandler.md)

## MsgHandlerManager.forEachHandler() method

Execute all handlers parallelly

<b>Signature:</b>

```typescript
forEachHandler(msgName: string, logger: Logger | undefined, ...args: any[]): (any | Promise<any>)[];
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  msgName | string |  |
|  logger | Logger \| undefined |  |
|  args | any\[\] |  |

<b>Returns:</b>

(any \| Promise&lt;any&gt;)\[\]

handlers count

