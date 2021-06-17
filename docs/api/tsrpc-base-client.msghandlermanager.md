<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [tsrpc-base-client](./tsrpc-base-client.md) &gt; [MsgHandlerManager](./tsrpc-base-client.msghandlermanager.md)

## MsgHandlerManager class

A manager for TSRPC receiving messages

<b>Signature:</b>

```typescript
export declare class MsgHandlerManager 
```

## Methods

|  Method | Modifiers | Description |
|  --- | --- | --- |
|  [addHandler(msgName, handler)](./tsrpc-base-client.msghandlermanager.addhandler.md) |  | Add message handler, duplicate handlers to the same <code>msgName</code> would be ignored. |
|  [forEachHandler(msgName, logger, args)](./tsrpc-base-client.msghandlermanager.foreachhandler.md) |  | Execute all handlers parallelly |
|  [removeAllHandlers(msgName)](./tsrpc-base-client.msghandlermanager.removeallhandlers.md) |  | Remove all handlers for the specific <code>msgName</code> |
|  [removeHandler(msgName, handler)](./tsrpc-base-client.msghandlermanager.removehandler.md) |  | Remove handler from the specific <code>msgName</code> |
