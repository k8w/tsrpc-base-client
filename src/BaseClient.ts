import { EncodeOutput, TSBuffer } from "tsbuffer";
import { ApiReturn, BaseServiceType, Logger, ServiceProto, TsrpcError, TsrpcErrorType } from "tsrpc-proto";
import { ApiReturnFlowData, CallApiFlowData, SendMsgFlowData } from "./ClientFlowData";
import { Counter } from './Counter';
import { EventEmitter } from "./EventEmitter";
import { Flow } from "./Flow";
import { MsgHandlerManager } from "./MsgHandlerManager";
import { ApiService, MsgService, ServiceMap, ServiceMapUtil } from './ServiceMapUtil';
import { TransportDataUtil } from "./TransportDataUtil";
import { TransportOptions } from "./TransportOptions";

/**
 * An abstract base class for TSRPC Client,
 * which includes some common buffer process flows.
 * 
 * @remarks
 * You can implement a client on a specific transportation protocol (like HTTP, WebSocket, QUIP) by extend this.
 * 
 * @typeParam ServiceType - `ServiceType` from generated `proto.ts`
 * 
 * @see
 * {@link https://github.com/k8w/tsrpc}
 * {@link https://github.com/k8w/tsrpc-browser}
 * {@link https://github.com/k8w/tsrpc-miniapp}
 */
export abstract class BaseClient<ServiceType extends BaseServiceType, EventData = any> extends EventEmitter<EventData>{

    /** The connection is long connection or short connection */
    abstract readonly type: 'SHORT' | 'LONG';

    readonly options: BaseClientOptions;

    /** The map of all services */
    readonly serviceMap: ServiceMap;
    /** The `TSBuffer` instance for encoding, decoding, and type checking */
    readonly tsbuffer: TSBuffer;

    /**
     * `Logger` to process API Request/Response, send message, send buffer...
     * @defaultValue `console`
     */
    readonly logger?: Logger;

    protected _msgHandlers = new MsgHandlerManager();

    /**
     * {@link Flow} to process `callApi`, `sendMsg`, buffer input/output, etc...
     */
    readonly flows = {
        // callApi
        preCallApiFlow: new Flow<CallApiFlowData<ServiceType>>(),
        preApiReturnFlow: new Flow<ApiReturnFlowData<ServiceType>>(),
        postApiReturnFlow: new Flow<ApiReturnFlowData<ServiceType>>(),

        // sendMsg
        preSendMsgFlow: new Flow<SendMsgFlowData<ServiceType>>(),
        postSendMsgFlow: new Flow<SendMsgFlowData<ServiceType>>(),

        // buffer
        preSendBufferFlow: new Flow<{ buf: Uint8Array, sn?: number }>(),
        preRecvBufferFlow: new Flow<{ buf: Uint8Array, sn?: number }>(),
    } as const;

    protected _apiSnCounter = new Counter(1);
    /**
     * The `SN` number of the last `callApi()`,
     * which can be passed to `abort()` to abort an API request.
     * @example
     * ```ts
     * client.callApi('xxx', { value: 'xxx' })
     *   .then(ret=>{ console.log('succ', ret) });
     * let lastSN = client.lastSN;
     * client.abort(lastSN);
     * ```
     */
    get lastSN() {
        return this._apiSnCounter.last;
    }
    /**
     * The `SN` number of the next `callApi()`,
     * which can be passed to `abort()` to abort an API request.
     * @example
     * ```ts
     * let nextSN = client.nextSN;
     * client.callApi('xxx', { value: 'xxx' })
     * ```
     */
    get nextSN() {
        return this._apiSnCounter.getNext(true);
    }

    /**
     * Pending API Requests
     */
    protected _pendingApis: PendingApiItem[] = [];

    constructor(proto: ServiceProto<ServiceType>, options: BaseClientOptions) {
        super();
        this.options = options;
        this.serviceMap = ServiceMapUtil.getServiceMap(proto);
        this.tsbuffer = new TSBuffer(proto.types);
        this.logger = this.options.logger;
    }

