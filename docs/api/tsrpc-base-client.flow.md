<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [tsrpc-base-client](./tsrpc-base-client.md) &gt; [Flow](./tsrpc-base-client.flow.md)

## Flow class

A `Flow` is consists of many `FlowNode`<!-- -->, which is function with the same input and output (like pipeline).

<b>Signature:</b>

```typescript
export declare class Flow<T> 
```

## Remarks

`Flow` is like a hook or event, executed at a specific time. The difference to event is it can be used to \*\*interrupt\*\* an action, by return `undefined` or `null` in a node.

## Properties

|  Property | Modifiers | Type | Description |
|  --- | --- | --- | --- |
|  [nodes](./tsrpc-base-client.flow.nodes.md) |  | [FlowNode](./tsrpc-base-client.flownode.md)<!-- -->&lt;T&gt;\[\] | All node functions, if you want to adjust the sort you can modify this. |
|  [onError](./tsrpc-base-client.flow.onerror.md) |  | (e: Error \| TsrpcError, last: T, input: T, logger: Logger \| undefined) =&gt; void | Event when error throwed from a <code>FlowNode</code> function. By default, it does nothing except print a <code>Uncaught FlowError</code> error log. |

## Methods

|  Method | Modifiers | Description |
|  --- | --- | --- |
|  [exec(input, logger)](./tsrpc-base-client.flow.exec.md) |  | Execute all node function one by one, the previous output is the next input, until the last output would be return to the caller. |
|  [push(node)](./tsrpc-base-client.flow.push.md) |  | Append a node function to the last |
|  [remove(node)](./tsrpc-base-client.flow.remove.md) |  | Remove a node function |