    /**
     * Send request and wait for the return
     * @param apiName
     * @param req - Request body
     * @param options - Transport options
     * @returns return a `ApiReturn`, all error (network error, business error, code exception...) is unified as `TsrpcError`.
     * The promise is never rejected, so you just need to process all error in one place.
     */
    async callApi<T extends keyof ServiceType['api']>(apiName: T, req: ServiceType['api'][T]['req'], options: TransportOptions = {}): Promise<ApiReturn<ServiceType['api'][T]['res']>> {
        // Add pendings
        let sn = this._apiSnCounter.getNext();
        let pendingItem: PendingApiItem = {
            sn: sn,
            abortKey: options.abortKey,
            service: this.serviceMap.apiName2Service[apiName as string]!
        };
        this._pendingApis.push(pendingItem);

        let promise = new Promise<ApiReturn<ServiceType['api'][T]['res']>>(async rs => {
            // Pre Call Flow
            let pre = await this.flows.preCallApiFlow.exec({
                apiName: apiName,
                req: req,
                options: options
            }, this.logger);
            if (!pre || pendingItem.isAborted) {
                this.abort(pendingItem.sn);
                return;
            }

            // Do call (send -> wait -> recv -> return)
            let ret: ApiReturn<ServiceType['api'][T]['res']>;
            // return by pre flow
            if (pre.return) {
                ret = pre.return;
            }
            else {
                // do call means it will send buffer via network
                ret = await this._doCallApi(pre.apiName, pre.req, pre.options, pendingItem);
            }
            if (pendingItem.isAborted) {
                return;
            }

            // Pre Return Flow
            let preReturn = await this.flows.preApiReturnFlow.exec({
                ...pre,
                return: ret
            }, this.logger);
            if (!preReturn) {
                this.abort(pendingItem.sn);
                return;
            }

            rs(preReturn.return!);

            // Post Flow
            this.flows.postApiReturnFlow.exec(preReturn, this.logger);
        });

        // Finally clear pendings
        promise.catch().then(() => {
            this._pendingApis.removeOne(v => v.sn === pendingItem.sn);
        })

        return promise;
    }

    protected async _doCallApi<T extends keyof ServiceType['api']>(apiName: T, req: ServiceType['api'][T]['req'], options: TransportOptions = {}, pendingItem: PendingApiItem): Promise<ApiReturn<ServiceType['api'][T]['res']>> {
        this.logger?.log(`[ApiReq] #${pendingItem.sn}`, apiName, req);

        let promise = new Promise<ApiReturn<ServiceType['api'][T]['res']>>(async rs => {
            // GetService
            let service = this.serviceMap.apiName2Service[apiName as string];
            if (!service) {
                rs({
                    isSucc: false,
                    err: new TsrpcError('Invalid api name: ' + apiName, {
                        code: 'INVALID_API_NAME',
                        type: TsrpcErrorType.ClientError
                    })
                });
                return;
            }
            pendingItem.service = service;

            // Encode
            let opEncode = this._encodeApiReq(service, req, pendingItem);
            if (!opEncode.isSucc) {
                rs({
                    isSucc: false, err: new TsrpcError(opEncode.errMsg, {
                        type: TsrpcErrorType.ClientError,
                        code: 'ENCODE_REQ_ERR'
                    })
                });
                return;
            }

            // Send Buf...
            let promiseReturn = this._waitApiReturn(pendingItem, options.timeout ?? this.options.timeout);
            let promiseSend = this._sendBuf(opEncode.buf, options, service.id, pendingItem);
            let opSend = await promiseSend;
            if (opSend.err) {
                rs({
                    isSucc: false,
                    err: opSend.err
                });
                return;
            }

            // And wait Return...
            let ret = await promiseReturn;
            if (pendingItem.isAborted) {
                return;
            }

            if (ret.isSucc) {
                this.logger?.log(`[ApiRes] #${pendingItem.sn} ${apiName}`, ret.res);
            }
            else {
                this.logger?.log(`[ApiErr] #${pendingItem.sn} ${apiName}`, ret.err);
            }

            rs(ret);
        });

        return promise;
    }

    protected _encodeApiReq(service: ApiService, req: any, pendingItem: PendingApiItem): EncodeOutput {
        return TransportDataUtil.encodeApiReq(this.tsbuffer, service, req, this.type === 'LONG' ? pendingItem.sn : undefined);
    }

    /**
     * Send message, without response, not ensuring the server is received and processed correctly.
     * @param msgName
     * @param msg - Message body
     * @param options - Transport options
     * @returns If the promise is resolved, it means the request is sent to system kernel successfully.
     * Notice that not means the server received and processed the message correctly.
     */
    sendMsg<T extends keyof ServiceType['msg']>(msgName: T, msg: ServiceType['msg'][T], options: TransportOptions = {}): Promise<{ isSucc: true } | { isSucc: false, err: TsrpcError }> {
        let promise = new Promise<{ isSucc: true } | { isSucc: false, err: TsrpcError }>(async rs => {
            // Pre Flow
            let pre = await this.flows.preSendMsgFlow.exec({
                msgName: msgName,
                msg: msg,
                options: options
            }, this.logger);
            if (!pre) {
                return;
            }

            // The msg is not prevented by pre flow
            this.logger?.log(`[SendMsg]`, msgName, msg);

            // GetService
            let service = this.serviceMap.msgName2Service[msgName as string];
            if (!service) {
                this.logger?.error('Invalid msg name: ' + msgName)
                rs({
                    isSucc: false,
                    err: new TsrpcError('Invalid msg name: ' + msgName, {
                        code: 'INVALID_MSG_NAME',
                        type: TsrpcErrorType.ClientError
                    })
                });
                return;
            }

            // Encode
            let opEncode = this._encodeClientMsg(service, msg);
            if (!opEncode.isSucc) {
                rs({
                    isSucc: false,
                    err: new TsrpcError(opEncode.errMsg, {
                        type: TsrpcErrorType.ClientError,
                        code: 'ENCODE_MSG_ERR'
                    })
                });
                return;
            }

            // Send Buf...
            let promiseSend = this._sendBuf(opEncode.buf, options, service.id);
            let opSend = await promiseSend;
            if (opSend.err) {
                rs({
                    isSucc: false,
                    err: opSend.err
                });
                return;
            }

            rs({ isSucc: true });

            // Post Flow
            this.flows.postSendMsgFlow.exec(pre, this.logger)
        });

        return promise;
    }

    protected _encodeClientMsg(service: MsgService, msg: any): EncodeOutput {
        return TransportDataUtil.encodeClientMsg(this.tsbuffer, service, msg);
    }

    /**
     * Add a message handler,
     * duplicate handlers to the same `msgName` would be ignored.
     * @param msgName
     * @param handler
     * @returns
     */
    listenMsg<T extends keyof ServiceType['msg']>(msgName: T, handler: ClientMsgHandler<ServiceType['msg'][T], this>): ClientMsgHandler<ServiceType['msg'][T], this> {
        this._msgHandlers.addHandler(msgName as string, handler)
        return handler;
    }
    /**
     * Remove a message handler
     */
    unlistenMsg<T extends keyof ServiceType['msg']>(msgName: T, handler: Function) {
        this._msgHandlers.removeHandler(msgName as string, handler)
    }
    /**
     * Remove all handlers from a message
     */
    unlistenMsgAll<T extends keyof ServiceType['msg']>(msgName: T) {
        this._msgHandlers.removeAllHandlers(msgName as string)
    }

    /**
     * Abort a pending API request, it makes the promise returned by `callApi()` neither resolved nor rejected forever.
     * @param sn - Every api request has a unique `sn` number, you can get it by `this.lastSN` 
     */
    abort(sn: number): void {
        // Find
        let index = this._pendingApis.findIndex(v => v.sn === sn);
        if (index === -1) {
            return;
        }
        let pendingItem = this._pendingApis[index];
        // Clear
        this._pendingApis.splice(index, 1);
        pendingItem.onReturn = undefined;
        pendingItem.isAborted = true;

        // Log
        this.logger?.log(`[ApiAbort] #${pendingItem.sn} ${pendingItem.service.name}`)
        // onAbort
        pendingItem.onAbort?.();
    }
    /**
     * Abort all API requests that has the `abortKey`.
     * It makes the promise returned by `callApi` neither resolved nor rejected forever.
     * @param abortKey - The `abortKey` of options when `callApi()`, see {@link TransportOptions.abortKey}.
     * @example
     * ```ts
     * // Send API request many times
     * client.callApi('SendData', { data: 'AAA' }, { abortKey: 'Session#123' });
     * client.callApi('SendData', { data: 'BBB' }, { abortKey: 'Session#123' });
     * client.callApi('SendData', { data: 'CCC' }, { abortKey: 'Session#123' });
     *
     * // And abort the at once
     * client.abortByKey('Session#123');
     * ```
     */
    abortByKey(abortKey: string) {
        this._pendingApis.filter(v => v.abortKey === abortKey).forEach(v => { this.abort(v.sn) });
    }
    /**
     * Abort all pending API requests.
     * It makes the promise returned by `callApi` neither resolved nor rejected forever.
     */
    abortAll() {
        this._pendingApis.slice().forEach(v => this.abort(v.sn));
    }

    /**
     * Send buffer
     * @remarks
     * Long connection: wait res by listenning `conn.onmessage`
     * Short connection: wait res by waitting response
     * @param buf 
     * @param options 
     * @param sn 
     */
    protected abstract _sendBuf(buf: Uint8Array, options: TransportOptions, serviceId: number, pendingApiItem?: PendingApiItem): Promise<{ err?: TsrpcError }>;

    protected async _onRecvBuf(buf: Uint8Array, pendingApiItem?: PendingApiItem) {
        let sn = pendingApiItem?.sn;
        this.options.debugBuf && this.logger?.debug('[RecvBuf]' + (sn ? (' #' + sn) : ''), 'length=' + buf.length, buf);

        // Pre Flow
        let pre = await this.flows.preRecvBufferFlow.exec({ buf: buf, sn: sn }, this.logger);
        if (!pre) {
            return;
        }
        buf = pre.buf;

        // Parse
        let opParsed = TransportDataUtil.parseServerOutout(this.tsbuffer, this.serviceMap, buf, pendingApiItem?.service.id);
        if (opParsed.isSucc) {
            let parsed = opParsed.result;
            if (parsed.type === 'api') {
                sn = sn ?? parsed.sn;
                // call ApiReturn listeners
                this._pendingApis.find(v => v.sn === sn)?.onReturn?.(parsed.ret);
            }
            else if (parsed.type === 'msg') {
                this.logger?.log(`[RecvMsg] ${parsed.service.name}`, parsed.msg)
                this._msgHandlers.forEachHandler(parsed.service.name, this.logger, parsed.msg, this);
            }
        }
        else {
            this.logger?.error('ParseServerOutputError: ' + opParsed.errMsg);
            this.logger?.error('Please check if the proto be the same between server and client');
        }
    }

    /**
     * @param sn 
     * @param timeout 
     * @returns `undefined` 代表 canceled
     */
    protected async _waitApiReturn(pendingItem: PendingApiItem, timeout?: number): Promise<ApiReturn<any>> {
        return new Promise<ApiReturn<any>>(rs => {
            // Timeout
            let timer: ReturnType<typeof setTimeout> | undefined;

            if (timeout) {
                timer = setTimeout(() => {
                    timer = undefined;
                    this._pendingApis.removeOne(v => v.sn === pendingItem.sn);
                    rs({
                        isSucc: false,
                        err: new TsrpcError('Request Timeout', {
                            type: TsrpcErrorType.NetworkError,
                            code: 'TIMEOUT'
                        })
                    })
                }, timeout);
            }

            // Listener (trigger by `this._onRecvBuf`)
            pendingItem.onReturn = ret => {
                if (timer) {
                    clearTimeout(timer);
                    timer = undefined;
                }
                this._pendingApis.removeOne(v => v.sn === pendingItem.sn);
                rs(ret);
            }
        });
    }

}

export const defaultBaseClientOptions: BaseClientOptions = {
    logger: console
}

export interface BaseClientOptions {
    /**
     * `Logger` to process API Request/Response, send message, send buffer...
     * If it is assigned to `undefined`, all log would be hidden. (It may be useful when you want to encrypt the transportation)
     * @defaultValue `console`
     */
    logger?: Logger;
    /** 
     * Timeout time for `callApi` (ms)
     * `undefined` or `0` means unlimited
     * @defaultValue `undefined`
     */
    timeout?: number;
    /**
     * If `true`, all sent and received raw buffer would be print into the log.
     * It may be useful when you do something for buffer encryption/decryption, and want to debug them.
     */
    debugBuf?: boolean
}

export interface PendingApiItem {
    sn: number,
    abortKey: string | undefined,
    service: ApiService,
    isAborted?: boolean,
    onAbort?: () => void,
    onReturn?: (ret: ApiReturn<any>) => void
}

export type ClientMsgHandler<Msg, Client extends BaseClient<any> = BaseClient<any>> = (msg: Msg, client: Client) => void | Promise<void>;